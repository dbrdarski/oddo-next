// ==========================================
// Enum & Factory Infrastructure
// ==========================================

import { canonical } from './intern.mjs'
import { contractCheck } from './contract.mjs'
import { learn } from './facts.mjs'

const once = (fn, cached = false, cache) => (...args) => (
  cached || (cache = fn(...args), cached = true), cache
)

const memoize = (fn, cache = Object.create(null)) => (key) => (
  key in cache || (cache[key] = fn(key)), cache[key]
)

export const argContracts = (constructor) => (...argContracts) => (resultContract) => (
  learn(constructor, 'produces', resultContract), argContracts
)

// const generic = (typeContract) => (value) => {
//   if (typeContract == null) {
//     typeContract = value.constructor
//     return true
//   } else {
//     return value instanceof typeContract
//   }
// }

const generic = (state, i = 0) => [
  () => { state = [] },
  (index = i++) => (value) => {
    if (state[index] == null) {
      state[index] = value.constructor
      return true
    }
    return value instanceof state[index]
  }
]

function* generics(generic) { while (true) yield generic() }

export const Enum = (build) => {
  const [initGenerics, createGeneric] = generic()
  const resolve = once((constructor) => build(argContracts(constructor), generics(createGeneric)))
  return (constructor, ...args) => {
    initGenerics()
    const definitions = resolve(constructor)
    if (args.length > definitions.length)
      throw Error(`Too many arguments: expected up to ${definitions.length}, but got ${args.length}.`)
    for (let i = 0; i < definitions.length; i++)
      // if (!definitions[i](args[i]))
      if (!(args[i] instanceof definitions[i]))
        throw TypeError(`Validation failed at index ${i} for value: ${args[i]}`)
    return args
  }
}

const lazyEnumFactory = (name, fn) => {
  const constructor = class extends Array { }
  Object.defineProperty(constructor.prototype, Symbol.toStringTag, { value: name })
  Object.defineProperty(constructor.prototype, 'toString', {
    value: function () {
      const args = Array.from(this)
        .map(arg => typeof arg === 'string' ? `"${arg}"` : String(arg))
        .join(', ')
      return `${name}(${args})`
    }
  })

  // The declaration learns against its class through this binding - the
  // key travels lexically, so nested resolves cannot interfere.
  const validate = fn.bind(null, constructor)

  return contractCheck(
    v => v instanceof constructor,
    (...args) => {
      // The gate constructs; the interner only caches. A duplicate
      // construction is discarded in favor of the canonical instance.
      const instance = constructor.from(validate(...args))
      return canonical(constructor, instance, instance)
    }
  )
}

export const createEnums = (
  Def,
  def = once(() => new (Def())),
  memo = memoize(key => lazyEnumFactory(key, def()[key]))
) => new Proxy({}, { get: (target, prop) => memo(prop) })
