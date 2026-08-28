// Test-only semantic reference model.
//
// This deliberately covers only the one-argument Number/Indeterminate slice
// needed to pressure-test contextual preparation. Its region algebra and emitted
// row order are test scaffolding, not production implementations. It reuses the
// canonical contract vocabulary instead of constructing parallel contract values.
// Unsupported algebra throws instead of pretending to be the future engine.

import { isContract } from '../src/contract.mjs'
import { Tuple } from '../src/intern.mjs'
import { _ } from '../src/match.mjs'
import { Number, Indeterminate } from '../src/numeric.mjs'
import {
  Mul, Numeric, Union, Difference, Equals, Top, Bottom
} from '../src/domain.mjs'
import { CallArgument, Arm, Match } from '../src/function.mjs'

export { Top, Bottom }

export const Expanded = Symbol('Expanded')
export const Accepted = Symbol('Accepted')
export const ResultContract = Symbol('ResultContract')
export const Canonical = Symbol('Canonical')
export const Obligations = Symbol('Obligations')

const Row = Symbol('Row')
const Rows = Symbol('Rows')

const differenceIs = (region, base, excluded) =>
  region instanceof Difference.kind && region[0] === base && region[1] === excluded

const intersect = (left, right) => {
  if (left === Bottom || right === Bottom) return Bottom
  if (left === Top) return right
  if (right === Top || left === right) return left
  if (
    left === Numeric && right === Number ||
    left === Number && right === Numeric
  ) return Number
  if (
    left === Numeric && right === Indeterminate ||
    left === Indeterminate && right === Numeric
  ) return Indeterminate
  if (
    left === Number && right === Indeterminate ||
    left === Indeterminate && right === Number
  ) return Bottom
  if (
    differenceIs(left, Top, Number) && right === Numeric ||
    differenceIs(right, Top, Number) && left === Numeric
  ) return Indeterminate
  throw new TypeError('Unsupported reference intersection')
}

const subtract = (left, right) => {
  if (left === Bottom || left === right || right === Top) return Bottom
  if (right === Bottom) return left
  if (left === Top && right === Number) return Difference(Top, Number)
  if (left === Numeric && right === Number) return Indeterminate
  if (left === Numeric && right === Indeterminate) return Number
  throw new TypeError('Unsupported reference difference')
}

const unite = (left, right) => {
  if (left === Bottom) return right
  if (right === Bottom || left === right) return left
  if (
    left === Equals(0) && right === Indeterminate ||
    left === Indeterminate && right === Equals(0)
  ) return Union(Equals(0), Indeterminate)
  if (
    left === Number && right === Indeterminate ||
    left === Indeterminate && right === Number
  ) return Numeric
  throw new TypeError('Unsupported reference union')
}

const row = (accepted, produced, canonical) => ({
  [Row]: true,
  [Accepted]: accepted,
  [ResultContract]: produced,
  [Canonical]: canonical,
})

const regionOf = pattern => {
  if (pattern === _) return Top
  if (pattern === Number || pattern === Indeterminate || pattern === Numeric)
    return pattern
  throw new TypeError('Unsupported reference pattern region')
}

const contractOf = region => {
  if (region === Number || region === Indeterminate || region === Numeric)
    return region
  throw new TypeError('Unsupported reference output region')
}

const incomingOf = context => {
  if (!isContract(context) || context === _)
    throw new TypeError('Expected an incoming region contract')
  return context
}

const canonicalOf = (scrutinee, incoming, accepted, rows) => {
  if (rows.length === 1 && accepted === incoming)
    return rows[0][Canonical]
  return Match(scrutinee, Tuple(...Array.from(rows, item =>
    Arm(contractOf(item[Accepted]), item[Canonical])
  )))
}

const result = (expanded, incoming, scrutinee, rows) => {
  const accepted = rows.reduce(
    (region, item) => unite(region, item[Accepted]),
    Bottom
  )
  const produced = rows.reduce(
    (region, item) => unite(region, item[ResultContract]),
    Bottom
  )
  return {
    [Expanded]: expanded,
    [Accepted]: accepted,
    [ResultContract]: produced,
    [Canonical]: canonicalOf(scrutinee, incoming, accepted, rows),
    [Obligations]: Tuple(),
    [Rows]: rows,
  }
}

const prepareZeroMul = (expanded, incoming, dependency) => {
  if (expanded[1][0] !== 0 || dependency && expanded[1] !== dependency)
    throw new TypeError('Unsupported reference dependency')
  const accepted = intersect(incoming, Numeric)
  const number = intersect(accepted, Number)
  const indeterminate = intersect(accepted, Indeterminate)
  const rows = Tuple(
    ...(number === Bottom ? [] : [row(number, Equals(0), 0)]),
    // Conservative test placeholder only: consuming Indeterminate algebra is
    // deliberately not being settled by this reference model.
    ...(indeterminate === Bottom
      ? []
      : [row(indeterminate, Indeterminate, expanded)])
  )
  return result(expanded, incoming, expanded[1], rows)
}

const prepareMatch = (expanded, incoming, dependency) => {
  if (
    !(expanded[0] instanceof CallArgument) ||
    expanded[0][0] !== 0 ||
    dependency && expanded[0] !== dependency
  )
    throw new TypeError('Unsupported reference Match scrutinee')
  const collect = (arms, remaining, rows = Tuple()) => {
    if (!arms.length || remaining === Bottom) return rows
    const [arm, ...rest] = arms
    const selected = intersect(remaining, regionOf(arm[0]))
    if (selected === Bottom) return collect(rest, remaining, rows)
    const body = prepareExpression(arm[1], expanded[0])(selected)
    return collect(
      rest,
      subtract(remaining, selected),
      Tuple(...rows, ...body[Rows])
    )
  }
  const rows = collect([...expanded[1]], incoming)
  return result(expanded, incoming, expanded[0], rows)
}

const prepareAtomic = (expanded, incoming) => {
  if (!(expanded instanceof Number))
    throw new TypeError('Unsupported reference expression')
  return result(
    expanded,
    incoming,
    expanded,
    Tuple(row(incoming, Equals(expanded), expanded))
  )
}

const prepareExpression = (expanded, dependency) => context => {
  const incoming = incomingOf(context)
  if (
    expanded instanceof Mul &&
    expanded[0] === 0 &&
    expanded[1] instanceof CallArgument
  )
    return prepareZeroMul(expanded, incoming, dependency)
  if (expanded instanceof Match)
    return prepareMatch(expanded, incoming, dependency)
  return prepareAtomic(expanded, incoming)
}

export const prepare = expanded => prepareExpression(expanded)
