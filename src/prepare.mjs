// ==========================================
// Contextual Preparation
// ==========================================

import { contractCheck } from './contract.mjs'
import { Enum, createEnums } from './enum.mjs'
import { Tuple } from './intern.mjs'
import { match, matchDomain, Combine } from './match.mjs'
import { Number, Indeterminate } from './numeric.mjs'
import {
  Top, isRegion, Mul, Difference, Equals
} from './domain.mjs'
import { CallArgument } from './function.mjs'

const Region = contractCheck(isRegion)

const { Preparation } = createEnums(() => class {
  Preparation = Enum($ => $(Top, Region, Region, Region, Tuple, Top)())
})

const Language = {
  Mul, Difference, Equals, CallArgument,
}

const prepareZeroMul = (E, context, {
  Difference, Equals,
}) => {
  const everythingButNumber = Difference(Top, Number)
  const obligations = Tuple()

  return match(context)(
    $ => $(Equals(Number))(() => Preparation(
      E,
      context,
      Number,
      Equals(0),
      obligations,
      0
    )),
    $ => $(Equals(everythingButNumber))(() => Preparation(
      E,
      context,
      Indeterminate,
      Indeterminate,
      obligations,
      E
    ))
  )
}

export const prepare = matchDomain(Language, (matches, language) => context => {
  const { Mul, Equals, CallArgument } = language
  return matches(
    $ => $(Mul.kind)(E => match(Tuple(...E))(
      $ => Combine(Equals(0), CallArgument.kind)(() =>
        prepareZeroMul(E, context, language))
    ))
  )
})

export { Preparation }
