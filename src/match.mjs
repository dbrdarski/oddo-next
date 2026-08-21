import { contractCheck, isContract } from './contract.mjs'
import { generic, generics } from './enum.mjs'

export const _ = Object.freeze(contractCheck(() => true))

const caseOf = (pattern) => (handler) => [pattern, handler]

const isEnum = (value) =>
  Array.isArray(value) && value.constructor !== Array

const fits = (pattern, value) => {
  if (pattern === _)
    return true

  if (isContract(pattern))
    return value instanceof pattern

  if (isEnum(pattern))
    return (
      isEnum(value) &&
      pattern.constructor === value.constructor &&
      pattern.length === value.length &&
      pattern.every((part, i) => fits(part, value[i]))
    )

  return value === pattern
}

export const match = (value) => (...cases) => {
  for (const define of cases) {
    const [genericState, createGeneric] = generic()
    const [pattern, handler] = define(caseOf, generics(createGeneric))

    genericState(() => [])

    if (fits(pattern, value)) {
      const bindings = genericState()
      return isContract(pattern) && pattern !== _ && !bindings.length
        ? handler(value)
        : handler(...bindings)
    }
  }

  throw new TypeError('No pattern matched')
}
