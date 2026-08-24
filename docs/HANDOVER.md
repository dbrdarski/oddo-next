# Handover — current matching and canonical-value surface

This document describes committed behavior beginning with `cf99272` and labels the
later ruled-but-unimplemented canonicalization target separately. `design.md` and
`decisions.md` remain the design authority. `npm test` reports **109 passing,
0 failing**.

The old ambient pattern-construction window was reverted. There is no `asPattern`
flag, cleanup protocol, or construction residue in the current design.

## 1. Canonical values and Enum identity

- `Tuple`/`Record` calls and values produced by Enum factories enter through the
  shared interner. The factories themselves are lazily memoized, not interned.
- `ZeroDivision` and `ZeroMod` are additional canonical front doors keyed by
  their form class and operand.
- Equal live constructions return the same frozen reference.
- Enum identity is its hidden node class. Factories expose that class as `.kind`;
  the ordinary JavaScript `.constructor` remains the node's constructor.
- `mapEnum(value, map)` rebuilds a registered Enum through its original factory, so
  validation and interning remain the one construction path.

## 2. Structural pattern matching

`match(value)(...cases)` uses four rules, in this order:

1. `_` matches anything.
2. A contract pattern uses ordinary membership: `value instanceof pattern`.
3. An Enum pattern requires the same node constructor and length, then recursively
   fits its parts.
4. Every other pattern uses canonical identity: `value === pattern`.

Cases are tried in declaration order and the first fit wins. If no case fits,
`match` throws `No pattern matched`.

Patterns are ordinary canonical values, not a second pattern hierarchy. Admission
is decided by the Enum being constructed:

- A structural Enum such as `Add`, `Mul`, or `LL` may hold contract parts at its
  non-generic seats. Therefore `Add(Number, 2)` is a legal partial structural value
  and can be used as a pattern.
- A bare membership-defined Enum pattern is interpreted as a contract and tested
  by fulfilment before structural Enum matching. For example, `Range(1, 2)` is a
  membership pattern, while `Range(Equals(1), Equals(2))` is rejected by Range's
  endpoint seats. The ruled canonicalizer therefore needs an explicit internal
  structural-decomposition route for contract-valued Enum candidates; that route
  does not change runtime contract-pattern meaning.
- Generic seats keep their identity-binding semantics; the structural contract
  admission rule does not bypass them.

There is no pattern-only construction mode. The same constructor has the same
meaning everywhere.

## 3. Generic captures and handlers

Each ordered case receives fresh generic state. A generic binds the matched value on
first use; a repeated occurrence checks canonical identity. Failed cases discard
their state.

For ordinary ordered cases:

- only generic captures become handler arguments;
- arguments follow generic creation/declaration order, not their order in the
  structural pattern;
- a top-level contract-only pattern receives the matched value;
- `_` contributes no argument.

Example:

```js
match(Add(1, 2))(
  ($, [a, b]) => $(Add(b, a))((aValue, bValue) => [aValue, bValue])
)
// [2, 1] — handler order is [a, b]
```

## 4. Combine

`Combine(...patterns)` is a case-level matching combinator, not an Enum value.

Its current contract is exact and deterministic:

- the candidate pool must be a canonical `Tuple`;
- pattern count and occurrence count must be equal;
- patterns are not tied to corresponding source positions;
- each candidate occurrence index is used exactly once;
- duplicate values remain distinct occurrences;
- search follows pattern declaration order and candidate occurrence order, so
  candidate order is the deterministic tie-break when several assignments fit;
- overlapping contracts use depth-first backtracking;
- speculative generic bindings are restored after every failed branch;
- successful handler arguments are the assigned occurrences in pattern order.

That last rule intentionally differs from ordinary ordered cases:

```js
match(Tuple(Add(1, 2), 3))(
  $ => Combine(Number, Numeric)((number, numeric) => [number, numeric])
)
// [3, Add(1, 2)]
```

Every Combine pattern contributes one handler argument, including contracts and
wildcards. Generics inside Combine still provide repeated-value and backtracking
constraints.

## 5. Construction failure is not mismatch

Pattern construction and fitting are separate phases.

- If defining a case throws while constructing its pattern, the error propagates
  and the whole match aborts because no valid pattern was produced.
- Fallthrough occurs only after a valid pattern has been constructed and `fits`
  returns false.

The matcher does not catch construction errors and reinterpret malformed patterns
as non-matches.

## 6. Function-level Match

Canonical function forms use `Match(scrutinee, Tuple(...Arm))` and delegate fitting
to the same ordered `match()` implementation. `MatchArgument(index)` represents
handler bindings in the function formula; nested matches extend the existing sparse
binding vector. A pending recursive `Apply` in the scrutinee preserves the complete
Match continuation instead of selecting an arm prematurely.

