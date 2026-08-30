// ==========================================
// Domain Definition
// ==========================================

import { fulfills, isContract } from './contract.mjs'
import { Enum, createEnums } from './enum.mjs'
import { Tuple } from './intern.mjs'
import { match, matchDomain, Combine, _ } from './match.mjs'
import { Number, Indeterminate } from './numeric.mjs'
import { Canonical, canonicalContext } from './canonical.mjs'


export const registerCanonical = (EnumType, rule) =>
  EnumType.kind[Canonical] = candidate =>
    canonicalContext(() => rule(match(candidate)))


// `_` implements matching through the contract protocol, but remains wildcard
// syntax; persistent region operands use the named Top contract instead.
export const isRegion = value => isContract(value) && value !== _

// const Union = (conA, conB) => value => fulfills(value, conA) || fulfills(value, conB)

/*
    So, Symbol.jasInstance if static element on the class and it can be used to check Enum args
    Union (A, B) fulfills(value, A) || fulfills(value, B) is for argument side
    The return contract is separate mechanics that needs resolving.

    Idea Return Contract fulfilment: Instead of Array, Enums extend the Return Contract (Enum), this way any instance fulfils its declared return contract.
    This will work for Add and Numeric. But will it work for Unions? The way I see it, create two classes for each type of the Union, and when you instatiate an Union match it to that type.
    But this is a problem for non Union members (like Union(Number, Indeterminate))
*/

const Domain = createEnums(() => class {
  Top = Enum($ => $()(() => value => value != null))
  Bottom = Enum($ => $()(() => () => false))
  Null = Enum($ => $()(() => value => value === Null))
  // Union = Enum(($, [T1, T2], { contract = value => fulfills(value, T1) || fulfills(value, T2) }) => $(T1, T2))
  Union = Enum(($, [T1, T2]) =>
    $(T1, T2)((T1, T2) => value => fulfills(value, T1) || fulfills(value, T2)))
  Intersection = Enum(($, [T1, T2]) =>
    $(T1, T2)((T1, T2) => value => fulfills(value, T1) && fulfills(value, T2)))
  Difference = Enum(($, [base, excluded]) =>
    $(base, excluded)((base, excluded) => value =>
      fulfills(value, base) && !fulfills(value, excluded)))
  Numeric = Enum($ => $(Union(Number, Indeterminate))(Union(Number, Indeterminate)))
  // Numeric = Enum($ => $(Number)(Union(Number, Indeterminate)))
  Add = Enum($ => $(Numeric, Numeric)(Numeric))
  Sub = Enum($ => $(Numeric, Numeric)(Numeric))
  Mul = Enum($ => $(Numeric, Numeric)(Numeric))
  Div = Enum($ => $(Numeric, Numeric)(Numeric))
  Equals = Enum(($, [E]) => $(E)(E => value => value === E))
  Range = Enum($ => $(Number, Number)((lo, hi) => value =>
    fulfills(value, Number) && lo <= value && value <= hi))
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

registerCanonical(Add, matches => matches(
  $ => Combine(Range.kind, Range.kind)((left, right) =>
    Range(
      left[0] + right[0],
      left[1] + right[1]
    )),
  $ => Combine(Range.kind, Number.kind)((range, value) =>
    Range(
      range[0] + value,
      range[1] + value
    )),
  $ => Combine(Number.kind, Number.kind)((left, right) =>
    Equals(left + right))
))

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
