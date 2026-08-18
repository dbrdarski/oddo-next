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

// The hidden class whose declaration is currently being resolved; the
// factory puts it on deck so the result contract lands on the right key.
let resolving

export const argContracts = (...argContracts) => (resultContract) => (
  learn(resolving, 'produces', resultContract), argContracts
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

const genericsProxy = (generic) => new Proxy({}, { get: () => generic() })

export const Enum = (build) => {
  const [initGenerics, createGeneric] = generic()
  const resolve = once(() => build(argContracts, genericsProxy(createGeneric)))
  return (...args) => {
    initGenerics()
    const definitions = resolve()
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

  return contractCheck(
    v => v instanceof constructor,
    (...args) => {
      // The gate constructs; the interner only caches. A duplicate
      // construction is discarded in favor of the canonical instance.
      // resolving is saved/restored so a build that calls another enum
      // mid-resolve cannot steal this declaration's key.
      const parent = resolving
      resolving = constructor
      const instance = constructor.from(fn(...args))
      resolving = parent
      return canonical(constructor, instance, instance)
    }
  )
}

export const createEnums = (
  Def,
  def = once(() => new (Def())),
  memo = memoize(key => lazyEnumFactory(key, def()[key]))
) => new Proxy({}, { get: (target, prop) => memo(prop) })
