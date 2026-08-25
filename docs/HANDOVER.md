# Handover — current matching and canonical-value surface

This document describes committed behavior beginning with `cf99272` and separates
the first landed preparation slice from the broader canonicalization target.
`design.md` and `decisions.md` remain the design authority. `npm test` reports
**156 passing, 0 failing**.

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
  endpoint seats. Contextual preparation may therefore need an explicit internal
  structural-decomposition route for contract-valued Enum values; that route does
  not change runtime contract-pattern meaning.
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

## 7. Contextual formula preparation

Enum factories validate, construct, and structurally intern their nodes. Once
writing, lowering, or expansion has produced a complete pre-normal expression,
that durable form is `E`. Canonicalization is a later pure contextual stage:

```text
retain complete expanded/pre-normal E
+ explicit semantic context
→ derive accepted region, result contract, obligations, and canonical C
→ retain E, C, and their preparation evidence
→ a later separate judgment may derive retained S
```

The landed API is `prepare(E)(incomingContract)`. The incoming context is that
direct canonical region contract—not a context Enum or a Tuple wrapper. The result
is an ordinary canonical Enum with exactly this field order:

```text
Preparation(E, context, accepted, resultContract, obligations, C)
```

The context field retains the supplied contract and obligations is a canonical
Tuple. The same `(E, context)` has one result, while the same `E` may canonicalize
differently under different incoming regions. Context is explicit, never ambient
state. The Preparation value itself retains `E` beside contextual `C`; there is no
dedicated `(E, context)` lookup cache or facts-side association, while ordinary
Enum interning still canonicalizes equal Preparation values. Correlated
multi-argument contexts are unsupported and remain unpinned. `mapEnum` is
phase-blind structural rebuilding; it lacks the context required to transform `E`
into `C`. `expand` produces `E` and does not own a special normalizer.

Pattern matching is the implementation mechanism for local rules inside contextual
preparation rather than an Enum/createEnums formation hook. `E`, `C`, and a future
`S` remain in one ordinary value universe. No `S` integration is landed. Retaining
`E` does not give runtime matching an inverse route from `C` to erased operands.

The production rule through `fce81ac` recognizes only literal zero multiplied, in
either operand order, by argument zero of a known unary function:

```text
prepare(E)(Number)
→ Preparation(E, Number, Number, Equals(0), Tuple(), 0)

prepare(E)(Difference(Top, Number))
→ Preparation(E, Difference(Top, Number),
              Indeterminate, Indeterminate, Tuple(), E)
```

Unsupported expressions, dependencies, arities, wrapped contexts, `_`, `Top`, and
all other contexts throw. The two rows are not composed under `Top`: the temporary
`Produces` treatment and `Numeric`'s own wrapper membership make current `Numeric`
wider than exact Number-or-Indeterminate. Even the current
`Union(Number, Indeterminate)` result admits wrapper nodes through the result
fallback. The production slice does not implement general region canonicalization,
full polynomial normalization, obligation analysis, a dedicated preparation cache,
FunctionBody integration, `S`, or multi-argument preparation.

Full polynomial normal form remains the target canonical algebra for an admitted
`Number` region: distribution, coefficient collection and cancellation, identities
and zero annihilation, coefficient-first ordered factors/terms, a last constant,
left-associated products and sums, `Pow` for repeated factors, and retained `Sub`
for negative later terms. Geo remains separate from Pow.

There is no `DeterminateNumber`. `Numeric = Union(Number, Indeterminate)`. The
Number rules apply only on its Number region; zero multiplication of the ruled
DivideByZero-style specimen remains Indeterminate, with exact cause/Kind and
broader consuming algebra deferred. Consequently unguarded `n => 0 * n` derives
a Numeric accepted region, not a Number-only arm. An explicit Number guard prepares
its body under Number and may project it to zero while retaining that demand.

Demands and call-admission obligations are derived from durable `E` before algebra
erases syntax from `C`. Accepted region, result contract, obligations, and `C` are
distinct outputs. Canonical Match rows may encode their correlated partial mapping,
but do not replace `E`. An admitted Pure, safe, completing call may disappear from
`C`. A known call can discharge during preparation; unresolved references retain
obligations for a later boundary. Failure never selects a fallback canonical body.

The landed `FunctionRef(form, orderedReferences)` identity is unchanged. Precisely
where prepared `C` becomes the target canonical FunctionBody while retaining its
associated `E`, and whether the existing identity account needs extension, remain
unpinned and require author judgment. No accepted-domain field or Top filler is
added by this ruling.

`Top`, `Bottom`, one language `Null`, and strict binary `Union`, `Intersection`,
and relative `Difference` are landed as structural membership forms. `Optional`
is removed in favor of `Union(Null, T)`, and `LL` has an explicit `Null` terminator.
Only the manually invoked `Union(C, C) → C` canonicalization rule is landed; the
general region laws remain target work. An ordered Match will thread a running
remainder. Selecting an exact arm commits its complete effective region: that
region is subtracted before the next arm even if its body accepts less. Body
rejection does not become fallthrough. `Rest` is only the name of this calculation.

Pure exact logical code still canonicalizes to region-to-result Match/Arm rows. De
Morgan and DNF-style splitting are internal techniques, not public nodes. Strict
conditional seats require Boolean; `~` is legal only there and loosens the seat
without Booleanizing it. Grouped `~(...)` scopes through nested conditional seats,
stopping at Lambda and explicit arm boundaries. Loose falsity is `{false, Null}`;
zero is truthy.

## 8. Implementation backlog

- Replace the temporary `Produces`/declared-result bridge. Function
  `CallArgument`, `Apply`, and `Match` currently rely on it to stand at Numeric
  seats.
- Extend the landed direct-context Preparation beyond its two zero-multiplication
  judgments: compose incoming `Top` after correcting `Produces`/`Numeric`; implement
  Number polynomial form and Pow; obligations; every other expression/context
  rule; and eventual FunctionBody association. No cache, `S`, or multi-argument
  preparation is currently present.
- Implement region normalization beyond `Union(C, C) → C`: Top/Bottom laws,
  flattening/order, containment/disjointness, effective Match remainders and Pure
  logical regions, region exactness and guard/`~` lowering, Number/Null host ingress,
  and conformance/property tests. The region constructors and Optional removal are
  already landed.
- Investigate Geo with its actual domain consumer and specify broader
  Indeterminate-consuming algebra separately.
- The later solve, termination, and call-domain judgments are separate layers.
  Their exact input/API is unpinned; retained `S` never replaces `E` or `C`.

## 9. Document map

- `docs/design.md` — current core design and committed surfaces.
- `docs/decisions.md` — dated rulings and explicitly pending corrections.
- `docs/HANDOVER-recursion.md` — committed canonical-function behavior.
- `docs/recursion-canonicalization-arc.md` — historical investigation record;
  proposals there are not current design unless restated in the files above.

*End of handover.*
