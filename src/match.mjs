import { CanonicalTuple, contractCheck, isContract } from './contract.mjs'
import { generic, generics } from './enum.mjs'

export const _ = Object.freeze(contractCheck(() => true))

const caseOf = (pattern) => (handler) => [pattern, handler]
const combined = Symbol()

export const Combine = (...patterns) => (handler) =>
  [patterns, handler, combined]

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

const combineFits = (patterns, values, genericState) => {
  if (
    !(values instanceof CanonicalTuple) ||
    patterns.length !== values.length
  ) return

  const assigned = Array(patterns.length)
  const used = Array(patterns.length)
  const search = (patternIndex) => {
    if (patternIndex === patterns.length) return true

    for (let valueIndex = 0; valueIndex < values.length; valueIndex++) {
      if (used[valueIndex]) continue

      const checkpoint = genericState().slice()
      if (fits(patterns[patternIndex], values[valueIndex])) {
        assigned[patternIndex] = values[valueIndex]
        used[valueIndex] = true
        if (search(patternIndex + 1)) return true
        used[valueIndex] = false
      }
      genericState(() => checkpoint)
    }
    return false
  }

  return search(0) ? assigned : undefined
}

export const match = (value) => (...cases) => {
  for (const define of cases) {
    const [genericState, createGeneric] = generic()
    const [pattern, handler, kind] = define(caseOf, generics(createGeneric))

    genericState(() => [])

    if (kind === combined) {
      const assigned = combineFits(pattern, value, genericState)
      if (assigned !== undefined) return handler(...assigned)
      continue
    }

    if (fits(pattern, value)) {
      const bindings = genericState()
      return isContract(pattern) && pattern !== _ && !bindings.length
        ? handler(value)
        : handler(...bindings)
    }
  }

  throw new TypeError('No pattern matched')
}

export const matchDomain = (domain, handler) => value =>
  handler(match(value), domain)
