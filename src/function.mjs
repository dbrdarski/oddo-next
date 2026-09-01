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
  CallArgument,
  Apply,
  Arm,
  Match,
} = createEnums(() => class {
  Function = Enum($ => $(_, Tuple, Tuple)())
  CallArgument = Enum($ => $(Number)(CallArgument))
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

export { CallArgument, Apply, Arm, Match }
