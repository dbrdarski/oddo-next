import { NextLexer } from '../src/parser/tokens.mjs'
import { nextParser } from '../src/parser/parser.mjs'

const suite = (title, cases) => ({ title, cases })
const test = (label, run) => ({ label, run })

const parse = source => {
  const lex = NextLexer.tokenize(source)
  nextParser.input = lex.tokens
  const cst = nextParser.program()
  return {
    cst,
    lexerErrors: lex.errors,
    parserErrors: nextParser.errors,
  }
}

const accepted = source => {
  const result = parse(source)
  return result.lexerErrors.length === 0 && result.parserErrors.length === 0
}

const rejected = source => !accepted(source)

const descendants = (node, name, found = []) => {
  if (node?.name === name) found.push(node)
  for (const values of Object.values(node?.children ?? {})) {
    for (const value of values) {
      if (value?.name) descendants(value, name, found)
    }
  }
  return found
}

const first = (node, name) => descendants(node, name)[0]

const operatorImages = node => [
  ...(node?.children?.operator ?? []),
].sort((left, right) => left.startOffset - right.startOffset)
  .map(token => token.image)

export const parserGrammarSuites = [
  suite('NEXT parser — Programs and contextual statements', [
    test('parses a module header, imports, exports, and where assertion', () =>
      accepted([
        'module Geometry.Transform',
        'import { Range, Equals, } from Contracts',
        'import Tuple',
        'value where (Number, Range(0, 10),) => Number',
        'export value = 1',
      ].join('\n'))),

    test('retains contextual words as ordinary identifiers elsewhere', () =>
      accepted([
        'module = 1',
        'import = 2',
        'export = 3',
        'from = 4',
        'when = 5',
        'where = 6',
      ].join('\n'))),

    test('requires every following statement to begin on a later line', () =>
      rejected('left = 1 right = 2')),

    test('does not admit a module header after the first statement', () =>
      rejected('value = 1\nmodule Later')),

    test('separates line-leading Tuple forms only when postfix cannot complete', () => {
      const binding = parse('x\n[y] = pair')
      const emptyTuple = parse('x\n[]')
      const tuple = parse('x\n[a, b]')
      const greedyIndex = parse('x\n[y]')
      return [binding, emptyTuple, tuple, greedyIndex]
        .every(result => result.parserErrors.length === 0)
        && (binding.cst.children.statement?.length ?? 0) === 2
        && (emptyTuple.cst.children.statement?.length ?? 0) === 2
        && (tuple.cst.children.statement?.length ?? 0) === 2
        && (greedyIndex.cst.children.statement?.length ?? 0) === 1
    }),
  ]),

  suite('NEXT parser — Functions, calls, blocks, and exits', [
    test('parses ordinary, destructured, rest, and nested arrow parameters', () =>
      accepted([
        'identity = value => value',
        'pick = ([left, right], { name }, ...rest) => [left, name, ...rest]',
        'curry = left => right => left + right',
      ].join('\n'))),

    test('parses calls with multiple spreads and ordinary arguments', () =>
      accepted('result = target(first, ...middle, last, ...tail)')),

    test('parses multiline calculations and guarded block exits', () =>
      accepted([
        'calculate = x => {',
        '  doubled = x * 2',
        '  when doubled >',
        '    100 => 100',
        '  => doubled',
        '}',
      ].join('\n'))),

    test('treats a split function arrow as a block exit, not a lambda', () =>
      rejected('(left, right)\n=> left + right')),

    test('does not consume a following parenthesized arrow as a call', () => {
      const empty = parse('x\n() => y')
      const multiple = parse('x\n(a, b) => a')
      const greedyCall = parse('x\n(a)')
      return [empty, multiple, greedyCall]
        .every(result => result.parserErrors.length === 0)
        && (empty.cst.children.statement?.length ?? 0) === 2
        && (multiple.cst.children.statement?.length ?? 0) === 2
        && (greedyCall.cst.children.statement?.length ?? 0) === 1
    }),

    test('allows block exits only inside a Block', () =>
      rejected('value = 1\n=> value')),

    test('rejects literal, default, and named parameter/argument syntax', () =>
      rejected('literal = (0) => 0') &&
      rejected('defaults = (x = 1) => x') &&
      rejected('call = target(name = value)')),
  ]),

  suite('NEXT parser — Expression precedence and pipes', [
    test('nests multiplication below addition in the CST', () => {
      const result = parse('value = a + b * c')
      const additive = first(result.cst, 'additiveExpression')
      const products = additive?.children?.operand ?? []
      return result.parserErrors.length === 0
        && operatorImages(additive).join(' ') === '+'
        && products.length === 2
        && operatorImages(products[1]).join(' ') === '*'
    }),

    test('keeps ?? and || on one ordered left-fold tier', () => {
      const result = parse('value = a ?? b || c')
      return result.parserErrors.length === 0
        && operatorImages(first(result.cst, 'nullOrExpression'))
          .join(' ') === '?? ||'
    }),

    test('preserves Python-style unary/exponent structure', () => {
      const negativeSquare = parse('value = -x ** 2')
      const negativeExponent = parse('value = 2 ** -3')
      return negativeSquare.parserErrors.length === 0
        && negativeExponent.parserErrors.length === 0
        && first(negativeSquare.cst, 'unaryExpression')
          .children.operator[0].image === '-'
        && first(negativeSquare.cst, 'powerExpression')
          .children.operator[0].image === '**'
        && first(negativeExponent.cst, 'powerExpression')
          .children.operator[0].image === '**'
        && descendants(negativeExponent.cst, 'unaryExpression')
          .some(node => node.children.operator?.[0]?.image === '-')
    }),

    test('parses relational chains for later semantic rejection', () =>
      accepted('a < b < c')),

    test('preserves distinct addition and concatenation operators', () => {
      const result = parse('value = 1 + 2 ++ suffix')
      return result.parserErrors.length === 0
        && operatorImages(first(result.cst, 'additiveExpression'))
          .join(' ') === '+ ++'
    }),

    test('allows a completed Match to feed a forward pipe', () => {
      const result = parse([
        'value :: {',
        '  _ => 1',
        '}',
        '|> consume',
      ].join('\n'))
      const segment = first(result.cst, 'matchSegment')
      return result.parserErrors.length === 0
        && segment?.children?.pipeContinuation?.length === 1
        && operatorImages(segment.children.pipeContinuation[0])
          .join(' ') === '|>'
    }),

    test('keeps each pipe chain homogeneous', () =>
      accepted('value |> first |> second')
      && accepted('first <| second <| value')
      && rejected('value |> first <| second')),
  ]),

  suite('NEXT parser — Hasks and structures', [
    test('parses holes, indexed holes, grouped pipes, and rest holes', () =>
      accepted('# operation(_2, _, _1)')
      && accepted('#(_ |> transform)')
      && accepted('# target(_1, ..._2)')),

    test('parses Tuple elements and Record fields with middle spreads', () =>
      accepted('tuple = [first, ...middle, last,]')
      && accepted('record = { name, [key]: value, ...base, }')),

    test('distinguishes Record and Block arrow bodies by first field shape', () => {
      const record = parse('make = x => { value: x }')
      const block = parse('make = x => {\n  value = x\n  => value\n}')
      return record.parserErrors.length === 0
        && block.parserErrors.length === 0
        && descendants(record.cst, 'recordLiteral').length === 1
        && descendants(record.cst, 'block').length === 0
        && descendants(block.cst, 'block').length === 1
    }),

    test('parses demanding/total access, indexing, and every slice form', () =>
      accepted([
        'plain = value.field[index]',
        'total = value?.field?.[index]',
        'a = tuple[start...end]',
        'b = tuple[...end]',
        'c = tuple[start...]',
        'd = tuple[...]',
      ].join('\n'))),

    test('parses nested template interpolations and expression braces', () =>
      accepted('`outer ${`inner ${value}`} ${f({ a: 1 })}`')),
  ]),

  suite('NEXT parser — Patterns and Match', [
    test('does not consume a following negative or Tuple arm into the prior result', () =>
      accepted([
        'value :: {',
        '  0 => base',
        '  -1 => negative',
        '  [first, ...rest] => rest',
        '}',
      ].join('\n'))),

    test('parses literal, contract, tuple-rest, record-rest, pin, and alternatives', () =>
      accepted([
        'value :: {',
        '  -1 | 0 => "small"',
        '  Number => "number"',
        '  [first, ...rest, last] => rest',
        '  { name, ..._ } when allowed => name',
        '  ^expected => expected',
        '  _ => null',
        '}',
      ].join('\n'))),

    test('treats a pattern spelled when as a pattern outside guard seat', () => {
      const result = parse('value :: {\n  when => 1\n}')
      const arm = first(result.cst, 'arm')
      return result.parserErrors.length === 0
        && arm?.children?.pattern?.length === 1
        && arm.children.guard === undefined
    }),

    test('requires every Match arm to begin on a new line', () =>
      rejected('value :: { _ => 1 }')),

    test('requires at least one Match arm', () => rejected('value :: {}')),

    test('leaves block-valued Match results rejected pending a ruling', () =>
      rejected([
        'value :: {',
        '  _ => {',
        '    result = 1',
        '    => result',
        '  }',
        '}',
      ].join('\n'))),
  ]),

  suite('NEXT parser — Privileged declarations and mutation', [
    test('parses the closed resident declaration inventory', () =>
      accepted([
        '@state count = 0',
        '@mutable cache = {}',
        '@computed doubled = x => x * 2',
        '@mutate update = value => {',
        '  count := value',
        '}',
        '@effect load = () => {}',
        '@reactive () => {}',
      ].join('\n'))),

    test('makes an ordinary @ binding {} a Record but an @ arrow {} a Block', () => {
      const state = parse('@state value = {}')
      const effect = parse('@effect run = () => {}')
      return state.parserErrors.length === 0
        && effect.parserErrors.length === 0
        && descendants(state.cst, 'recordLiteral').length === 1
        && descendants(state.cst, 'block').length === 0
        && descendants(effect.cst, 'block').length === 1
    }),

    test('parses every mutation operator on a legal surface path', () =>
      [
        ':=', '+:=', '-:=', '*:=', '/:=', '%:=', '**:=',
        '&&:=', '||:=', '??:=',
      ].every(operator => accepted(`state.path[begin...end] ${operator} value`))),

    test('rejects unknown residents and anonymous non-reactive declarations', () =>
      rejected('@unknown value = 1')
      && rejected('@effect () => {}')),

    test('rejects postfix mutation while retaining binary concatenation', () =>
      rejected('value++') && accepted('value = "a" ++ "b"')),
  ]),

  suite('NEXT parser — CST source locations', [
    test('tracks a multiline statement through its final concrete token', () => {
      const source = 'value = 1 +\n  2'
      const result = parse(source)
      const statement = first(result.cst, 'statement')
      return result.parserErrors.length === 0
        && statement.location.startOffset === 0
        && statement.location.endOffset === source.length - 1
        && statement.location.startLine === 1
        && statement.location.startColumn === 1
        && statement.location.endLine === 2
        && statement.location.endColumn === 3
    }),

    test('gives a nonempty Program the complete concrete source span', () => {
      const source = 'first = 1\nsecond = 2'
      const result = parse(source)
      return result.parserErrors.length === 0
        && result.cst.location.startOffset === 0
        && result.cst.location.endOffset === source.length - 1
        && result.cst.location.startLine === 1
        && result.cst.location.endLine === 2
    }),

    test('exposes the empty CST sentinel for AST zero-width normalization', () => {
      const result = parse('')
      return result.parserErrors.length === 0
        && result.cst.location.startOffset === -1
        && result.cst.location.endOffset === -1
        && result.cst.location.startLine === -1
        && result.cst.location.endLine === -1
    }),
  ]),
]
