// ==========================================
// Domain Definition
// ==========================================

import { Enum, createEnums, argContracts } from './enum.mjs'
import { contractCheck, Optional } from './contract.mjs'
import { Number } from './numeric.mjs'

// const Union = (conA, conB) => value => value instanceof conA || value instanceof conB

/*
    So, Symbol.jasInstance if static element on the class and it can be used to check Enum args
    Union (A, B) valuue instanceof A || value instanceof B is for argument side
    The return contract is separate mechanics that needs resolving.

    Idea Return Contract instanceof: Instead of Array, Enums extend the Return Contract (Enum), this way any instace is true for instanceof checks.
    This will work for Add and Numeric. But will it work for Unions? The way I see it, create two classes for each type of the Union, and when you instatiate an Union match it to that type.
    But this is a problem for non Union members (like Union(Number, Indeterminate))
*/

export const { Add, Sub, Mul, LL, Numeric, Union } = createEnums(() => class {
  // Union = Enum(($, [T1, T2], { contract = value => value instanceof T1 || value instanceof T2 }) => $(T1, T2))
  Union = Enum(($, { T1, T2 }) => $(T1, T2)(contractCheck(value => value instanceof T1 || value instanceof T2)))
  Numeric = Enum($ => $(Number)(Number))
  // Numeric = Enum($ => $(Number)(Union(Number, Indeterminate)))
  // Numeric = Enum($ => $(Union(Number, Indeterminate))(Union(Number, Indeterminate)))
  Add = Enum($ => $(Numeric, Numeric)(Numeric)) // add needs to be extend from numewric <- this enables Add(Add) Add -> Numeric
  Sub = Enum($ => $(Numeric, Numeric)(Numeric))
  Mul = Enum($ => $(Numeric, Numeric)(Numeric))
  Equals = Enum(($, { E }) => $(E)(E))
  Call = argContracts
  LL = Enum($ => $(Numeric, Optional(LL)))
})
