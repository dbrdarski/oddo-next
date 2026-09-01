import { parse } from '../src/parser/index.mjs'

const suite = (title, cases) => ({ title, cases })
const test = (label, run) => ({ label, run })

const astOf = source => parse(source).ast
const rejects = source => {
  try {
    parse(source)
    return false
  } catch {
    return true
  }
}

const bindingValue = ast => ast.body[0].value
const expressionValue = ast => ast.body[0].expression

export const parserSurfaceGapSuites = [
  suite('NEXT parser — Settled surface coverage', [
    test('tokenizes 5.foo structurally and leaves receiver validity to analysis', () => {
      const member = expressionValue(astOf('5.foo'))
      return member.type === 'MemberExpression'
        && member.object.type === 'NumberLiteral'
        && member.object.raw === '5'
        && member.property.type === 'Identifier'
        && member.property.name === 'foo'
        && !member.optional
    }),

    test('allows Match after a pipe', () => {
      const match = expressionValue(astOf([
        'value |> transform :: {',
        '  _ => 1',
        '}',
      ].join('\n')))

      return match.type === 'MatchExpression'
        && match.value.type === 'BinaryExpression'
        && match.value.operator === '|>'
        && match.value.left.name === 'value'
        && match.value.right.name === 'transform'
        && match.arms[0].result.raw === '1'
    }),

    test('left-nests chained Match expressions', () => {
      const outer = expressionValue(astOf([
        'value :: {',
        '  _ => 1',
        '} :: {',
        '  _ => 2',
        '}',
      ].join('\n')))

      return outer.type === 'MatchExpression'
        && outer.value.type === 'MatchExpression'
        && outer.value.value.name === 'value'
        && outer.value.arms[0].result.raw === '1'
        && outer.arms[0].result.raw === '2'
    }),

    test('allows a completed Match to feed a backward pipe', () => {
      const pipe = expressionValue(astOf([
        'value :: {',
        '  _ => 1',
        '}',
        '<| consume',
      ].join('\n')))

      return pipe.type === 'BinaryExpression'
        && pipe.operator === '<|'
        && pipe.left.type === 'MatchExpression'
        && pipe.left.value.name === 'value'
        && pipe.right.name === 'consume'
    }),

    test('classifies a computed-key arrow body as a Record', () => {
      const fn = bindingValue(astOf('make = x => { [key]: x }'))
      const body = fn.body

      return fn.type === 'ArrowFunctionExpression'
        && body.type === 'RecordExpression'
        && body.fields.length === 1
        && body.fields[0].type === 'RecordField'
        && body.fields[0].computed
        && body.fields[0].key.name === 'key'
        && body.fields[0].value.name === 'x'
    }),

    test('starts a fresh numbering scope for each nested hask', () => {
      const outer = bindingValue(astOf('nested = # target(_, # inner(_))'))
      const inner = outer.body.arguments[1]

      return outer.type === 'HaskExpression'
        && outer.body.arguments[0].type === 'HoleExpression'
        && outer.body.arguments[0].index == null
        && inner.type === 'HaskExpression'
        && inner.body.arguments[0].type === 'HoleExpression'
        && inner.body.arguments[0].index == null
    }),

    test('retains plain and indexed outer-hask escapes in arm patterns', () => {
      const plain = bindingValue(astOf([
        'plain = #(_ :: {',
        '  ^_ => 1',
        '  _ => 2',
        '})',
      ].join('\n')))
      const indexed = bindingValue(astOf([
        'indexed = #(_1 :: {',
        '  ^_1 => 1',
        '  _ => 2',
        '})',
      ].join('\n')))
      const plainEscape = plain.body.expression.arms[0].pattern
      const indexedEscape = indexed.body.expression.arms[0].pattern

      return plainEscape.type === 'HaskEscapePattern'
        && plainEscape.index == null
        && indexedEscape.type === 'HaskEscapePattern'
        && indexedEscape.index === 1
    }),

    test('requires Match patterns and keeps guard-only exits inside Blocks', () =>
      rejects('value :: {\n  when allowed => result\n}')
      && rejects('value :: {\n  => result\n}')
      && rejects('when allowed => result')
      && !rejects([
        'choose = value => {',
        '  when allowed => result',
        '  => fallback',
        '}',
      ].join('\n'))),

    test('does not promote Blocks to unrestricted primary expressions', () =>
      rejects('value = {\n  local = 1\n  => local\n}')),

    test('parses import("x") as an ordinary contextual-identifier call', () => {
      const call = bindingValue(astOf('result = import("x")'))

      return call.type === 'CallExpression'
        && call.callee.type === 'Identifier'
        && call.callee.name === 'import'
        && call.arguments.length === 1
        && call.arguments[0].type === 'StringLiteral'
        && call.arguments[0].value === 'x'
    }),
  ]),

  suite('NEXT parser — Explicitly rejected surface coverage', [
    test('rejects postfix decrement spelling', () => rejects('x--')),

    test('rejects bitwise operators', () => rejects('left & right')),

    test('rejects import-star syntax', () =>
      rejects('import * as Contracts from Source')),

    test('rejects module blocks', () => rejects('module Geometry {}')),

    test('rejects Tuple elision holes', () => rejects('value = [1,,2]')),

    test('rejects invalid template escapes', () =>
      rejects('value = `invalid \\q`')),

    test('rejects unterminated templates', () =>
      rejects('value = `unterminated ${name}')),
  ]),
]
