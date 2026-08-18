// ==========================================
// Numeric Tower: Number & Indeterminate
// ==========================================

import { contractCheck } from './contract.mjs'

/*

|-----------|
|   Types   |
|-----------|

Number
Indeterminate = 2
String
Record
Tuple
Enums
Function

========
Note: So Number is not an Enum, but a separate type.
*/

export const Number = contractCheck(
  value => typeof value === "number",
  globalThis.Number.bind(null)
)

export class Indeterminate extends globalThis.Number { }
export class ZeroDivision extends Indeterminate {
  constructor() {
    super()
    // intern ZeroDivision
  }
}
ZeroDivision.prototype[Symbol.toStringTag] = "Indeterminate(ZeroDivision)"
export class ZeroMod extends Indeterminate {
  constructor() {
    super()
    // intern ZeroMod
  }
}

ZeroMod.prototype[Symbol.toStringTag] = "Indeterminate(ZeroMod)"
