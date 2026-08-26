// ==========================================
// Numeric Tower: Number & Indeterminate
// ==========================================

import { canonical } from './intern.mjs'
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

export class Indeterminate extends globalThis.Number {
  valueOf() { return this }
}

// The door keys identity by (form, operand), so 1/0 and 2/0 are distinct
// values. Indeterminate valueOf() deliberately retains the complete form.
export class ZeroDivision extends Indeterminate {
  constructor(operand) {
    super(operand)
    return canonical(ZeroDivision, [operand], this)
  }
}
ZeroDivision.prototype[Symbol.toStringTag] = "Indeterminate(ZeroDivision)"

export class ZeroMod extends Indeterminate {
  constructor(operand) {
    super(operand)
    return canonical(ZeroMod, [operand], this)
  }
}

ZeroMod.prototype[Symbol.toStringTag] = "Indeterminate(ZeroMod)"
