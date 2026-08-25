// ==========================================
// Contextual Preparation
// ==========================================

import { CanonicalTuple, contractCheck } from './contract.mjs'
import { Enum, createEnums } from './enum.mjs'
import { Top, isRegion } from './domain.mjs'

const Region = Object.freeze(contractCheck(isRegion))

const { Preparation } = createEnums(() => class {
  Preparation = Enum(
    $ => $(Top, Region, Region, Region, CanonicalTuple, Top)(),
    (...values) => values.length === 6 && values.slice(1, 4).every(isRegion)
  )
})

export { Preparation }
