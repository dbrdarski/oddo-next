// ==========================================
// Enum & Factory Infrastructure
// ==========================================

import { canonical } from './intern.mjs'
import { contractCheck, producedOf, sub } from './contract.mjs'
import { fact, learn } from './facts.mjs'

const once = (fn, cached = false, cache) => (...args) => (
  cached || (cache = fn(...args), cached = true), cache
)

const memoize = (fn, cache = Object.create(null)) => (key) => (
  key in cache || (cache[key] = fn(key)), cache[key]
)

// A bare arrow - no prototype, no hasInstance of its own - can only be a check.
const isCheck = (x) => typeof x === 'function' && !x.prototype && !Object.hasOwn(x, Symbol.hasInstance)

const membership = (check) => function (v) { return check(...this)(v) || sub(producedOf(v), this) }

export const argContracts = (constructor) => (...argContracts) => (result) => (
  isCheck(result)
    ? Object.defineProperty(constructor.prototype, Symbol.hasInstance, { value: membership(result) })
    : (learn(constructor, 'produces', result),
       argContracts.length === 1 && argContracts[0] === result
         && learn(constructor, 'transparent', result)),
  argContracts
)

// A generic seat binds the call argument itself on first use; a repeated
// seat re-checks by identity - under interning, === is value equality.
// Unbound is an array hole, so null and undefined are bindable values.
const generic = (state, i = 0) => [
  () => { state = [] },
  (index = i++) => contractCheck((value) => (
    index in state
      ? value === state[index]
      : (state[index] = value, true)
  ))
]

function* generics(generic) { while (true) yield generic() }

export const Enum = (build, input) => {
  const [initGenerics, createGeneric] = generic()
  const resolve = once((constructor) => build(argContracts(constructor), generics(createGeneric)))
  const validator = (constructor, ...args) => {
    initGenerics()
    const definitions = resolve(constructor)
    if (args.length > definitions.length)
      throw Error(`Too many arguments: expected up to ${definitions.length}, but got ${args.length}.`)
    for (let i = 0; i < definitions.length; i++)
      // if (!definitions[i](args[i]))
      if (!(args[i] instanceof definitions[i]))
        throw TypeError(`Validation failed at index ${i} for value: ${args[i]}`)
    if (input && !input(...args))
      throw TypeError(`Input validation failed for values: ${args}`)
    return args
  }
  return (learn(validator, 'resolve', resolve), validator)
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

  // Membership can be demanded before any construction (Add(1, 1) asks
  // Numeric before Numeric ever ran), so the check resolves the
  // declaration on demand - first need, not first construction.
  return contractCheck(
    (v, transparent = (fact(fn, 'resolve')(constructor), fact(constructor, 'transparent'))) =>
      v instanceof constructor || transparent != null && v instanceof transparent,
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
