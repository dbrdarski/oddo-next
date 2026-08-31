# Handover — current matching and canonical-value surface

This document describes the current matching and canonical-value surface.
`design.md` and `decisions.md` remain the design authority. The former production
Preparation prototype has been removed. `npm test` reports **195 passing, 0
failing**.

The nonrecursive `Function(bodyForm, ...outerRefs)` formation and formed-`Apply`
slices are recorded in the 2026-08-26 ruling and their later implementation
statuses in `decisions.md`. The retained Lambda/FunctionRef material below
describes the legacy recursive demonstrator, not the target representation.

The old ambient pattern-construction window was reverted. There is no `asPattern`
flag, cleanup protocol, or construction residue in the current design.

## 1. Canonical values and Enum identity

- `Tuple`/`Record` calls and values produced by Enum factories enter through the
  shared interner. Tuple and Record are nominal peer doors: their values satisfy
  `isInstance(value, Tuple)` and `isInstance(value, Record)` and are not Enums.
  The Enum factories themselves are lazily memoized, not interned.
- `ZeroDivision` and `ZeroMod` are additional canonical front doors keyed by
  their form class and operand.
- Equal live constructions return the same canonical reference.
- Enum identity is its hidden node class. Factories expose that class as `.kind`;
  the base `Enum` relation exposes itself as `Enum.kind`, so `$(Enum)` is nominal
  like every other kind pattern. The ordinary JavaScript `.constructor` remains
  the node's constructor.
- `isInstance(value, Enum)` recognizes only values whose hidden constructor is in
  the Enum registry. Tuple and Record therefore cannot be mistaken for structural
  Enums.
- `mapEnum(value, map)` rebuilds a registered Enum through its original factory, so
  declared-seat checking and interning remain the one construction path.
- Every Enum factory returns its expanded candidate `E` and stores its
  context-free canonical form at `E[Canonical]`. With no registered or matching
  rule the property points back to `E`; construction never replaces the returned
  candidate with `C`.

Internal form factories are not linter boundaries. Lowering, expansion, and
canonicalization control the forms they produce, so their reusable constructors do
not duplicate producer promises such as whole indexes, reference bounds, owner
kinds, arm contents, endpoint ordering, or call arity. Source diagnostics belong
in lowering or a future linter; semantic judgments still reject inputs outside the
behavior they implement.

## 2. Structural pattern matching

`match(value)(...cases)` uses five rules, in this order:

1. `_` matches anything.
2. A direct kind pattern such as `Number.kind` uses direct `isInstance`.
3. A contract pattern uses semantic membership:
   `fulfills(value, pattern)`, which forwards `value?.valueOf()` before applying
   the direct `isInstance` relation.
4. A registered Enum pattern and value require the same node constructor and
   length, then recursively fit their parts.
5. Every other pattern uses canonical identity: `value === pattern`.

Cases are tried in declaration order and the first fit wins. If no case fits,
`match` returns its original value unchanged.

Patterns are ordinary canonical values, not a second pattern hierarchy. Admission
is decided by the Enum being constructed:

- A structural Enum such as `Add`, `Mul`, or `LL` may hold contract parts at its
  non-generic seats. Therefore `Add(Number, 2)` is a legal partial structural value
  and can be used as a pattern.
- A bare membership-defined Enum pattern is interpreted as a contract and tested
  by fulfilment before structural Enum matching. For example, `Range(1, 2)` is a
  membership pattern. `Range(Equals(1), Equals(2))` is also valid because the
  transient exact contracts forward their nested endpoints through `valueOf()`.
  Contextual preparation may therefore need an explicit internal
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

- a non-Tuple iterable candidate, including an Enum, is converted to a Tuple at
  the Combine boundary; there is no separate Tuple-recognition contract;
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

`registerCanonical(EnumType, rule)` installs the rule at
`EnumType.kind[Canonical]` and binds it to the candidate's matcher. Only this
canonical matcher reads immediate occurrences through
`occurrence?.[Canonical] ?? occurrence`; ordinary runtime matching retains the
written occurrences. The initial `Add` rules use `Number.kind`, never the broader
`Number` contract, and cover literal addition, Range shifting, and endpoint-wise
Range addition. The Pure `Mul` rule folds known Number zero products, orders a
residual zero first, and preserves unresolved or Indeterminate products. Function
formation derives demands from `E` before selecting stored canonical forms.

## 5. Construction failure is not mismatch

Pattern construction and fitting are separate phases.

- If defining a case throws while constructing its pattern, the error propagates
  and the whole match aborts because no valid pattern was produced.
- Fallthrough occurs only after a valid pattern has been constructed and `fits`
  returns false.

The matcher does not catch construction errors and reinterpret malformed patterns
as non-matches.

## 6. Function-level Match

