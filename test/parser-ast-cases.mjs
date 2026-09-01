import { NextLexer } from '../src/parser/tokens.mjs'
import { nextParser } from '../src/parser/parser.mjs'
import { buildSurfaceAst } from '../src/parser/ast-builder.mjs'
import {
  parse as parseSource,
  parseCst as parseSourceCst,
} from '../src/parser/index.mjs'

const suite = (title, cases) => ({ title, cases })
const test = (label, run) => ({ label, run })

const parseCst = source => {
  const lex = NextLexer.tokenize(source)
  if (lex.errors.length > 0) {
    throw new Error(`Unexpected lexer error: ${lex.errors[0].message}`)
  }

  nextParser.input = lex.tokens
  const cst = nextParser.program()
  if (nextParser.errors.length > 0) {
    throw new Error(`Unexpected parser error: ${nextParser.errors[0].message}`)
  }

  return cst
}

const parseAst = source => buildSurfaceAst(parseCst(source), source)

const builderRejects = source => {
  const cst = parseCst(source)
  try {
    buildSurfaceAst(cst, source)
    return false
  } catch (error) {
    return error instanceof SyntaxError
  }
}

const bindingValue = (ast, index = 0) => ast.body[index].value
const expressionValue = (ast, index = 0) => ast.body[index].expression

const positionAt = (source, offset) => {
  let line = 1
  let column = 1

  for (let index = 0; index < offset; index += 1) {
    const character = source[index]
    if (character === '\r') {
      if (source[index + 1] === '\n' && index + 1 < offset) index += 1
      line += 1
      column = 1
    } else if (character === '\n' || character === '\u2028' || character === '\u2029') {
      line += 1
      column = 1
    } else {
      column += 1
    }
  }

  return { line, column }
}

const everyNodeHasExactCoordinates = (source, value, parentSpan = null) => {
  if (Array.isArray(value)) {
    return value.every(child =>
      everyNodeHasExactCoordinates(source, child, parentSpan))
  }
  if (value == null || typeof value !== 'object') return true

  const isNode = typeof value.type === 'string'
  const span = isNode ? value.span : parentSpan

  if (isNode) {
    if (span == null ||
      !Number.isInteger(span.startOffset) ||
      !Number.isInteger(span.endOffset) ||
      span.startOffset < 0 ||
      span.endOffset < span.startOffset ||
      span.endOffset > source.length) return false

    const start = positionAt(source, span.startOffset)
    const end = positionAt(source, span.endOffset)
    if (span.startLine !== start.line ||
      span.startColumn !== start.column ||
      span.endLine !== end.line ||
      span.endColumn !== end.column) return false

    if (parentSpan &&
      (span.startOffset < parentSpan.startOffset ||
        span.endOffset > parentSpan.endOffset)) return false
  }

  return Object.entries(value)
    .filter(([key]) => key !== 'span')
    .every(([, child]) => everyNodeHasExactCoordinates(source, child, span))
}

