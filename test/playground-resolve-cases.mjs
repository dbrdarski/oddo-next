import { parse } from '../src/parser/index.mjs'
import { Tuple, Record } from '../src/intern.mjs'
import { Canonical } from '../src/canonical.mjs'
import { Add, Sub, Mul, Div, Equals } from '../src/domain.mjs'
import { resolveNode } from '../playground-resolve.mjs'

const suite = (title, cases) => ({ title, cases })
const test = (label, run) => ({ label, run })

const valuesOf = source => Array.from(
  parse(source).ast.body,
  statement => statement.value ?? statement.expression
)

export const playgroundResolveSuites = [
  suite('NEXT playground — Lazy closed-expression resolution', [
    test('resolves a Number literal to its stored Oddo Number', () => {
      const [node] = valuesOf('value = 1')
      return resolveNode(node) === node.value
    }),

    test('resolves supported arithmetic to existing expanded forms', () => {
      const [add, sub, mul, div] = valuesOf([
        'add = 1 + 2',
        'sub = 5 - 2',
        'mul = 2 * 3',
        'div = 6 / 2',
      ].join('\n'))

      return resolveNode(add) === Add(1, 2)
        && resolveNode(sub) === Sub(5, 2)
        && resolveNode(mul) === Mul(2, 3)
        && resolveNode(div) === Div(6, 2)
    }),

    test('uses existing canonicalization for nested arithmetic', () => {
      const [nested, zero] = valuesOf([
        'nested = (1 + 2) + 3',
        'zero = 0 * 2',
      ].join('\n'))

      return resolveNode(nested)[Canonical] === Equals(6)
        && resolveNode(zero)[Canonical] === Equals(0)
    }),

    test('resolves closed Tuples and Records through their existing doors', () => {
      const [tuple, record] = valuesOf([
        'tuple = [1, "two"]',
        'record = { first: 1, second: "two" }',
      ].join('\n'))

      return resolveNode(tuple) === Tuple(1, 'two')
        && resolveNode(record) === Record({ first: 1, second: 'two' })
    }),

    test('one structural AST node reuses one resolved value', () => {
      const [first, second] = valuesOf([
        'first = 1 + 2',
        'second = 1 + 2',
      ].join('\n'))

      const resolved = resolveNode(first)
      return first === second
        && resolved === resolveNode(second)
        && resolved === Add(1, 2)
    }),

    test('leaves calls identifiers and unsupported operators unresolved', () => {
      const [call, identifier, remainder] = valuesOf([
        'call = Range(0, 1)',
        'identifier = value',
        'remainder = 5 % 2',
      ].join('\n'))

      return resolveNode(call) == null
        && resolveNode(identifier) == null
        && resolveNode(remainder) == null
    }),

    test('leaves spreads computed fields shorthand and rejected operations unresolved', () => {
      const [tuple, computed, shorthand, rejected] = valuesOf([
        'tuple = [1, ...values]',
        'computed = { [key]: 1 }',
        'shorthand = { value }',
        'rejected = "x" + 1',
      ].join('\n'))

      return resolveNode(tuple) == null
        && resolveNode(computed) == null
        && resolveNode(shorthand) == null
        && resolveNode(rejected) == null
    }),
  ]),
]
