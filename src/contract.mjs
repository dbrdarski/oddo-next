// ==========================================
// Contract Primitives
// ==========================================

import { fact } from './facts.mjs'

// What a value stands for: the declared result of the constructor that made it.
export const producedOf = (v) => fact(v?.constructor, 'produces')

// Subcontract, degenerate: interned identity. This is the seam where the
// rule table (ranges, unions, singletons) and the three verdicts grow.
export const sub = (a, b) => a === b

// Membership is "stands at": the base test, or the value was admitted as
// something that satisfies the demanded contract.
export const contractCheck = (validatorFn, contract = {}) => Object.defineProperty(
  contract,
  Symbol.hasInstance,
  { value: (v) => validatorFn(v) || sub(producedOf(v), contract) }
)

// export function extendFn(fn, parent) {
//     fn.prototype = Object.create(parent.prototype);
//     fn.prototype.constructor = fn;
//     Object.setPrototypeOf(fn, parent);
// }