Function forms currently support ordered Arms only. Value-level Combine is landed,
but no Combine arm exists in the function Enum vocabulary.

See `docs/HANDOVER-recursion.md` for canonical function identity and expansion.

## 7. Formula formation ruling

Formula canonicalization is a factory-formation operation implemented with the
existing matcher:

```text
validate arguments
→ construct the actual Array-subclass Enum candidate
→ match that candidate to select its canonical replacement
→ intern the surviving node, or return the canonical replacement
```

The candidate gives the matcher ordinary Enum structure before publication. It is
not a second AST or a separate solve-time identity. Rebuilding through `mapEnum`
continues to use the same public factory, so expanded formulas will receive the same
formation rules without an `expand`-specific normalizer.

Full polynomial normal form is the canonical algebra for `Number`: distribution,
coefficient collection and cancellation, identities and zero annihilation,
coefficient-first ordered factors/terms, a last constant, left-associated products
and sums, `Pow` for repeated factors, and retained `Sub` for negative later terms
(a leading negative term uses a signed coefficient such as `Mul(-1, x)`). Geo is a
separate important contract/domain feature; it does not replace Pow.

There is no `DeterminateNumber`. `Numeric = Union(Number, Indeterminate)`, and the
Number laws apply on its Number region. The ruled specimen
`0 * Indeterminate(DivideByZero(...))` remains Indeterminate; its exact cause/Kind
and broader consuming algebra are deferred. Host JavaScript NaN/infinity/signed-zero
cases are ingress concerns, not additions to the language Number theory.

Demands and call-admission obligations come from the validated pre-normalization
candidate. Canonical Match regions retain them only where they apply; no
always-present accepted-contract field, Top filler, or separate Demand node is
required. An admitted Pure, safe, completing Number call may disappear from the
polynomial immediately while its obligations remain accounted for. A later outer
reference decides whether those obligations discharge, not which canonical body is
chosen; failure rejects rather than selecting a fallback body.

Canonical function identity remains `(canonical FunctionBody, ...orderedRefs)`.
The body is canonicalized positionally, references are applied, and retained
obligations are discharged. There is no application-dependent second normalizer.

The contract target adds `Top`, `Bottom`, one language `Null`, `Intersection`, and
relative `Difference`, and removes `Optional` in favor of `Union(Null, T)`. Explicit
host null/undefined normalize at host ingress; omission and missing structure do
not.

An ordered Match threads a conceptual remainder. Each effective arm is its own
region intersected with the remaining input region; every exact arm is subtracted
from that remainder with Difference before the next arm. Thus in
`Equals(0) => a; Number => b`, the Number arm means
`Difference(Number, Equals(0))`. `Rest` is only the name of this calculation, not a
new Enum or pattern. A wildcard at any position receives the current remainder.

Pure exact logical code canonicalizes to region-to-result Match/Arm rows. De Morgan
and DNF-style splitting are internal techniques, not public nodes. Strict
conditional seats require Boolean; `~` is legal only there and loosens the seat
without Booleanizing it. Grouped `~(...)` scopes through nested conditional seats,
stopping at Lambda and explicit arm boundaries. Loose falsity is `{false, Null}`;
zero is truthy.

Internal rules may structurally bind operands on a transient candidate before a
rewrite erases them. Runtime/user matching sees only the canonical value: it never
recovers source order or erased operands. Closed patterns canonicalize like closed
data; open patterns describe only surviving canonical structure.

## 8. Implementation backlog

- Replace the temporary `produces`/declared-result bridge. Function
  `CallArgument`, `Apply`, and `Match` currently rely on it to stand at Numeric
  seats.
- Implement the ruled formation hook and internal structural match route; Number
  polynomial form and Pow; Top/Bottom/Null/Intersection/Difference and Optional
  removal; contract theory rules; effective Match remainders and Pure logical
  regions; region exactness and guard/`~` lowering; retained-obligation inference
  and discharge; Number/Null host ingress; and conformance/property tests.
- Investigate Geo with its actual domain consumer and specify broader
  Indeterminate-consuming algebra separately.
- Any demonstrator-specific `solve` API, termination judgment, or call-domain
  judgment is a separate layer and does not define formula identity.

## 9. Document map

- `docs/design.md` — current core design and committed surfaces.
- `docs/decisions.md` — dated rulings and explicitly pending corrections.
- `docs/HANDOVER-recursion.md` — committed canonical-function behavior.
- `docs/recursion-canonicalization-arc.md` — historical investigation record;
  proposals there are not current design unless restated in the files above.

*End of handover.*
