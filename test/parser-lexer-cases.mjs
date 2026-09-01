import { tokenMatcher } from 'chevrotain'
import {
  NextLexer,
  Identifier,
  Module,
  Import,
  Export,
  From,
  When,
  Where,
  NumberLiteral,
  StringLiteral,
  IndexedHole,
  Wildcard,
} from '../src/parser/tokens.mjs'

const suite = (title, cases) => ({ title, cases })
const test = (label, run) => ({ label, run })

const lex = source => NextLexer.tokenize(source)

const tokenNames = result =>
  result.tokens.map(token => token.tokenType.name)

const isSuccessful = result => result.errors.length === 0

const isSingleToken = (source, tokenType) => {
  const result = lex(source)
  return isSuccessful(result)
    && result.tokens.length === 1
    && result.tokens[0].tokenType === tokenType
    && result.tokens[0].image === source
}

const allLexAs = (sources, tokenType) =>
  sources.every(source => isSingleToken(source, tokenType))

const noneLexAs = (sources, tokenType) =>
  sources.every(source => !isSingleToken(source, tokenType))

export const parserLexerSuites = [
  suite('NEXT lexer — Number literals', [
    test('accepts the specified decimal and exponent forms', () =>
      allLexAs([
        '0',
        '42',
        '.5',
        '5.0',
        '1e-2',
        '6E+23',
        '1_000_000',
        '12.34_56e7_8',
      ], NumberLiteral)),

    test('accepts hexadecimal, octal, and binary forms', () =>
      allLexAs([
        '0xff',
        '0XCA_FE',
        '0o755',
        '0O7_5_5',
        '0b1010',
        '0B10_10',
      ], NumberLiteral)),

    test('does not accept forbidden forms as one Number literal', () =>
      noneLexAs([
        '123n',
        '017',
        '5.',
      ], NumberLiteral)),

    test('does not absorb a leading unary minus into the literal', () => {
      const result = lex('-42')
      return isSuccessful(result)
        && tokenNames(result).join(' ') === 'Minus NumberLiteral'
        && result.tokens[1].image === '42'
    }),
  ]),

  suite('NEXT lexer — String literals', [
    test('accepts double-quoted strings and the settled escape set', () =>
      allLexAs([
        '"hello"',
        '"Καλημέρα 😀"',
        String.raw`"\n\t\r\0\b\f\v\\\"\'\x41\u0041\u{1F600}"`,
      ], StringLiteral)),

    test('rejects single-quoted and multiline strings', () =>
      noneLexAs([
        "'single quoted'",
        '"first line\nsecond line"',
      ], StringLiteral)),

    test('rejects escapes outside the specified escape set', () =>
      noneLexAs([
        String.raw`"bad \q escape"`,
        String.raw`"bad \x0 escape"`,
        String.raw`"bad \u123 escape"`,
        String.raw`"bad \01 escape"`,
      ], StringLiteral)),
  ]),

  suite('NEXT lexer — Identifiers and contextual words', [
    test('accepts Unicode identifier starts and continuations', () =>
      allLexAs([
        'π',
        'Δelta',
        'café',
        '变量',
        'a\u0301',
        'name42',
      ], Identifier)),

    test('keeps prelude constants as ordinary identifiers', () =>
      allLexAs(['true', 'false', 'null'], Identifier)),

    test('classifies contextual words while retaining Identifier membership', () => {
      const result = lex('module import export from when where')
      const expected = [Module, Import, Export, From, When, Where]
      return isSuccessful(result)
        && result.tokens.length === expected.length
        && result.tokens.every((token, index) =>
          token.tokenType === expected[index]
            && tokenMatcher(token, Identifier))
    }),

    test('uses longer ordinary identifiers instead of contextual prefixes', () =>
      allLexAs([
        'moduleName',
        'imported',
        'exportValue',
        'fromage',
        'whenever',
        'whereabouts',
      ], Identifier)),

    test('reserves underscore and dollar from ordinary identifiers', () =>
      noneLexAs([
        'under_score',
        'dollar$sign',
        '_name',
      ], Identifier)),

    test('recognizes wildcard and indexed-hole token forms', () => {
      const result = lex('_ _1 _42 _0')
      return tokenNames(result).join(' ') ===
        'Wildcard IndexedHole IndexedHole Wildcard NumberLiteral'
        && result.tokens[0].tokenType === Wildcard
        && result.tokens[1].tokenType === IndexedHole
        && result.tokens[2].tokenType === IndexedHole
    }),
  ]),

  suite('NEXT lexer — Comments and source locations', [
    test('skips line, documentation, and block comments', () => {
      const result = lex(
        'first // line comment\n' +
        'second /// documentation comment\n' +
        '/* block comment */ third'
      )
      return isSuccessful(result)
        && result.tokens.map(token => token.image).join(' ') ===
          'first second third'
    }),

    test('tracks offsets, lines, and columns across skipped comments', () => {
      const source = 'alpha // note\r\n/* block\nline */\u2028beta'
      const result = lex(source)
      const [alpha, beta] = result.tokens
      return isSuccessful(result)
        && result.tokens.length === 2
        && alpha.startOffset === 0
        && alpha.endOffset === 4
        && alpha.startLine === 1
        && alpha.startColumn === 1
        && alpha.endLine === 1
        && alpha.endColumn === 5
        && beta.startOffset === source.indexOf('beta')
        && beta.endOffset === source.length - 1
        && beta.startLine === 4
        && beta.startColumn === 1
        && beta.endLine === 4
        && beta.endColumn === 4
    }),

    test('block comments do not nest', () => {
      const result = lex('before /* outer /* inner */ after')
      return isSuccessful(result)
        && result.tokens.map(token => token.image).join(' ') ===
          'before after'
    }),
  ]),

  suite('NEXT lexer — Operators and maximal munch', [
    test('prefers every multi-character operator over its prefixes', () => {
      const source = [
        '**:=', '&&:=', '||:=', '??:=',
        '+:=', '-:=', '*:=', '/:=', '%:=',
        '...', '=>', '::', '|>', '<|', '?.',
        '??', '||', '&&', '==', '!=', '<=', '>=', '++', '**', ':=',
      ].join(' ')
      const expected = [
        'PowerMutate', 'AndMutate', 'OrMutate', 'NullishMutate',
        'PlusMutate', 'MinusMutate', 'StarMutate', 'SlashMutate',
        'PercentMutate', 'Ellipsis', 'Arrow', 'Match', 'PipeForward',
        'PipeBackward', 'OptionalDot', 'Nullish', 'Or', 'And', 'Equal',
        'NotEqual', 'LessEqual', 'GreaterEqual', 'Concat', 'Power',
        'Mutate',
      ]
      const result = lex(source)
      return isSuccessful(result)
        && tokenNames(result).join(' ') === expected.join(' ')
    }),

    test('recognizes the complete single-character inventory', () => {
      const source = '# ? : < > + - * / % ! ~ . [ ] ( ) { } , = @ ^ |'
      const expected = [
        'Hask', 'Question', 'Colon', 'Less', 'Greater', 'Plus', 'Minus',
        'Star', 'Slash', 'Percent', 'Bang', 'Tilde', 'Dot', 'LBracket',
        'RBracket', 'LParen', 'RParen', 'LCurly', 'RCurly', 'Comma',
        'Assign', 'At', 'Caret', 'Alternative',
      ]
      const result = lex(source)
      return isSuccessful(result)
        && tokenNames(result).join(' ') === expected.join(' ')
    }),

    test('keeps concatenation distinct from two addition tokens', () => {
      const result = lex('+ ++ +')
      return isSuccessful(result)
        && tokenNames(result).join(' ') === 'Plus Concat Plus'
    }),
  ]),

  suite('NEXT lexer — Decimal-dot and optional-access boundary', [
    test('lexes .5 as one Number literal', () =>
      isSingleToken('.5', NumberLiteral)),

    test('does not form OptionalDot before a decimal digit', () => {
      const result = lex('value?.5')
      return isSuccessful(result)
        && tokenNames(result).join(' ') ===
          'Identifier Question NumberLiteral'
        && result.tokens[2].image === '.5'
    }),

    test('forms OptionalDot before an identifier', () => {
      const result = lex('value?.field')
      return isSuccessful(result)
        && tokenNames(result).join(' ') ===
          'Identifier OptionalDot Identifier'
    }),
  ]),

  suite('NEXT lexer — Templates', [
    test('tokenizes template chunks and interpolation boundaries', () => {
      const result = lex('`Hello ${name}`')
      return isSuccessful(result)
        && tokenNames(result).join(' ') === [
          'TemplateStart',
          'TemplateChunk',
          'InterpolationStart',
          'Identifier',
          'InterpolationRCurly',
          'TemplateEnd',
        ].join(' ')
        && result.tokens[1].image === 'Hello '
    }),

    test('supports templates nested inside interpolations', () => {
      const result = lex('`outer ${`inner ${name}`}`')
      return isSuccessful(result)
        && tokenNames(result).join(' ') === [
          'TemplateStart',
          'TemplateChunk',
          'InterpolationStart',
          'TemplateStart',
          'TemplateChunk',
          'InterpolationStart',
          'Identifier',
          'InterpolationRCurly',
          'TemplateEnd',
          'InterpolationRCurly',
          'TemplateEnd',
        ].join(' ')
    }),

    test('keeps interpolation open through nested expression braces', () => {
      const result = lex('`x ${f({ a: { b: 1 } })}`')
      return isSuccessful(result)
        && tokenNames(result).join(' ') === [
          'TemplateStart',
          'TemplateChunk',
          'InterpolationStart',
          'Identifier',
          'LParen',
          'InterpolationLCurly',
          'Identifier',
          'Colon',
          'InterpolationLCurly',
          'Identifier',
          'Colon',
          'NumberLiteral',
          'InterpolationRCurly',
          'InterpolationRCurly',
          'RParen',
          'InterpolationRCurly',
          'TemplateEnd',
        ].join(' ')
    }),

    test('keeps escaped backticks and interpolation markers in chunks', () => {
      const source = '`escaped \\` and \\${name}; real ${value}`'
      const result = lex(source)
      return isSuccessful(result)
        && tokenNames(result).join(' ') === [
          'TemplateStart',
          'TemplateChunk',
          'InterpolationStart',
          'Identifier',
          'InterpolationRCurly',
          'TemplateEnd',
        ].join(' ')
        && result.tokens[1].image ===
          'escaped \\` and \\${name}; real '
        && result.tokens[3].image === 'value'
    }),

    test('tracks positions through multiline template chunks', () => {
      const result = lex('`first\nsecond ${value}`')
      const interpolation = result.tokens[2]
      const value = result.tokens[3]
      return isSuccessful(result)
        && interpolation.startLine === 2
        && interpolation.startColumn === 8
        && value.startLine === 2
        && value.startColumn === 10
    }),
  ]),
]
