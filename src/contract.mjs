// ==========================================
// Contract Primitives
// ==========================================

import { fact, Produces } from './facts.mjs'
import { isTuple } from './intern.mjs'

// What a value stands for: the declared result of the constructor that made
// it. A stored generic is a thunk - it answers for the node it is asked about.
export const producedOf = (v, p = fact(v?.constructor, Produces)) =>
  p?.generic ? p(v) : p

// Subcontract, degenerate: interned identity. This is the seam where the
// rule table (ranges, unions, singletons) and the three verdicts grow.
export const sub = (a, b) => a === b

export const isContract = (value) =>
  value != null && typeof value[Symbol.hasInstance] === 'function'

// Membership is "stands at": the base test, or the value was admitted as
// something that satisfies the demanded contract.
export const contractCheck = (validatorFn, contract = {}, extend = {}) => Object.defineProperties(
  contract,
  {
    ...Object.getOwnPropertyDescriptors(extend),
    [Symbol.hasInstance]: {
      value: (v) => validatorFn(v) || sub(producedOf(v), contract)
    }
  }
)

export const CanonicalTuple = Object.freeze(contractCheck(isTuple))

// export function extendFn(fn, parent) {
//     fn.prototype = Object.create(parent.prototype);
//     fn.prototype.constructor = fn;
//     Object.setPrototypeOf(fn, parent);
// }
