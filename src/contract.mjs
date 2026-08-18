// ==========================================
// Contract Primitives
// ==========================================

export const contractCheck = (validatorFn, contract = {}) => Object.defineProperty(
  contract,
  Symbol.hasInstance,
  { value: validatorFn }
)

export const Optional = (validator) => contractCheck(
  validator[Symbol.hasInstance],
  v => v == null ? true : v instanceof validator
)

export function extendFn(fn, parent) {
    fn.prototype = Object.create(parent.prototype);
    fn.prototype.constructor = fn;
    Object.setPrototypeOf(fn, parent);
}