Canonical function forms use `Match(scrutinee, Tuple(...Arm))`. Symbolic
`expand(fn)` preserves the complete Match and does not select an arm. Concrete
`apply(fn, ...arguments)` delegates fitting to the same ordered `match()`
implementation. `MatchArgument(index)` represents handler bindings in the function
formula; nested concrete matches extend the existing sparse binding vector. A
residual `Apply` in a concrete scrutinee preserves the complete Match continuation.

Function forms currently support ordered Arms only. Value-level Combine is landed,
but no Combine arm exists in the function Enum vocabulary.

See `docs/HANDOVER-recursion.md` for canonical function identity and expansion.

## 7. Explicit-context canonicalization target

Every Enum retains expanded candidate `E` and writes context-free
`E[Canonical]`. Nonrecursive Function formation derives ordered input demands
from complete `E` and then selects canonical body `C`. There is no production
`prepare(E)(incomingContract)` function or `Preparation` Enum.

The removed prototype handled only symbolic zero multiplication under direct
`Number` and non-Number contexts. It had no caller in Function formation. The
separate `test/contextual-prepare.model.mjs` retains broader examples as a
test-only reference, not as a production API or second formula representation.

An explicit `Number` restriction may still permit `Mul(0, x) → 0` while retaining
the Number demand. That ruled behavior is currently unimplemented and must be
integrated at the function/body canonicalization boundary rather than by restoring
the orphaned prototype.

Full polynomial normal form remains the target canonical algebra for an admitted
`Number` region: distribution, coefficient collection and cancellation, identities
and zero annihilation, coefficient-first ordered factors/terms, a last constant,
left-associated products and sums, `Pow` for repeated factors, and retained `Sub`
for negative later terms. Geo remains separate from Pow.

There is no `DeterminateNumber`. `Numeric = Union(Number, Indeterminate)`. The
Number rules apply only on its Number region; zero multiplication of the ruled
DivideByZero-style specimen remains Indeterminate, with exact cause/Kind and
broader consuming algebra deferred. Consequently unguarded `n => 0 * n` derives
a Numeric accepted region, not a Number-only arm. A future explicit-context rule
may project a Number-guarded body to zero while retaining that demand.

Input demands are derived from complete `E` before canonical body `C` participates
in Function identity. Future safety, completion, and call-admission obligations
must follow the same ordering. Canonical Match rows may encode their correlated
partial mapping. Failure never selects a fallback canonical body.

Current nonrecursive Function identity consists of canonical body `C`, its
complete ordered outer-reference Tuple, and its ordered input-demand contract
Tuple. The result contract is derived rather than added as another identity
component. The legacy `FunctionRef(form, orderedReferences)` evaluator remains
separate recursion evidence.

Function formation also derives the callable's widest result contract from
pre-canonical `E` and retains it as a fact on the canonical Function. A formed
`Apply(fn, Tuple(...arguments))` keeps that call node as `E`; its generic
`Produces` relation reads the Function fact without changing `producedOf`.
Literal results retain an exact `Equals(value)` contract, while an expression
such as `Add(1, 1)` retains its declared `Numeric` bound even though its `C` is
`Equals(2)`.

If the target is a formed Function and the argument tree contains no
`CallArgument`, Apply invokes the retained callable and stores the complete
canonical result at `E[Canonical]`. A symbolic call remains its own `C`. This
does not invoke a Function returned by the call, infer recursive results, or
change the legacy evaluator; unresolved/legacy calls retain its temporary
`Numeric` fallback.

`Top`, `Bottom`, and the one language `Null` are canonical zero-seat contract Enum
values; binary `Union`, `Intersection`, and relative `Difference` are the canonical
contract vocabulary. Their reusable factories do not lint branch validity; that is
a lowering/canonicalization responsibility. `Optional` is removed in favor of
`Union(Null, T)`, and `LL` has an
explicit `Null` terminator. The manually invoked root kernel lands deduplication,
Union's Bottom identity and Top absorption, Intersection's Top identity and Bottom
absorption, and the direct Difference laws for equal operands, Bottom, and Top.
It inspects immediate operands only and never recursively normalizes children.
An ordered Match will thread a running
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

- Replace the temporary `Numeric` declarations on `Match` and unresolved/legacy
  Apply without inferring a FunctionRef return theorem: effective Match handling
  and residual-call obligations. `CallArgument` already produces its symbolic
  kind and receives demands from consumers; formed Apply derives its bound from
  its target Function.
- Implement explicit incoming-region canonicalization at the function/body
  boundary without restoring the removed Preparation prototype. The retained test
  model covers the Number/Indeterminate distinction but is not integrated. Number
  polynomial form, Pow, obligations, and every other expression/context rule
  remain future work.
- Extend the landed local region kernel with a separately invoked bottom-up
  traversal, flattening/order/left-association, containment/disjointness, effective
  Match remainders and Pure logical regions, region exactness and guard/`~`
  lowering, Number/Null host ingress, and broader conformance/property tests.
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
