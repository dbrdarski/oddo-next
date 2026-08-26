// ==========================================
// Domain Definition
// ==========================================

import { instanceOf, isContract } from './contract.mjs'
import { Enum, createEnums } from './enum.mjs'
import { Tuple } from './intern.mjs'
import { match, matchDomain, Combine, _ } from './match.mjs'
import { Number, Indeterminate } from './numeric.mjs'

// `_` implements matching through the contract protocol, but remains wildcard
// syntax; persistent region operands use the named Top contract instead.
export const isRegion = value => isContract(value) && value !== _

const regionArguments = length => (...regions) =>
  regions.length === length && regions.every(isRegion)

// const Union = (conA, conB) => value => value instanceof conA || value instanceof conB

/*
    So, Symbol.jasInstance if static element on the class and it can be used to check Enum args
    Union (A, B) valuue instanceof A || value instanceof B is for argument side
    The return contract is separate mechanics that needs resolving.

    Idea Return Contract instanceof: Instead of Array, Enums extend the Return Contract (Enum), this way any instace is true for instanceof checks.
    This will work for Add and Numeric. But will it work for Unions? The way I see it, create two classes for each type of the Union, and when you instatiate an Union match it to that type.
    But this is a problem for non Union members (like Union(Number, Indeterminate))
*/

const Domain = createEnums(() => class {
  Top = Enum($ => $()(() => value => value != null))
  Bottom = Enum($ => $()(() => () => false))
  Null = Enum($ => $()(() => value => value === Null))
  // Union = Enum(($, [T1, T2], { contract = value => value instanceof T1 || value instanceof T2 }) => $(T1, T2))
  Union = Enum(($, [T1, T2]) =>
    $(T1, T2)((T1, T2) => value => instanceOf(value, T1) || instanceOf(value, T2)),
    regionArguments(2))
  Intersection = Enum(($, [T1, T2]) =>
    $(T1, T2)((T1, T2) => value => instanceOf(value, T1) && instanceOf(value, T2)),
    regionArguments(2))
  Difference = Enum(($, [base, excluded]) =>
    $(base, excluded)((base, excluded) => value =>
      instanceOf(value, base) && !instanceOf(value, excluded)),
    regionArguments(2))
  Numeric = Enum($ => $(Union(Number, Indeterminate))(Union(Number, Indeterminate)))
  // Numeric = Enum($ => $(Number)(Union(Number, Indeterminate)))
  Add = Enum($ => $(Numeric, Numeric)(Numeric))
  Sub = Enum($ => $(Numeric, Numeric)(Numeric))
  Mul = Enum($ => $(Numeric, Numeric)(Numeric))
  Div = Enum($ => $(Numeric, Numeric)(Numeric))
  Equals = Enum(($, [E]) => $(E)(E => value => value === E))
  Range = Enum($ => $(Number, Number)((lo, hi) => value =>
    instanceOf(value, Number) && lo <= value && value <= hi),
    (lo, hi) => lo <= hi)
  LL = Enum($ => $(Numeric, Union(Null, LL))(LL))
})

export const Top = Domain.Top()
export const Bottom = Domain.Bottom()
export const Null = Domain.Null()

export const {
  Add, Sub, Mul, Div, LL, Numeric,
  Union, Intersection, Difference, Equals, Range
} = Domain

Object.defineProperty(Equals.kind.prototype, 'valueOf', {
  value() { return this[0] }
})

const canonicalCommutative = (candidate, absorbing, identity) =>
  match(Tuple(...candidate))(
    $ => Combine(Equals(absorbing), _)(() => absorbing),
    ($, [value]) => Combine(Equals(identity), value)((_identity, value) => value),
    ($, [value]) => Combine(value, value)(value => value),
    $ => $(_)(() => candidate)
  )

const canonicalDifference = candidate => {
  const [base, excluded] = candidate
  return match(base)(
    $ => $(Equals(Bottom))(() => Bottom),
    $ => $(_)(() => match(excluded)(
      $ => $(Equals(base))(() => Bottom),
      $ => $(Equals(Bottom))(() => base),
      $ => $(Equals(Top))(() => Bottom),
      $ => $(_)(() => candidate)
    ))
  )
}

export const canonicalizeDomain = matchDomain(
  Domain,
  (matches, { Union, Intersection, Difference }) => matches(
    $ => $(Union.kind)(candidate =>
      canonicalCommutative(candidate, Top, Bottom)),
    $ => $(Intersection.kind)(candidate =>
      canonicalCommutative(candidate, Bottom, Top)),
    $ => $(Difference.kind)(canonicalDifference),
    ($, [value]) => $(value)(value => value)
  )
)
