// ==========================================
// Enum & Factory Infrastructure
// ==========================================

import { canonical } from './intern.mjs'
import {
  contractCheck, fulfills, isContract, isInstance, producedOf, sub
} from './contract.mjs'
import {
  fact, learn, Resolve, Consumes, Produces, Transparent
} from './facts.mjs'
import { Canonical } from './canonical.mjs'
import { Pure, purityOf } from './purity.mjs'
import { Kinds } from './kinds.mjs'

export { Canonical, Pure, purityOf }

const once = (fn, cached = false, cache) => (...args) => (
  cached || (cache = fn(...args), cached = true), cache
)

const memoize = (fn, cache = Object.create(null)) => (key) => (
  key in cache || (cache[key] = fn(key)), cache[key]
)

const enumFactories = new WeakMap()

export const mapEnum = (value, map, factory =
  value !== null && typeof value === 'object'
    ? enumFactories.get(value.constructor)
    : null
) => factory == null ? null : factory(...value.map(map))

// A bare arrow - no prototype, no hasInstance of its own - can only be a check.
const isCheck = (x) => typeof x === 'function' && !x.prototype && !Object.hasOwn(x, Symbol.hasInstance)

const membership = (check) => function (v) { return check(...this)(v) || sub(producedOf(v), this) }

export const genericResult = result =>
  Object.assign(contractCheck(() => false, result), { generic: true })

export const argContracts = (constructor) => (...argContracts) => (result = null) => (
  argContracts.forEach((c, i) => c?.generic && (c.seat ??= i)),
  learn(constructor, Consumes, argContracts),
  isCheck(result)
    ? Object.defineProperty(constructor.prototype, Symbol.hasInstance, { value: membership(result) })
    : (learn(constructor, Produces, result),
       argContracts.length === 1 && argContracts[0] === result
         && learn(constructor, Transparent, result)),
  argContracts
)

// A generic seat binds the call argument itself on first use; a repeated
// seat re-checks by identity - under interning, === is value equality.
// Unbound is an array hole, so null remains a bindable value.
// The carrier is a thunk over the node it is asked about - a stored
// generic answers "what does this node make" from the node itself.
export const generic = (state, i = 0) => [
  (handler) => handler ? (state = handler(state)) : state,
  (index = i++, thunk = Object.assign((node) => node[thunk.seat], { generic: true })) =>
    contractCheck((value) => (
      index in state
        ? value === state[index]
        : (state[index] = value, true)
    ), thunk)
]

export function* generics(generic) { while (true) yield generic() }

export const Enum = (build, input) => {
  const [genericState, createGeneric] = generic()
  const resolve = once((constructor) => build(argContracts(constructor), generics(createGeneric)))
  const validator = (constructor, ...args) => {
    genericState(() => [])
    const definitions = resolve(constructor)
    // A contract-valued Enum's seats configure its check; only structural
    // Enums admit contracts as pattern parts.
    const structural = !isContract(constructor.prototype)
    if (args.length > definitions.length)
      throw Error(`Too many arguments: expected up to ${definitions.length}, but got ${args.length}.`)
    for (let i = 0; i < definitions.length; i++)
      // if (!definitions[i](args[i]))
      if (!(
        structural && !definitions[i].generic && isContract(args[i]) ||
        fulfills(args[i], definitions[i])
      ))
        throw TypeError(`Validation failed at index ${i} for value: ${JSON.stringify(args[i])}`)
    if (input && !input(...args))
      throw TypeError(`Input validation failed for values: ${args}`)
    return args
  }
  return (learn(validator, Resolve, resolve), validator)
}

Object.defineProperty(Enum, Symbol.hasInstance, {
  value: value => enumFactories.has(value?.constructor)
})

Enum.kind = Enum
Kinds.Enum = Enum

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
  const factory = contractCheck(
    (v, transparent = (fact(fn, Resolve)(constructor), fact(constructor, Transparent))) =>
      isInstance(v, constructor) || transparent != null && fulfills(v, transparent),
    (...args) => {
      // The gate constructs; the interner only caches. A duplicate
      // construction is discarded in favor of the canonical instance.
      const instance = constructor.from(validate(...args))
      const candidate = canonical(constructor, instance, instance)
      candidate[Pure] = constructor[Pure]?.(candidate)
        ?? candidate.every(purityOf)
      candidate[Canonical] = constructor[Canonical]?.(candidate) ?? candidate
      return candidate
    },
    { kind: constructor }
  )
  enumFactories.set(constructor, factory)
  return factory
}

export const createEnums = (
  Def,
  def = once(() => new (Def())),
  memo = memoize(key => lazyEnumFactory(key, def()[key]))
) => new Proxy({}, { get: (target, prop) => memo(prop) })