export const parserAstSuites = [
  suite('NEXT parser — Public pipeline', [
    test('retains tokens and CST before adding the Surface AST', () => {
      const cstResult = parseSourceCst('value = 1')
      const result = parseSource('value = 1')
      return cstResult.tokens.length === 3
        && cstResult.cst.name === 'program'
        && cstResult.lexerErrors.length === 0
        && cstResult.parserErrors.length === 0
        && !Object.hasOwn(cstResult, 'ast')
        && result.cst.name === 'program'
        && result.ast.type === 'Program'
        && result.ast.body[0].type === 'BindingStatement'
    }),
  ]),

  suite('NEXT Surface AST — Programs and declarations', [
    test('builds module, import, where, and export nodes without resolving contracts', () => {
      const source = [
        'module Geometry.Transform',
        'import { Range, Equals, } from Contracts',
        'import Tuple',
        'value where (Number, Range(0, 10),) => Number',
        'export value = 1',
      ].join('\n')
      const ast = parseAst(source)
      const [selected, moduleImport, assertion, exported] = ast.body

      return ast.type === 'Program'
        && ast.moduleHeader.name.parts.map(part => part.name).join('.') ===
          'Geometry.Transform'
        && selected.type === 'ImportStatement'
        && selected.form === 'selected'
        && selected.names.map(name => name.name).join(' ') === 'Range Equals'
        && selected.source.parts[0].name === 'Contracts'
        && moduleImport.form === 'module'
        && moduleImport.source.parts[0].name === 'Tuple'
        && assertion.type === 'WhereStatement'
        && assertion.parameters[0].type === 'Identifier'
        && assertion.parameters[1].type === 'CallExpression'
        && assertion.parameters[1].callee.name === 'Range'
        && assertion.result.name === 'Number'
        && exported.type === 'ExportStatement'
        && exported.declaration.type === 'BindingStatement'
        && exported.declaration.value.raw === '1'
    }),

    test('keeps a contract expression as an ordinary surface call', () => {
      const value = bindingValue(parseAst(
        'Percent = Union(Number, Range(0, 100))'
      ))

      return value.type === 'CallExpression'
        && value.callee.type === 'Identifier'
        && value.callee.name === 'Union'
        && value.arguments[0].type === 'Identifier'
        && value.arguments[0].name === 'Number'
        && value.arguments[1].type === 'CallExpression'
        && value.arguments[1].callee.name === 'Range'
    }),

    test('keeps contextual words as ordinary identifier expressions', () => {
      const ast = parseAst([
        'module = import',
        'exported = export',
        'guard = when',
        'assertion = where',
      ].join('\n'))

      return ast.moduleHeader == null
        && ast.body.every(statement => statement.type === 'BindingStatement')
        && ast.body.map(statement => statement.value.name).join(' ') ===
          'import export when where'
    }),

    test('enforces module export and literal Record-key surface rules', () =>
      builderRejects('export value = 1')
      && builderRejects('record = { name: 1, name: 2 }')
      && !builderRejects('record = { ...base, name: 1, [key]: 2 }')),
  ]),

  suite('NEXT Surface AST — Functions, calls, blocks, and exits', [
    test('builds destructured and rest parameters with a value-producing block', () => {
      const source = [
        'calculate = ([left, right], { name }, ...rest) => {',
        '  doubled = left * 2',
        '  when doubled > 100 => 100',
        '  _ => target(doubled, ...rest)',
        '}',
      ].join('\n')
      const fn = bindingValue(parseAst(source))
      const [tuple, record, rest] = fn.parameters
      const [calculation, guarded, finalExit] = fn.body.body

      return fn.type === 'ArrowFunctionExpression'
        && tuple.type === 'TuplePattern'
        && tuple.elements.map(element => element.name.name).join(' ') ===
          'left right'
        && record.type === 'RecordPattern'
        && record.fields[0].type === 'RecordPatternField'
        && record.fields[0].shorthand
        && rest.type === 'RestPattern'
        && rest.argument.name.name === 'rest'
        && fn.body.type === 'BlockExpression'
        && calculation.value.type === 'BinaryExpression'
        && calculation.value.operator === '*'
        && guarded.type === 'BlockExitStatement'
        && guarded.guard.operator === '>'
        && guarded.result.raw === '100'
        && finalExit.type === 'BlockExitStatement'
        && finalExit.guard == null
        && finalExit.wildcard
        && finalExit.result.type === 'CallExpression'
        && finalExit.result.arguments[1].type === 'SpreadElement'
    }),

    test('preserves right-associated nested arrow functions', () => {
      const outer = bindingValue(parseAst('add = left => right => left + right'))
      return outer.type === 'ArrowFunctionExpression'
        && outer.parameters[0].name.name === 'left'
        && outer.body.type === 'ArrowFunctionExpression'
        && outer.body.parameters[0].name.name === 'right'
        && outer.body.body.type === 'BinaryExpression'
        && outer.body.body.operator === '+'
    }),

    test('distinguishes Record and Block arrow bodies in the AST', () => {
      const ast = parseAst([
        'record = x => { value: x }',
        'block = x => {',
        '  value = x',
        '  => value',
        '}',
      ].join('\n'))

      return bindingValue(ast, 0).body.type === 'RecordExpression'
        && bindingValue(ast, 1).body.type === 'BlockExpression'
    }),
  ]),

  suite('NEXT Surface AST — Precedence and associativity', [
    test('places multiplication and exponentiation below addition', () => {
      const value = bindingValue(parseAst('result = a + b * c ** -d'))
      return value.type === 'BinaryExpression'
        && value.operator === '+'
        && value.left.name === 'a'
        && value.right.operator === '*'
        && value.right.left.name === 'b'
        && value.right.right.operator === '**'
        && value.right.right.left.name === 'c'
        && value.right.right.right.type === 'UnaryExpression'
        && value.right.right.right.operator === '-'
        && value.right.right.right.argument.name === 'd'
    }),

    test('preserves Python-style unary/exponent interaction', () => {
      const ast = parseAst([
        'negativeSquare = -x ** 2',
        'negativeExponent = 2 ** -3',
      ].join('\n'))
      const square = bindingValue(ast, 0)
      const exponent = bindingValue(ast, 1)

      return square.type === 'UnaryExpression'
        && square.operator === '-'
        && square.argument.type === 'BinaryExpression'
        && square.argument.operator === '**'
        && exponent.type === 'BinaryExpression'
        && exponent.operator === '**'
        && exponent.right.type === 'UnaryExpression'
        && exponent.right.operator === '-'
    }),

    test('left-folds the shared ?? and || tier in source order', () => {
      const value = bindingValue(parseAst('result = a ?? b || c'))
      return value.type === 'BinaryExpression'
        && value.operator === '||'
        && value.left.type === 'BinaryExpression'
        && value.left.operator === '??'
        && value.left.left.name === 'a'
        && value.left.right.name === 'b'
        && value.right.name === 'c'
    }),

    test('right-associates nested ternaries', () => {
      const value = bindingValue(parseAst('result = a ? b : c ? d : e'))
      return value.type === 'ConditionalExpression'
        && value.test.name === 'a'
        && value.consequent.name === 'b'
        && value.alternate.type === 'ConditionalExpression'
        && value.alternate.test.name === 'c'
        && value.alternate.consequent.name === 'd'
        && value.alternate.alternate.name === 'e'
    }),

    test('left-associates forward pipes and right-associates backward pipes', () => {
      const ast = parseAst([
        'forward = value |> first |> second',
        'backward = first <| second <| value',
      ].join('\n'))
      const forward = bindingValue(ast, 0)
      const backward = bindingValue(ast, 1)

      return forward.operator === '|>'
        && forward.left.operator === '|>'
        && forward.left.left.name === 'value'
        && forward.left.right.name === 'first'
        && forward.right.name === 'second'
        && backward.operator === '<|'
        && backward.left.name === 'first'
        && backward.right.operator === '<|'
        && backward.right.left.name === 'second'
        && backward.right.right.name === 'value'
    }),

    test('preserves parentheses instead of erasing surface grouping', () => {
      const value = bindingValue(parseAst('result = (a + b) * c'))
      return value.operator === '*'
        && value.left.type === 'ParenthesizedExpression'
        && value.left.expression.operator === '+'
        && value.right.name === 'c'
    }),

    test('left-folds relational chains for later semantic rejection', () => {
      const value = expressionValue(parseAst('a < b < c'))
      return value.operator === '<'
        && value.left.operator === '<'
        && value.left.left.name === 'a'
        && value.left.right.name === 'b'
        && value.right.name === 'c'
    }),
  ]),

  suite('NEXT Surface AST — Structures, access, and templates', [
    test('builds calls, Tuples, Records, computed fields, and spreads', () => {
      const ast = parseAst([
        'call = target(first, ...middle, last)',
        'tuple = [first, ...middle, last]',
        'record = { name, fixed: 1, [key]: value, ...base }',
      ].join('\n'))
      const call = bindingValue(ast, 0)
      const tuple = bindingValue(ast, 1)
      const record = bindingValue(ast, 2)

      return call.type === 'CallExpression'
        && call.arguments[1].type === 'SpreadElement'
        && tuple.type === 'TupleExpression'
        && tuple.elements[1].type === 'SpreadElement'
        && record.type === 'RecordExpression'
        && record.fields[0].shorthand
        && record.fields[0].value == null
        && record.fields[1].value.raw === '1'
        && record.fields[2].computed
        && record.fields[2].key.name === 'key'
        && record.fields[3].type === 'SpreadElement'
    }),

    test('builds demanding and one-step total postfix access distinctly', () => {
      const value = bindingValue(parseAst(
        'result = root?.field.child?.[index][start...end]'
      ))

      return value.type === 'SliceExpression'
        && value.start.name === 'start'
        && value.end.name === 'end'
        && value.object.type === 'IndexExpression'
        && value.object.optional
        && value.object.index.name === 'index'
        && value.object.object.type === 'MemberExpression'
        && !value.object.object.optional
        && value.object.object.property.name === 'child'
        && value.object.object.object.type === 'MemberExpression'
        && value.object.object.object.optional
        && value.object.object.object.property.name === 'field'
    }),

    test('keeps all four slice spellings structurally distinct', () => {
      const ast = parseAst([
        'both = value[start...end]',
        'upper = value[...end]',
        'lower = value[start...]',
        'all = value[...]',
      ].join('\n'))
      const values = ast.body.map(statement => statement.value)

      return values.every(value => value.type === 'SliceExpression')
        && values[0].start.name === 'start'
        && values[0].end.name === 'end'
        && values[1].start == null
        && values[1].end.name === 'end'
        && values[2].start.name === 'start'
        && values[2].end == null
        && values[3].start == null
        && values[3].end == null
    }),

    test('retains raw and decoded String and template content', () => {
      const ast = parseAst([
        'plain = "line\\nnext"',
        'message = `Hello ${name}!`',
      ].join('\n'))
      const plain = bindingValue(ast, 0)
      const template = bindingValue(ast, 1)

      return plain.type === 'StringLiteral'
        && plain.raw === '"line\\nnext"'
        && plain.value === 'line\nnext'
        && template.type === 'TemplateLiteral'
        && template.parts[0].type === 'TemplateElement'
        && template.parts[0].raw === 'Hello '
        && template.parts[1].type === 'Identifier'
        && template.parts[1].name === 'name'
        && template.parts[2].value === '!'
    }),
  ]),

  suite('NEXT Surface AST — Hasks, Match, and patterns', [
    test('builds indexed, plain, and rest hask holes without inventing parameters', () => {
      const hask = bindingValue(parseAst(
        'operation = # target(_2, _, _1, ..._4)'
      ))

      return hask.type === 'HaskExpression'
        && hask.body.type === 'CallExpression'
        && hask.body.arguments[0].type === 'HoleExpression'
        && hask.body.arguments[0].index === 2
        && hask.body.arguments[1].index == null
        && hask.body.arguments[2].index === 1
        && hask.body.arguments[3].type === 'SpreadElement'
        && hask.body.arguments[3].argument.index === 4
        && !Object.hasOwn(hask, 'parameters')
    }),

    test('builds the complete Match pattern family and a following pipe', () => {
      const source = [
        'value :: {',
        '  -1 | 0 => "small"',
        '  Number => "number"',
        '  [first, ...rest, last] => rest',
        '  { name, ..._ } when allowed => name',
        '  ^expected => expected',
        '  _ => null',
        '}',
        '|> consume',
      ].join('\n')
      const piped = expressionValue(parseAst(source))
      const match = piped.left
      const [alternatives, contract, tuple, record, pin, wildcard] = match.arms

      return piped.type === 'BinaryExpression'
        && piped.operator === '|>'
        && match.type === 'MatchExpression'
        && match.value.name === 'value'
        && piped.right.name === 'consume'
        && alternatives.pattern.type === 'AlternativePattern'
        && alternatives.pattern.alternatives.map(pattern => pattern.raw).join(' ') ===
          '-1 0'
        && contract.pattern.type === 'ContractPattern'
        && contract.pattern.name.name === 'Number'
        && tuple.pattern.type === 'TuplePattern'
        && tuple.pattern.elements[1].type === 'RestPattern'
        && record.pattern.type === 'RecordPattern'
        && record.pattern.fields[1].argument.type === 'WildcardPattern'
        && record.guard.name === 'allowed'
        && pin.pattern.type === 'PinPattern'
        && pin.pattern.name.name === 'expected'
        && wildcard.pattern.type === 'WildcardPattern'
        && wildcard.result.type === 'Identifier'
        && wildcard.result.name === 'null'
    }),

    test('classifies prelude constants as literals only in pattern position', () => {
      const match = expressionValue(parseAst([
        'value :: {',
        '  true => false',
        '  null => null',
        '}',
      ].join('\n')))

      return match.arms[0].pattern.type === 'LiteralPattern'
        && match.arms[0].pattern.literalKind === 'prelude'
        && match.arms[0].result.type === 'Identifier'
        && match.arms[1].pattern.type === 'LiteralPattern'
        && match.arms[1].result.type === 'Identifier'
    }),

    test('rejects only AST-level hask and pattern-shape violations', () =>
      builderRejects('_')
      && builderRejects('# target(_1, _3)')
      && builderRejects('value :: {\n  left | right => null\n}')),

    test('fills hask index gaps with plain holes and protects rest ownership', () =>
      parseAst('# target(_2, _)').body[0].expression.type === 'HaskExpression'
      && builderRejects('# target(_3, _)')
      && builderRejects('# target(_, _, ..._2)')
      && builderRejects('# 1')),

    test('allows hask escapes only from nested arm patterns', () =>
      parseAst('#(value :: {\n  ^_ => value\n})')
        .body[0].expression.type === 'HaskExpression'
      && builderRejects('value :: {\n  ^_ => value\n}')),

    test('rejects duplicate parameters, parameter pins, and multiple pattern rests', () =>
      builderRejects('f = (x, x) => x')
      && builderRejects('f = ([^outer]) => 1')
      && builderRejects('value :: {\n  [...left, ...right] => 1\n}')
      && builderRejects('value :: {\n  {...left, ...right} => 1\n}')),

    test('refuses only the two genuinely ambiguous guard families', () =>
      builderRejects('value :: {\n  pattern when x => y => z\n}')
      && builderRejects('value :: {\n  when when(x) => 1\n}')
      && builderRejects('value :: {\n  when when[x] => 1\n}')
      && builderRejects('value :: {\n  when when[...x] => 1\n}')
      && !builderRejects('value :: {\n  pattern when [x] => y => z\n}')
      && !builderRejects('value :: {\n  when when() => 1\n}')
      && !builderRejects('value :: {\n  when when(x,) => 1\n}')
      && !builderRejects('value :: {\n  when when(x, y) => 1\n}')
      && !builderRejects('value :: {\n  when when[x...] => 1\n}')),
  ]),

  suite('NEXT Surface AST — Privileged declarations and mutation', [
    test('builds resident declarations without introducing privileged expression forms', () => {
      const source = [
        '@state count = 0',
        '@mutate update = value => {',
        '  user.items[start...end] := replacement',
        '  count +:= value',
        '}',
        '@effect load = () => {}',
        '@reactive () => {}',
      ].join('\n')
      const ast = parseAst(source)
      const [state, mutator, effect, reactive] = ast.body
      const mutations = mutator.declaration.value.body.body

      return state.type === 'AtDeclaration'
        && state.resident.name === 'state'
        && state.declaration.type === 'BindingStatement'
        && mutator.resident.name === 'mutate'
        && mutations[0].type === 'MutationStatement'
        && mutations[0].target.type === 'SliceExpression'
        && mutations[0].operator === ':='
        && mutations[1].operator === '+:='
        && effect.declaration.value.body.type === 'BlockExpression'
        && reactive.declaration.type === 'ArrowFunctionExpression'
        && reactive.declaration.body.type === 'BlockExpression'
    }),
  ]),

  suite('NEXT Surface AST — Source provenance', [
    test('uses exact half-open offsets and exclusive end columns', () => {
      const source = [
        'value = [',
        '  1,',
        '  { name: "x" },',
        ']',
        '',
      ].join('\n')
      const ast = parseAst(source)
      const binding = ast.body[0]
      const tuple = binding.value
      const number = tuple.elements[0]
      const record = tuple.elements[1]
      const string = record.fields[0].value

      return JSON.stringify(ast.span) === JSON.stringify({
        startOffset: 0,
        endOffset: source.length,
        startLine: 1,
        startColumn: 1,
        endLine: 5,
        endColumn: 1,
      })
        && source.slice(binding.span.startOffset, binding.span.endOffset) ===
          source.trimEnd()
        && source.slice(tuple.span.startOffset, tuple.span.endOffset) === [
          '[',
          '  1,',
          '  { name: "x" },',
          ']',
        ].join('\n')
        && JSON.stringify(number.span) === JSON.stringify({
          startOffset: source.indexOf('1'),
          endOffset: source.indexOf('1') + 1,
          startLine: 2,
          startColumn: 3,
          endLine: 2,
          endColumn: 4,
        })
        && source.slice(record.span.startOffset, record.span.endOffset) ===
          '{ name: "x" }'
        && source.slice(string.span.startOffset, string.span.endOffset) === '"x"'
    }),

    test('gives every recursively reachable AST node exact source coordinates', () => {
      const source = [
        'module Example',
        'import { Number } from Contracts',
        'render = ([first, ...rest], { name }) => {',
        '  doubled = first * 2',
        '  when doubled > 10 => `Hello ${name}`',
        '  => [doubled, ...rest]',
        '}',
        'result = value :: {',
        '  Number => value?.field',
        '  _ => null',
        '}',
      ].join('\n')
      const ast = parseAst(source)

      return everyNodeHasExactCoordinates(source, ast)
        && ast.span.startOffset === 0
        && ast.span.endOffset === source.length
    }),

    test('tracks CRLF and Unicode line separators as single line advances', () => {
      const source = 'first = 1\r\nsecond = 2\u2028third = 3\u2029fourth = 4'
      const ast = parseAst(source)
      return everyNodeHasExactCoordinates(source, ast)
        && ast.body.map(statement => statement.span.startLine).join(' ') ===
          '1 2 3 4'
        && ast.span.endLine === 4
        && ast.span.endColumn === 11
    }),
  ]),
]
