// ==========================================
// Canonical Functions
// ==========================================

import { CanonicalTuple, isContract } from './contract.mjs'
import { Enum, createEnums, mapEnum } from './enum.mjs'
import { Tuple, isTuple } from './intern.mjs'
import { match, _ } from './match.mjs'
import { Number } from './numeric.mjs'
import { Numeric } from './domain.mjs'

const whole = value => globalThis.Number.isInteger(value) && value >= 0

const {
  OuterRef,
  CallArgument,
  MatchArgument,
  Apply,
  Arm,
  Match,
  Lambda,
  FunctionRef,
} = createEnums(() => class {
  // References are holes in a canonical form. Their values are supplied
  // only when that form is applied to an ordered reference environment.
  OuterRef = Enum(
    $ => $(Number)(index => () => true),
    index => whole(index)
  )
  CallArgument = Enum(
    $ => $(Number, _)(Numeric),
    (...values) => values.length === 2 && whole(values[0]) && isFunctionOwner(values[1])
  )
  MatchArgument = Enum(
    $ => $(Number)(index => () => true),
    index => whole(index)
  )
  Apply = Enum(
    $ => $(_, CanonicalTuple)(Numeric),
    (...values) => (
      values.length === 2 &&
      isFunctionOwner(values[0]) &&
      values[1] instanceof CanonicalTuple
    )
  )
  Arm = Enum(
    $ => $(_, _)(),
    (...values) => values.length === 2
  )
  Match = Enum(
    $ => $(_, CanonicalTuple)(Numeric),
    (...values) => (
      values.length === 2 &&
      values[1] instanceof CanonicalTuple &&
      values[1].every(arm => arm instanceof Arm)
    )
  )
  Lambda = Enum(
    $ => $(Number, Number, _)(),
    (...values) => (
      values.length === 3 &&
      whole(values[0]) &&
      whole(values[1]) &&
      !containsHostFunction(values[2]) &&
      outerReferencesWithin(values[2], values[0])
    )
  )
  FunctionRef = Enum($ => $(Lambda, CanonicalTuple)())
})

const isFunctionOwner = value =>
  value instanceof OuterRef || value instanceof Lambda || value instanceof FunctionRef

export const argumentCountOf = owner => {
  const form = owner instanceof FunctionRef ? owner[0] : owner
  return form instanceof Lambda ? form[1] : undefined
}

const containsHostFunction = (value, seen = new WeakSet()) => {
  if (typeof value === 'function')
    return !Object.hasOwn(value, Symbol.hasInstance)
  if (value === null || typeof value !== 'object' || isContract(value))
    return false
  if (value instanceof Lambda || value instanceof FunctionRef || seen.has(value))
    return false

  seen.add(value)
  return Reflect.ownKeys(value).some(key => containsHostFunction(value[key], seen))
}

const outerReferencesWithin = (value, count, seen = new WeakSet()) => {
  if (value instanceof OuterRef) return value[0] < count
  if (value === null || typeof value !== 'object') return true
  if (value instanceof Lambda || value instanceof FunctionRef || seen.has(value))
    return true

  seen.add(value)
  return Reflect.ownKeys(value).every(key => outerReferencesWithin(value[key], count, seen))
}

export const internFn = (form, ...references) => {
  if (!(form instanceof Lambda) || references.length !== form[0])
    throw new TypeError('Invalid canonical function application')
  if (references.some(reference => containsHostFunction(reference)))
    throw new TypeError('Host functions must be represented as canonical function values')
  return FunctionRef(form, Tuple(...references))
}

const resolveOuter = (reference, frame) => {
  if (!(reference instanceof OuterRef)) return reference
  if (!(reference[0] in frame.references))
    throw new TypeError(`Missing outer reference at index ${reference[0]}`)

  const value = frame.references[reference[0]]
  return value instanceof Lambda ? internFn(value, ...frame.references) : value
}

const materialize = (value, frame) => {
  value = resolveOuter(value, frame)
  if (value instanceof FunctionRef) return value
  if (value instanceof Lambda) return internFn(value, ...frame.references)
  throw new TypeError(`Not a canonical function: ${value}`)
}

