// ==========================================
// Enum Canonicalization Rules
// ==========================================

import { Canonical } from './enum.mjs'
import { match } from './match.mjs'

export { Canonical }

export const registerCanonical = (EnumType, rule) =>
  EnumType.kind[Canonical] = candidate =>
    rule(match(candidate))
