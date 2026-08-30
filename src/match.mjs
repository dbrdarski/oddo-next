import { contractCheck, fulfills, isContract, isInstance } from './contract.mjs'
import { Enum, generic, generics } from './enum.mjs'
import { Tuple } from './intern.mjs'

export const _ = contractCheck(() => true)

const caseOf = (pattern) => (handler) => [pattern, handler]
const combined = Symbol()

export const Combine = (...patterns) => (handler) =>
  [patterns, handler, combined]

const fits = (pattern, value) => {
  if (pattern === _)
    return true

  if (pattern?.kind === pattern)
    return isInstance(value, pattern)

  if (isInstance(pattern?.prototype, Enum))
    return isInstance(value, pattern)

  if (isContract(pattern))
    return pattern.generic
      ? isInstance(value, pattern)
      : fulfills(value, pattern)

  if (isInstance(pattern, Enum))
    return (
      isInstance(value, Enum) &&
      pattern.constructor === value.constructor &&
      pattern.length === value.length &&
      pattern.every((part, i) => fits(part, value[i]))
    )

  return value === pattern
}

const combineFits = (patterns, values, genericState) => {
  if (!isInstance(values, Tuple)) {
    values = Tuple(...values)
  }

  if (patterns.length !== values.length) return

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

  return search(0) ? assigned : null
}

export const match = (value) => (...cases) => {
  for (const define of cases) {
    const [genericState, createGeneric] = generic()
    const [pattern, handler, kind] = define(caseOf, generics(createGeneric))

    genericState(() => [])

    if (kind === combined) {
      const assigned = combineFits(pattern, value, genericState)
      if (assigned != null) return handler(...assigned)
      continue
    }

    if (fits(pattern, value)) {
      const bindings = genericState()
      return isContract(pattern) && pattern !== _ && !bindings.length
        ? handler(value)
        : handler(...bindings)
    }
  }

  return value
}

export const matchDomain = (domain, handler) => value =>
  handler(match(value), domain)
