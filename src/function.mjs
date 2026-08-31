// ==========================================
// Canonical Functions
// ==========================================

import { Enum, createEnums, genericResult, mapEnum } from './enum.mjs'
import { Tuple } from './intern.mjs'
import { Kinds } from './kinds.mjs'
import {
  contractCheck, isContract, isInstance, producedOf
} from './contract.mjs'
import { fact, learn, Consumes, Produces, Callable } from './facts.mjs'
import { match, _ } from './match.mjs'
import { Number } from './numeric.mjs'
import {
  Top, Bottom, Intersection, Union, Equals,
  canonicalizeDomain, registerCanonical
} from './domain.mjs'
import { Canonical } from './canonical.mjs'

const {
  Function: FunctionEnum,
  OuterRef,
  CallArgument,
  MatchArgument,
  Apply,
  Arm,
  Match,
  Lambda,
  FunctionRef,
} = createEnums(() => class {
  Function = Enum($ => $(_, Tuple, Tuple)())
  // References are holes in a canonical form. Their values are supplied
  // only when that form is applied to an ordered reference environment.
  OuterRef = Enum($ => $(Number)(index => () => true))
  CallArgument = Enum($ => $(Number, _)(CallArgument))
  MatchArgument = Enum($ => $(Number)(index => () => true))
  Apply = Enum($ => $(_, Tuple)(genericResult(
    application => fact(application[0], Produces)
  )))
  Arm = Enum(($, [Pattern, Result]) =>
    $(Pattern, Result)(Result))
  Match = Enum($ => $(_, Tuple)(genericResult(
    ([, arms]) => Array.from(arms, arm =>
      resultContractOf(producedOf(arm)))
      .reduce((results, result) =>
        canonicalizeDomain(Union(results, result)), Bottom)
  )))
  Lambda = Enum($ => $(Number, Number, _)())
  FunctionRef = Enum($ => $(Lambda, Tuple)())
})

Kinds.CallArgument = CallArgument.kind

const demandedContract = contract =>
  contract === _ || contract?.generic ? Top : contract

const mergeDemand = (current, demanded) =>
  canonicalizeDomain(Intersection(current, demanded))

const visitDemands = (value, demanded, demands) => match(value)(
  $ => $(CallArgument.kind)(([index]) => {
    demands[index] = mergeDemand(demands[index], demanded)
  }),
  $ => $(Apply.kind)(application => {
    const [target, arguments_] = application
    visitDemands(target, Function, demands)
    const contracts = match(target)(
      $ => $(FunctionEnum.kind)(target => target[2]),
      $ => $(_)(() => Tuple(...Array.from(arguments_, () => Top)))
    )
    return Array.from(arguments_, (argument, index) =>
      visitDemands(argument, contracts[index], demands))
  }),
  $ => $(FunctionEnum.kind)(() => null),
  $ => $(Enum)(candidate => {
    const contracts = fact(candidate.constructor, Consumes)
    return Array.from(candidate, (part, index) =>
      visitDemands(part, demandedContract(contracts[index]), demands))
  }),
  $ => $(Tuple)(tuple => Array.from(tuple, part =>
    visitDemands(part, Top, demands))),
  $ => $(_)(() => null)
)

const inputDemandsOf = (E, arity) => {
  const demands = Array.from({ length: arity }, () => Top)
  visitDemands(E, Top, demands)
  return Tuple(...demands)
}

const canonicalBody = E => match(E)(
  $ => $(FunctionEnum.kind)(() => E),
  $ => $(Enum)(candidate =>
    mapEnum(candidate, canonicalBody)[Canonical]),
  $ => $(Tuple)(tuple => Tuple(...Array.from(tuple, part =>
    canonicalBody(part)))),
  $ => $(_)(() => E)
)

const containsCallArgument = value => match(value)(
  $ => $(CallArgument.kind)(() => true),
  $ => $(FunctionEnum.kind)(() => false),
  $ => $(Enum)(candidate => candidate.some(containsCallArgument)),
  $ => $(Tuple)(tuple => tuple.some(containsCallArgument)),
  $ => $(_)(() => false)
)

registerCanonical(Apply, matches => matches(
  ($, [candidate]) => $(candidate)(candidate => {
    const [target, arguments_] = candidate
    return match(target)(
      $ => $(FunctionEnum.kind)(target =>
        containsCallArgument(arguments_)
          ? candidate
          : canonicalBody(fact(target, Callable)(...arguments_))),
      $ => $(_)(() => candidate)
    )
  })
))

const resultContractOf = value => match(value)(
  $ => $(FunctionEnum.kind)(() => Function),
  $ => $(_)(() => isContract(value)
    ? value
    : producedOf(value) ?? Equals(value))
)

const formFunction = (bodyForm, ...outerRefs) => {
  const references = Tuple(...outerRefs)
  const callable = bodyForm(...references)
  const arguments_ = Array.from(
    { length: callable.length },
    (_, index) => CallArgument(index)
  )
  const E = callable(...arguments_)
  const contract = inputDemandsOf(E, arguments_.length)
  const C = canonicalBody(E)
  const fn = FunctionEnum(C, references, contract)
  learn(fn, Callable, callable)
  learn(fn, Produces, resultContractOf(E))
  return fn
}

export const Function = contractCheck(
  value => isInstance(value, FunctionEnum),
  formFunction,
  { kind: FunctionEnum.kind }
)

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
