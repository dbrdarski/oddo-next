export const Pure = Symbol('Pure')

export const purityOf = value => value?.[Pure] ?? true