const callArgument = (tree, frame, context) => {
  const owner = materialize(tree[1], frame)
  if (tree[0] >= owner[0][1])
    throw new TypeError(`Invalid call argument at index ${tree[0]}`)

  const ownerFrame = context.stack.findLast(active => active.fn === owner)
  return ownerFrame ? ownerFrame.arguments[tree[0]] : CallArgument(tree[0], owner)
}

const rebuild = (tree, visit, mapped = mapEnum(tree, visit)) =>
  mapped ?? (isTuple(tree) ? Tuple(...tree.map(visit)) : tree)

const instantiatePattern = (tree, frame, genericAt) => {
  if (tree instanceof MatchArgument) return genericAt(tree[0])
  if (tree instanceof OuterRef) return resolveOuter(tree, frame)
  if (tree instanceof Lambda || tree instanceof FunctionRef) return tree
  return rebuild(tree, value => instantiatePattern(value, frame, genericAt))
}

const containsCall = tree => {
  if (tree instanceof Apply) return true
  if (tree instanceof Lambda || tree instanceof FunctionRef) return false
  return Array.isArray(tree) && tree.some(containsCall)
}

const evaluate = (tree, frame, context, execute = true) => {
  if (tree instanceof OuterRef) return resolveOuter(tree, frame)
  if (tree instanceof CallArgument) return callArgument(tree, frame, context)
  if (tree instanceof MatchArgument) {
    if (!execute) return tree
    const bindings = context.matches.at(-1)
    if (!bindings || !(tree[0] in bindings))
      throw new TypeError(`Missing match argument at index ${tree[0]}`)
    return bindings[tree[0]]
  }

  if (tree instanceof Apply) {
    const target = materialize(tree[0], frame)
    const arguments_ = tree[1].map(value => evaluate(value, frame, context, execute))
    return execute
      ? invoke(target, arguments_, context)
      : Apply(target, Tuple(...arguments_))
  }

  if (tree instanceof Match) {
    const value = evaluate(tree[0], frame, context, execute)
    if (!execute || containsCall(value)) return Match(
      value,
      Tuple(...tree[1].map(arm => Arm(
        evaluate(arm[0], frame, context, false),
        evaluate(arm[1], frame, context, false)
      )))
    )

    return match(value)(...tree[1].map(arm => ($, generics) => {
      const created = []
      const requested = new Set()
      const genericAt = index => {
        requested.add(index)
        while (created.length <= index) created.push(generics.next().value)
        return created[index]
      }
      const pattern = instantiatePattern(arm[0], frame, genericAt)
      return $(pattern)((...bindings) => {
        const forwarded = (context.matches.at(-1) ?? []).slice()
        if (requested.size)
          for (const index of requested) forwarded[index] = bindings[index]
        else
          forwarded.push(...bindings)
        context.matches.push(forwarded)
        try { return evaluate(arm[1], frame, context) }
        finally { context.matches.pop() }
      })
    }))
  }

  if (tree instanceof Lambda || tree instanceof FunctionRef) return tree
  return rebuild(tree, value => evaluate(value, frame, context, execute))
}

const invoke = (fn, arguments_, context) => {
  if (!(fn instanceof FunctionRef))
    throw new TypeError(`Not a canonical function: ${fn}`)

  const [form, references] = fn
  if (arguments_.length !== form[1])
    throw new TypeError(`Expected ${form[1]} call arguments, got ${arguments_.length}`)
  if (context.stack.some(frame => frame.fn === fn))
    return Apply(fn, Tuple(...arguments_))

  const frame = { fn, references, arguments: arguments_ }
  context.stack.push(frame)
  try { return evaluate(form[2], frame, context) }
  finally { context.stack.pop() }
}

export const expand = fn => {
  if (!(fn instanceof FunctionRef))
    throw new TypeError(`Not a canonical function: ${fn}`)

  return invoke(
    fn,
    Array.from({ length: fn[0][1] }, (_, index) => CallArgument(index, fn)),
    { stack: [], matches: [] }
  )
}

export { OuterRef, CallArgument, MatchArgument, Apply, Arm, Match, Lambda }
