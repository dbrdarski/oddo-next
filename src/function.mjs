// ==========================================
// Canonical Functions
// ==========================================

import { Enum, createEnums, mapEnum } from './enum.mjs'
import { Tuple } from './intern.mjs'
import { Kinds } from './kinds.mjs'
import { isInstance } from './contract.mjs'
import { match, _ } from './match.mjs'
import { Number } from './numeric.mjs'
import { Numeric } from './domain.mjs'

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
  OuterRef = Enum($ => $(Number)(index => () => true))
  CallArgument = Enum($ => $(Number, _)(Numeric))
  MatchArgument = Enum($ => $(Number)(index => () => true))
  Apply = Enum($ => $(_, Tuple)(Numeric))
  Arm = Enum($ => $(_, _)())
  Match = Enum($ => $(_, Tuple)(Numeric))
  Lambda = Enum($ => $(Number, Number, _)())
  FunctionRef = Enum($ => $(Lambda, Tuple)())
})

Kinds.CallArgument = CallArgument.kind

export const argumentCountOf = owner => match(owner)(
  $ => $(FunctionRef.kind)(owner => owner[0][1]),
  $ => $(Lambda.kind)(form => form[1]),
  $ => $(_)(() => null)
)

export const internFn = (form, ...references) =>
  FunctionRef(form, Tuple(...references))

const resolveOuter = (reference, frame) => match(reference)(
  $ => $(OuterRef.kind)(reference => {
    const value = frame.references[reference[0]]
    return match(value)(
      $ => $(Lambda.kind)(value => internFn(value, ...frame.references)),
      ($, [value]) => $(value)(value => value)
    )
  }),
  ($, [value]) => $(value)(value => value)
)

const materialize = (value, frame) => {
  value = resolveOuter(value, frame)
  return match(value)(
    $ => $(FunctionRef.kind)(value => value),
    $ => $(Lambda.kind)(value => internFn(value, ...frame.references)),
    $ => $(_)(() => {
      throw new TypeError(`Not a canonical function: ${value}`)
    })
  )
}

const callArgument = (tree, frame, context) => {
  const owner = materialize(tree[1], frame)
  const ownerFrame = context.stack.findLast(active => active.fn === owner)
  return ownerFrame ? ownerFrame.arguments[tree[0]] : CallArgument(tree[0], owner)
}

const rebuild = (tree, visit, mapped = mapEnum(tree, visit)) =>
  mapped ?? (isInstance(tree, Tuple) ? Tuple(...Array.from(tree, visit)) : tree)

const instantiatePattern = (tree, frame, genericAt) => match(tree)(
  $ => $(MatchArgument.kind)(tree => genericAt(tree[0])),
  $ => $(OuterRef.kind)(tree => resolveOuter(tree, frame)),
  $ => $(Lambda.kind)(tree => tree),
  $ => $(FunctionRef.kind)(tree => tree),
  ($, [value]) => $(value)(value =>
    rebuild(value, child => instantiatePattern(child, frame, genericAt)))
)

const containsCall = tree => match(tree)(
  $ => $(Apply.kind)(() => true),
  $ => $(Lambda.kind)(() => false),
  $ => $(FunctionRef.kind)(() => false),
  ($, [value]) => $(value)(value =>
    isInstance(value, Array) && value.some(containsCall))
)

const evaluate = (tree, frame, context, execute = true) => match(tree)(
  $ => $(OuterRef.kind)(tree => resolveOuter(tree, frame)),
  $ => $(CallArgument.kind)(tree => callArgument(tree, frame, context)),
  $ => $(MatchArgument.kind)(tree => {
    if (!execute) return tree
    const bindings = context.matches.at(-1)
    return bindings[tree[0]]
  }),
  $ => $(Apply.kind)(tree => {
    const target = materialize(tree[0], frame)
    const arguments_ = Array.from(
      tree[1],
      value => evaluate(value, frame, context, execute)
    )
    return execute
      ? invoke(target, arguments_, context)
      : Apply(target, Tuple(...arguments_))
  }),
  $ => $(Match.kind)(tree => {
    const value = evaluate(tree[0], frame, context, execute)
    if (!execute || !context.selectMatches || containsCall(value)) return Match(
      value,
      Tuple(...Array.from(tree[1], arm => Arm(
        evaluate(arm[0], frame, context, false),
        evaluate(arm[1], frame, context, false)
      )))
    )

    return match(value)(...Array.from(tree[1], arm => ($, generics) => {
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
  }),
  $ => $(Lambda.kind)(tree => tree),
  $ => $(FunctionRef.kind)(tree => tree),
  ($, [value]) => $(value)(value =>
    rebuild(value, child => evaluate(child, frame, context, execute)))
)

const invoke = (fn, arguments_, context) => {
  const [form, references] = fn
  if (context.stack.some(frame => frame.fn === fn))
    return Apply(fn, Tuple(...arguments_))

  const frame = { fn, references, arguments: arguments_ }
  context.stack.push(frame)
  try { return evaluate(form[2], frame, context) }
  finally { context.stack.pop() }
}

export const apply = (fn, ...arguments_) =>
  invoke(fn, arguments_, {
    stack: [],
    matches: [],
    selectMatches: true,
  })

export const expand = fn =>
  invoke(
    fn,
    Array.from({ length: fn[0][1] }, (_, index) => CallArgument(index, fn)),
    { stack: [], matches: [], selectMatches: false }
  )

export { OuterRef, CallArgument, MatchArgument, Apply, Arm, Match, Lambda }
