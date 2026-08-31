# oddo.next — decisions

Topic-grouped dated record of rulings and their evidence. Amendment dates can
therefore postdate a following topic's original entry. `design.md` stays the
settled specification; entries here capture what was decided, on what grounds,
and what remains open before the specification absorbs it.

## 2026-08-31 — retire the production Preparation scaffold

**Implementation status.** The isolated `prepareZeroMul` experiment, its
six-field `Preparation` Enum, and their direct production tests have been removed.
No production `prepare(E)(incomingContract)` API remains. The separate
`test/contextual-prepare.model.mjs` reference model stays as specification
pressure; it is not imported by production code.

The live path now derives a Function's ordered input demands from its complete
expanded body `E`, recursively rebuilds that body through Enum doors, and uses the
stored child `Canonical` forms for function identity. `Mul` owns its ordinary
Pure/context-free zero rule. The removed scaffold had no caller in this path.

This removal does not reverse the semantic ruling that an actual enclosing
`Number` restriction can permit `Mul(0, x) → 0` while retaining the `Number`
demand. That explicit incoming-region case is currently unimplemented. It must be
integrated at the proper function/body canonicalization boundary rather than by
restoring the orphaned `Preparation` API.

## 2026-08-30 — Enum construction retains E and writes context-free C

**Ruling (Dane), landed in the current slice.** An Enum factory validates and
structurally interns its candidate `E`, writes its context-free canonical form at
`E[Canonical]`, and returns `E`. It never replaces the published expanded
candidate with its canonical result:

```js
candidate[Canonical] =
  constructor[Canonical]?.(candidate) ?? candidate

return candidate
```

`registerCanonical(EnumType, rule)` installs the rule directly on
`EnumType.kind[Canonical]` and supplies a matcher already bound to the candidate.
There is no recursive `canonicalize` function and rules do not receive a second
candidate argument. During a registered canonical match, `Combine` reads each
immediate operand's already-written `Canonical` form; ordinary runtime matching
continues to receive written values. An unmatched rule preserves the candidate.

`Number` and `Number.kind` express different relations. `Number` remains the
semantic contract used for seat fulfilment, including symbolic `CallArgument`
admission. `Number.kind` means a direct known Number and excludes that symbolic
admission. The initial `Add` rules use `Number.kind` to fold two known numbers to
`Equals(left + right)`, shift either side of a `Range` by a known Number, and add
two Ranges endpoint-wise.

These rules are context-free. They do not decide explicit incoming-region
annihilation or implement full polynomial normalization. Function formation now
selects stored `Canonical` forms for identity; the later 2026-08-31 status removes
the old production `Preparation` scaffold.

## 2026-08-29 — symbolic formation and concrete application are separate

**Legacy implementation status.** The Lambda-based expansion path invokes its
body with owner-qualified `CallArgument` values. The nonrecursive callable
formation path described below supersedes that representation: it invokes the
actual body with ownerless `CallArgument(index)` values. Neither symbolic path
selects a `Match` arm.

Concrete application is a separate operation:

```js
apply(fn, ...arguments)
```

Only this concrete path delegates a `Match` to the ordinary ordered matcher and
selects an arm. If its scrutinee still contains a residual `Apply`, the continuation
remains unresolved. This phase split does not change recursion: exact function
re-entry still returns the same residual `Apply` form.

## 2026-08-20 — declared result bounds (corrected 2026-08-26)

**Final ruling (Dane).** `Produces` is retained. A contract in an Enum's result
slot is the widest possible result contract for that form. Facts and later
contextual judgments may prove a narrower result for a particular value and context, but
that refinement must remain within the declared bound. For example:

```text
E = Mul(2, 3)
Produces(E)          = Numeric
refined result       = Equals(6)
C                    = 6
```

The declared bound is what permits ordinary expression nesting before the
narrower facts exist. `producedOf`, the `Produces` fact, and stands-at admission
therefore remain part of the design.

Prototype inheritance under a factory-shaped result contract is only a possible
implementation refactor of the same static membership. It adds no language
meaning and is not a replacement for `Produces`; node-shaped, generic, per-value,
and contextual results still require the explicit result relation. The earlier
source sketch saying that an Enum could extend its return contract belongs at
that implementation level.

The previous diagnosis in this entry incorrectly called `Produces` imported
machinery and promoted prototype chaining into a semantic alternative. That
diagnosis is superseded. The actual function-layer defect is narrower:
`CallArgument`, `Apply`, and `Match` currently use blanket `Numeric` bounds.
Those declarations are temporary formation scaffolding, not inferred function
return contracts. In the target function-formation pipeline, input demands are
inferred from the complete pre-normal candidate before canonicalization and the
result contract is derived rather than stored as an independent identity field.
Residual recursive calls and symbolic Matches require later obligation machinery.
Correcting these declarations does not remove `Produces` from ordinary
result-bearing forms.

**Legacy implementation status.** Static `Produces` and node-anchored generic
results are landed. Commit `ffb474f` had retained contextual refinements in the
later-removed `Preparation` prototype; the callable-function ruling below
supersedes that as the target formation boundary. General refinement, containment,
and replacement of the temporary function-form declarations remain future work.

## 2026-08-25 — nominal Tuple, Record, and Enum recognition landed

**Implementation status through `d10cf15`; no new semantic ruling.** Tuple and
Record remain peer doors on the shared interner rather than Enums, but their
demonstrator values are now nominal Array/Object subclasses recognized directly by
`isInstance(value, Tuple)` and `isInstance(value, Record)`. Numeric singleton
Tuple construction preserves the element rather than invoking Array's length overload. Record identity
uses sorted key/value entries and preserves an own `__proto__` entry as an ordinary
data property.

The existing Enum registry now defines `isInstance(value, Enum)`; runtime structural
matching uses that nominal relation, so Tuple and Record values are not mistaken
for Enums. Enum seats and `Combine` use Tuple itself directly. The parallel
`CanonicalTuple` contract and reconstructive `isTuple` probe have been removed.
These changes preserve the three distinct identity namespaces and do not make
Tuple or Record into Enums.

## 2026-08-28 — canonical values use Oddo's mutation boundary

**Ruling (Dane), reflected in the current working slice.** Ordinary Oddo code
cannot mutate values. Mutation is confined to mutator functions, which proxy
objects and copy them on edit/set. A published canonical reference is therefore
never edited in place; mutation produces a distinct value. The original pre-NEXT
Oddo implementation already follows this rule.

This repository does not implement those mutators or prevent direct host-JavaScript
writes; its controlled pipeline assumes that published values are not edited in
place. The demonstrator therefore trusts the language boundary rather than
duplicating it with host hardening. The interner caches and returns canonical
references without `Object.freeze`, and freezing is not used as provenance.
Private contracts, lookup objects, and test-model records likewise need no
scattered freezing. Runtime representation choices do not participate in
canonical identity.

## 2026-08-27 — internal form constructors are not lint boundaries

**Ruling (Dane), implemented in the current working slice.** The demonstrator's
lowering, expansion, and canonicalization machinery controls the internal forms it
constructs. Their reusable Enum definitions must therefore remain at the highest
useful abstraction instead of defensively rechecking every promise made by that
producer.

Declared Enum seats, generic binding, construction, and interning remain the form
mechanics. Enum's optional cross-argument validator remains an available language
facility, but it is not a default hardening layer and none of the current internal
Domain or function-form declarations needs it. Source validity and
producer invariants belong in lowering, a linter, or the semantic judgment that
actually needs them.

Accordingly, the following constructor/helper checks were removed:

- `Range(lo, hi)` no longer rejects `lo > hi`; the reversed interval is an
  expressible empty form and may later canonicalize to `Bottom`;
- region factories no longer recheck branch contract-ness, arity, or stored `_`
  syntax at their low-level doors; the ruled binary contract vocabulary and the
  prohibition on persistent `_` remain lowering/canonicalization rules;
- function-form constructors no longer recheck whole indexes/counts, owner kinds,
  arm collections, outer-reference bounds, or host-function absence;
- `internFn`, symbolic argument substitution, invocation, and `expand` no longer
  duplicate producer checks for reference counts, indexes, call arity, or nominal
  entry type;
- the now-removed `Preparation` prototype did not repeat constraints already
  stated by its seats.

This is not a ruling that malformed source is valid. It is a ruling about where
validity is established. Operational rejection remains where it selects an actual
semantic boundary—for example, an unsupported preparation judgment, an
unmaterializable callee, or a match with no fitting arm.

## 2026-08-26 — transient contract values forward through `valueOf`

**Ruling (Dane), implemented in `e6e09a0` and named explicitly in the current
slice.** Oddo exposes separate direct-instance and semantic-fulfilment relations:

```js
fulfills(value, Contract) = isInstance(value?.valueOf(), Contract)
```

`isInstance(value, Constructor)` is the sole wrapper around JavaScript's direct
instance relation. `fulfills(value, Contract)` adds transient-value forwarding;
the current `CallArgument` symbolic-admission rule is its one explicit precheck.

`Equals(value)` is a transient exact contract whose `valueOf()` returns its
nested value. `Indeterminate.valueOf()` returns the complete current instance;
ordinary Tuple, Record, Enum, and `Numeric(...)` values already retain themselves.
Consequently `fulfills(Equals(6), Number)` and
`fulfills(Equals(6), Range(0, 10))` are true, while an Indeterminate remains
outside `Number` and inside `Numeric`.

Use `fulfills` for semantic contract fulfilment: Enum seats, transparent
delegation, contract patterns, and consuming contract definitions. Use
`isInstance` for direct Tuple, Record, Enum, and exact syntax-kind recognition.
Generic pattern capture also retains the original value; it does not replace a
captured `Equals(...)` contract with its forwarded payload.

## 2026-08-20 — formula canonicalization happens at formation (placement superseded)

**Superseded on 2026-08-25 and amended again on 2026-08-26.** This entry remains
as decision history. Its Number polynomial form, canonical ordering,
pre-normalization-demand principle, Numeric split, and Indeterminate boundary
remain in force. Canonicalization is not performed inside an Enum factory and
`mapEnum` does not automatically normalize. The 2026-08-25 replacement retained
the expanded form; the latest callable-function ruling below makes it temporary
formation input instead.

**Ruling (Dane), amended through 2026-08-24.** A formula factory produces its
canonical result before publishing it to the interner. Canonicalization is part
of formation, not a later `solve` result and not a second identity layer.

Pattern matching is the implementation mechanism. The relevant factory path is:

```text
validate the supplied arguments
→ construct the actual Array-subclass Enum candidate
→ use structural matching to select its canonical replacement
→ intern the surviving canonical node, or return the canonical replacement
```

The candidate is a real Enum instance available inside the factory transaction.
It is not a second public formula value. The interner remains shallow and does no
rewriting. `mapEnum` rebuilds through the registered public factory and therefore
uses the same formation rules; `expand` does not own another normalizer.

Contract-valued Enums require an explicit structural route for formation rules.
The runtime matcher must continue to interpret a bare contract pattern by
fulfilment. This is one matching engine with two explicit relations—Enum-form
decomposition for canonicalizer rules and contract fulfilment for program
patterns—not a global reversal of matcher precedence.

### Number polynomial form

There is no `DeterminateNumber` contract. The numeric vocabulary is:

```text
Number
Indeterminate
Numeric = Union(Number, Indeterminate)
```

Full polynomial normalization is the canonical algebra for `Number` expressions.
It includes:

- canonical children and positional/de-Bruijn references before parent identity;
- associative flattening and deterministic commutative ordering;
- literal and coefficient folding;
- distribution into a canonical sum of monomials;
- like-term coefficient collection, including complete cancellation;
- neutral identities and zero annihilation;
- `Pow` for repeated factors and non-negative integer powers;
- division by a known nonzero literal coefficient where the result remains
  polynomial.

The canonical emitter is deterministic: coefficients precede their factors,
factors and terms use stable structural order, the constant term is last, and
binary products and sums are left-associated. `Add(x, x)` becomes `Mul(2, x)`. `Sub` remains
in the output vocabulary. The polynomial accumulator may use signed coefficients;
a leading negative term uses its signed coefficient (for example `Mul(-1, x)`),
while later negative terms are emitted with `Sub`. Eliminating `Sub` would only
shrink the emitter/downstream grammar and provides no additional equality.

`Geo` does not replace `Pow`. `Pow` is a value expression; `Geo` is a contract
for an important multiplicative set and remains a separate domain feature to be
specified with its consumer. General variable division, transcendental functions,
and broader exceptional algebra are outside this first polynomial form.

Language `Number` semantics—not JavaScript's host-number edge cases—govern the
algebra. `NaN`, infinities, and signed zero are not extra author decisions for the
canonicalizer. A host boundary must reject or normalize values that are not
language Numbers. An exact-rational package may be an implementation aid, but is
neither the language definition nor a prerequisite for closing this specification.

### Pre-normalization demands (principle retained; old placement superseded)

The accepted-input, safety, purity, result, and completion requirements are
derived from the validated expression before algebra erases syntax. They remain
in the canonical meaning. For functions, the ordered input-demand contracts are
explicit components of identity; `Top` fills an unconstrained parameter seat.
There is no separate `Demand` node.

For example:

```text
x => 0 * x   → contract Tuple(Numeric), canonical body x => Mul(0, x)
x => x * 0   → contract Tuple(Numeric), canonical body x => Mul(0, x)
x => 0       → contract Tuple(Top),     canonical body x => 0
```

The first two spellings have the same identity after Mul ordering. They remain
different from the constant function because multiplication demands `Numeric`.
Under an actual enclosing `Number` restriction, zero annihilation may produce
body `x => 0` while `Tuple(Number)` preserves that restriction. Canonicalization
does not invent Match arms merely to record these demands; source-written Match
arms remain ordinary program structure.

Calls follow the same rule. A pre-normalization `Apply` exposes its obligations.
An admitted Pure, safe, completing Number call may be combined or erased by the
polynomial rule in that same formation transaction. The algebraic normal form does
not vary with whichever function value is later applied to an outer reference;
that value determines whether the retained obligations discharge. If they do not
discharge at the required boundary, the program is rejected—there is no fallback
noncanonical function body and no second application-dependent normalization.

The function sequence therefore remains:

```text
construct the callable from its complete ordered outer references
→ build the complete pre-normal candidate
→ infer the ordered input-demand contracts
→ canonicalize under those contracts and discharge obligations
→ intern the function value
```

Function identity is the canonical body form, its complete ordered outer
references, and its ordered input-demand contract Tuple. The result contract is
derived and does not add a fourth identity component.

### Numeric and Indeterminate

Number polynomial rules do not erase an `Indeterminate` result. In particular:

```text
0 * Indeterminate(DivideByZero(...)) ∈ Indeterminate
```

The spelling is schematic; the demonstrator currently has peer
`ZeroDivision`/`ZeroMod` forms. The exact cause/Kind and the broader consuming
algebra are deferred. A `Numeric` expression is normalized by the Number rules on
its Number region and the separately ruled Indeterminate behavior on its
Indeterminate region; it is not treated as though every Numeric were a Number.
Where consuming behavior is deferred, no Number-only rule decides that region.

### Pattern boundary (superseded placement and source-boundary account)

The canonicalizer structurally matches the transient pre-publication candidate, so
a rule may bind operands that the replacement erases. Runtime/user matching sees
only the canonical value. It never reconstructs source operands:

```text
transient Mul(0, 5)  → internal rule may bind 5, then publish 0
canonical value 0    → does not match an open Mul(0, a) pattern
canonical Mul(2, x)  → may structurally match Mul(2, a)
```

Closed patterns canonicalize through the same formation doors as closed data.
Open structural patterns describe surviving canonical structure. No algebraic
inverse matcher, source-provenance store, or generic-binding recovery feature is
required.

This ruling does not prescribe the historical probe's public `Term`/`Poly`
representation. A transient polynomial accumulator is an implementation detail;
the published result remains ordinary primitives and Enums. Solving, call-domain
judgment, and termination are separate judgment layers.

**Historical implementation status (updated 2026-08-24).** Record key ordering is landed.
Formula normalization is not: `Add(1, 2) !== Add(2, 1)`,
`Mul(2, 3) !== Mul(3, 2)`, and literal arithmetic is not folded. The required work
was then described as a structural formation hook. That placement is superseded;
the still-missing work belongs to callable function formation as described below.

## 2026-08-25 — retain expanded, canonical, and solved forms (superseded for function formation)

**Historical ruling.** The 2026-08-26 callable-function section below reverses
durable `E` retention and replaces this section's proposed function-identity
integration. The removed `Preparation` code described here remains historical
implementation evidence, not the target representation.

**Ruling (Dane).** Canonicalization is not immediate Enum formation. Ordinary
factories validate, construct, and structurally intern their nodes. Once writing,
lowering, or expansion has produced a complete pre-normal expression, that durable
form is `E`.

Preparation is a pure contextual transformation:

```text
retain complete expanded/pre-normal E
+ explicit semantic context
→ derive accepted region, result contract, obligations, and canonical C
→ retain E, C, and their preparation evidence
→ a later separate judgment may derive retained S
```

This notation states semantic stages, not a concrete JavaScript API or result
object. The ruled laziness may be expressed as a transformer awaiting explicit
context; its production representation remains open.

`E` is never overwritten or treated as a transient candidate. `C` is the
canonical form under the supplied context; the complete preparation judgment also
retains its accepted/result contracts and obligations. `S` belongs to a later
judgment tier and never merges with or replaces either `E` or `C`. The future
judgment's exact input and link key are not yet pinned.

The context is an explicit input to the pure transformer, not ambient mutable
state and not a variable binding inside a contract. It contains the incoming or
effective input region and any semantic seat/dependency information needed by the
expression. The same `(E, context)` has one result, while the same interned `E`
may produce different local canonical results in different contexts. The general
representation of correlated multi-argument contexts remains unpinned and requires
author judgment.

For example, in Oddo/Next source:

```text
f = n => 0 * n

f = n => n :: {
  _ when Number => 0 * n
}

f = n => n :: {
  _ => 0 * n
}
```

The guarded body is prepared under `Number`, so its polynomial projection is
`0` while the Number demand remains in the prepared meaning. The wildcard body
derives its own demand from `E`; from an unconstrained incoming region it admits
`Numeric`, not merely `Number`. Its Number region maps to `0`; its Indeterminate
region remains Indeterminate, with the exact consuming form/Kind still deferred.

The same expression may occur under two effective Match regions:

```text
f = n => n :: {
  _ when Number => 0 * n
  _             => 0 * n
}
```

The first occurrence is prepared under `Number`. The second receives the running
remainder, which excludes the first exact region. Reusing one interned `E` is
therefore compatible with different contextual canonical results.

Demands are derived from durable `E` before algebra erases syntax. Accepted region,
result contract, obligations, and `C` are distinct outputs; canonical Match/Arm
regions may encode the resulting partial mapping, but they do not make `E`
disposable. If an exact Match arm selects a region, that whole selected
region is removed from the running remainder before the next arm even when the
selected body accepts less. Body rejection does not become fallthrough.

A known nonrecursive `Apply` is invoked during expansion; its instantiated body
participates in durable `E`, and Preparation derives contextual `C` from that
expanded body. A residual `Apply` remains structurally present in `E`, where later
machinery must derive its purity, safety, completion, result, and admission
obligations. Discharge failure never chooses a fallback noncanonical body.

Pattern matching remains the rule-selection mechanism, but that answers *how*,
not *when*. Preparation structurally matches durable Enum values. There is no
extra `createEnums`/`Enum` formation callback, the interner remains shallow, and
`mapEnum` performs phase-blind structural rebuilding; it has no incoming context
and cannot transform `E` into contextual `C` automatically. `expand` produces
durable `E`; preparation is an explicit general stage, not an `expand`-specific
normalizer.

Retaining `E` does not introduce a shadow AST: `E`, `C`, and `S` remain in the one
ordinary value universe and use existing canonical construction where applicable.
Nor does it create algebraic inverse matching: a runtime match given `C` cannot
recover erased operands from `E`. The precise source/user pattern-preparation
boundary remains to be pinned with lowering.

The landed `FunctionRef(form, orderedReferences)` identity is not changed by this
ruling. The target integration point at which prepared `C` becomes the canonical
FunctionBody while `E` remains associated, and whether the earlier
`(FunctionBody, ...outerRefs)` account needs any extension, remain unpinned and
require author judgment. This ruling does not add an accepted-domain seat or a
`Top` filler to `FunctionRef`.

**Historical implementation status before the later 2026-08-25 amendment.** The
committed `matchDomain` bound a matcher and Enum domain to a handler without
caching or choosing semantic result shapes. `canonicalizeDomain` was an explicit,
manually invoked root matcher with one `Union(C, C) → C` rule and no production
caller. Contextual preparation existed only as test pressure scaffolding.

**Historical implementation ruling and status (2026-08-25; prototype removed
2026-08-31).** The following describes the removed prototype and is retained as
implementation evidence. There is now no production `prepare` function or
`Preparation` Enum; `test/contextual-prepare.model.mjs` remains only a test model.
The prototype invoked Preparation as
`prepare(E)(incomingContract)`. `incomingContract` is the direct canonical region
contract—not a `Context` Enum and not a one-element `Tuple` wrapper. The canonical
structural result is, in this exact field order:

```text
Preparation(E, context, accepted, resultContract, obligations, C)
```

`context` retains the same direct contract supplied to `prepare`; `obligations` is
a canonical `Tuple`. `E` remains the complete expanded/pre-normal value and `C`
is its result under that context. The `Preparation` Enum itself retains this
association; there is no ambient context, side-store association, or integration
with later solved `S`. Ordinary Enum interning still canonicalizes equal
`Preparation` values; there is no dedicated `(E, context)` lookup cache. Correlated
multi-argument contexts and FunctionBody identity integration remain unimplemented.

The prototype's only production rule recognized zero multiplied, in
either operand order, by a `CallArgument`. Its two admitted contexts and exact
results are:

```text
prepare(E)(Number)
→ Preparation(E, Number, Number, Equals(0), Tuple(), 0)

prepare(E)(Difference(Top, Number))
→ Preparation(E, Difference(Top, Number),
              Indeterminate, Indeterminate, Tuple(), E)
```

Unsupported expressions and contexts remain unprepared instead of acquiring an
invented judgment. In particular, production does not accept `Top`
and does not compose those two rows into an unconstrained result. That composition
remains blocked by inaccurate blanket `Numeric` bounds on symbolic function forms
and `Numeric`'s own wrapper membership. Current `Numeric` is therefore wider than
the exact Number-or-Indeterminate result region. This slice does not implement general region
normalization, full polynomial normal form, obligations, a dedicated preparation
cache, `S`, or multi-argument preparation.

## 2026-08-24 — canonical contracts and logical meaning

**Ruling (Dane).** Adopt `Top` and `Bottom` as the contract-algebra names. They
are denotationally the all-values and no-values contracts (the concepts sometimes
called Any and Never). `_` is extensionally the all-values match region while
remaining captureless wildcard syntax; it is not the named `Top` contract. Future
unconstrained contract seats use `Top`, not `_`.

There is one language `Null` value and contract. Explicit host-nullish values
normalize to it at a host-value ingress; omitted arguments, missing fields,
JavaScript control-flow absence, and arity are not silently converted to Null.
Remove `Optional`; its former meaning is `Union(Null, T)`.

`Union`, `Intersection`, and relative `Difference` form the canonical region
vocabulary. At minimum:

```text
Union:        flatten/order/dedupe/left-associate; Bottom is identity; Top absorbs
Intersection: flatten/order/dedupe/left-associate; Top is identity; Bottom absorbs
Difference:   A\\A = Bottom; A\\Bottom = A; Bottom\\A = Bottom; A\\Top = Bottom
```

Proved containment removes the smaller Union branch, keeps the smaller
Intersection, and makes `A\\B` Bottom when `A` is contained by `B`. Proved
disjointness makes an Intersection Bottom and makes `A\\B` equal A. Unknown
theory relations remain as canonical residual structure; they are never treated as
negative proofs.

Ordered source Match semantics and canonical arm regions are connected by a
running remainder. `Rest` is only a name for this calculation, not a new Enum,
contract, or source pattern:

```text
remaining₀ = incoming region
ownᵢ       = Intersection(patternRegionᵢ, guardRegionᵢ)
effectiveᵢ = Intersection(remainingᵢ, ownᵢ)

if arm i is exact:
  remainingᵢ₊₁ = Difference(remainingᵢ, ownᵢ)
else:
  remainingᵢ₊₁ = remainingᵢ
```

Thus in `Equals(0) => a; Number => b`, the second effective arm is
`Difference(Number, Equals(0))`. Every later arm's effective region excludes every
earlier exact arm, not only a final wildcard. A wildcard has own region `Top`, so it
receives exactly the current remainder. Bottom arms disappear. Only after exact
disjointification may rows be reordered canonically or equal-result regions be
merged. A non-exact/opaque arm consumes no region statically, so its operational
order remains.

For Pure exact code, logical canonicalization is the exact partial mapping from
canonical input regions to canonical result values. The public representation is
ordinary `Match`/`Arm` plus canonical contracts; DNF-style splitting and De Morgan
rewrites are implementation techniques, not another public Boolean AST or BDD.

Strict conditional seats require Boolean: a Match guard, ternary condition, `!`
operand, and the tested left side of `&&` or `||`. `~` is legal only at such a
conditional seat. It loosens that seat; it does not itself produce Boolean. `!`
produces Boolean. A grouped `~(...)` scopes through conditional seats in nested
expressions inside that group (including `~(consume(a && b))`), stopping at a
Lambda or explicit Match-arm boundary; `~consume(a && b)` does not loosen the
inner group. The loose falsy region is exactly `{false, Null}`; zero is truthy.

Representative region/result meanings are:

```text
strict x && y : false → false, true → y; all other x reject
strict x || y : false → y,     true → true; all other x reject
loose  ~x && y: false → false, Null → Null, every other x → y
loose  ~x || y: false → y,     Null → y,    every other x → x
!~x            : false/Null → true, every other x → false
```

The `~x` spellings above occur only in the shown conditional seats. A standalone
`~x` is invalid. Likewise, `~(a && b)` is valid only when that grouped expression
itself occupies a conditional seat; the grouping controls how far loosening scopes.

For strict Boolean inputs, `!(a && b)` and `!a || !b` produce the same disjoint
rows and therefore the same canonical meaning. DNF-style distribution likewise
collapses Pure stable equivalents such as `a && (b || c)` and
`(a && b) || (a && c)`. It does not justify reordering effectful or non-exact
expressions; their reached evaluation order is part of their meaning.

Equivalent Pure exact logical spellings collapse by their region-to-result
meaning, including De Morgan and DNF-equivalent spellings, while preserving their
pre-normalization demands. Effectful code and non-exact ordered matches are not
reordered under that rule.

**Implementation status through `f232b36`.** `Top`, `Bottom`, and the one language
`Null` are canonical zero-seat membership-defined Enum values/contracts. Binary
`Union`, `Intersection`, and `Difference` contract Enums are also landed. No
parallel contract-construction helper remains. `_` remains invalid as a stored
region branch in the canonical language, but the reusable factories no longer
duplicate that lowering rule as construction-time lint. `Optional` is removed and
`LL` uses an explicit `Null` terminator through `Union(Null, LL)`.

The manually invoked `canonicalizeDomain` kernel now lands immediate
deduplication; Bottom identity and Top absorption for Union; Top identity and
Bottom absorption for Intersection; and `A\\A = Bottom`, `A\\Bottom = A`,
`Bottom\\A = Bottom`, and `A\\Top = Bottom` for Difference. Commutative laws
accept either operand order. Equality is canonical pointer equality. Handlers
inspect only immediate operands, preserve unknown candidates, and never recurse.
Bottom-up traversal, flattening, heterogeneous ordering, left-association,
containment, disjointness, effective Match remainders, and logical normalization
remain unimplemented. Host-nullish ingress normalization is also not
landed.
Ordinary `Produces` semantics apply to these contract atoms: a hypothetical node
whose widest result is `Bottom` or `Null` stands at that atom, although no current
domain constructor declares either result. Inaccurate blanket `Numeric` bounds on
symbolic function forms and current Numeric wrapper membership still block sound
production preparation from an unconstrained `Top` context.

## 2026-08-30 — match exhaustion preserves the input

If no successfully constructed case fits, `match(value)` returns `value` unchanged.
Exhaustion is ordinary identity passthrough, not an error and not an implicit
exhaustiveness assertion.

This does not catch errors raised while constructing a case pattern. Pattern
construction failure retains the separate behavior below.

## 2026-08-22 — pattern construction failure propagates (current behavior)

Pattern construction and pattern fitting are separate phases.

- If a case definition throws while constructing its pattern, the error propagates
  and the whole match aborts. No valid pattern exists to test.
- Fallthrough is only for a successfully constructed pattern whose `fits` check is
  false.

The matcher does not catch constructor refusals and reinterpret malformed patterns
as ordinary non-matches. This is an existing phase boundary, not a pending
skip-versus-abort design fork; the previously documented question was spurious.

## 2026-08-22 — canonical functions and raw recursive formulas landed (representation superseded)

Functions in the demonstrator are canonical Enum values, not native JavaScript
closures. A lowered `Lambda` form is applied to its ordered references by:

```js
internFn(form, ...references)
```

The form and complete ordered reference Tuple are the FunctionRef identity.
Internal Lambda references materialize lazily with the current ordered environment
when resolved. Recursion is detected by an exact-FunctionRef call stack. Re-entry
preserves a residual `Apply` node. Expansion retains all residual calls encountered
along the evaluated symbolic path and retains every complete Match with all of its
continuations.

`expand` is structural symbolic unfolding. At the current commit it retains every
residual call it encounters, because formula canonicalization is not implemented.
That is current expanded-form behavior, not a permanent canonical-form rule:
contextual preparation may combine or erase an admitted pure call from `C` while
preserving durable `E` and the demands/admission obligations derived from it.
`expand` does not itself perform termination judgment, demand inference, or
solving. Source-to-Lambda lowering and richer recursive-reference layouts are not
landed.

## 2026-08-26 — callable function formation and contract-retaining identity

**Ruling (Dane; overrides the function-formation parts of the two sections marked
superseded above, and amended by the later Function-Enum ruling).** A function's
body is an actual callable. The canonical language value is a `Function` Enum
formed through a callable body factory:

```js
FunctionBody(...outerRefs) // returns the callable function
```

For example:

```js
const incrementBody = () => x => Add(x, 1)
```

`Lambda`, `OuterRef`, and `FunctionRef` are not the target function
representation. Recursive calls remain explicit `Apply` values, but recursion is
a later implementation slice.

Canonical function identity has exactly these semantic components:

```text
bodyForm:  canonical function body
outerRefs: Tuple(...complete ordered outer references)
contract:  Tuple(...ordered input-demand contracts)
```

The contract Tuple has one entry per call parameter. An unconstrained parameter
uses `Top`. It contains input demands only; the result contract is derived and is
not another function-identity field.

Function formation proceeds in this order:

```text
complete expanded/pre-normal body E
→ infer the ordered input-demand contract Tuple from E
→ canonicalize E under that complete contract
→ intern by (canonical bodyForm, outerRefs, contract)
```

`E` is an input to this formation transaction, not retained function provenance.
Once it has supplied the demands and canonical key, it may be discarded. In
particular, source operand order is not retained: the arithmetic canonicalizer
decides it. The earlier `Preparation(E, ...)` implementation has been removed; it
does not prescribe the final function representation.

Canonicalization does not manufacture `Match` arms for an unbranched function.
It canonicalizes the body over the function's complete admitted input contract.
Therefore the unguarded function:

```text
f = x => 0 * x
```

derives `Tuple(Numeric)`. Zero annihilation is valid on its `Number` region but
not on its admitted `Indeterminate` region, so its complete canonical body remains
`x => Mul(0, x)`. Commutative ordering makes the reversed spelling identical:

```text
x => Mul(0, x)  ≡  x => Mul(x, 0)
```

Both have the same identity:

```text
bodyForm:  () => x => Mul(0, x)
outerRefs: Tuple()
contract:  Tuple(Numeric)
```

The constant function is different:

```text
x => 0

bodyForm:  () => x => 0
outerRefs: Tuple()
contract:  Tuple(Top)
```

If an actual enclosing contract restricts the parameter to `Number`, then
`Mul(0, x)` may canonicalize to `0` while `Tuple(Number)` preserves the input
demand. No generated branch is needed.

In this JavaScript demonstrator, when separately written candidates reach the
same canonical identity, the first callable attached to the canonical `Function`
Enum is retained thereafter. This does not change their semantic equality. A
future parser/compiler can emit the canonical callable body directly.

**Implementation status (2026-08-29).** The nonrecursive slice is additive and
leaves the legacy recursive evaluator untouched. `Function(bodyForm,
...outerRefs)` now invokes the produced callable with ownerless positional
`CallArgument` values to obtain `E`, derives the ordered input-demand Tuple from
the consuming contracts already declared by the Enums in `E`, derives `C`, and
interns the canonical `Function(C, Tuple(...outerRefs), contract)` Enum. `E` is
not retained. Equivalent zero-multiplication operand order reaches one `C`, while
the inferred `Numeric` demand prevents erasing the argument. An `Apply` already
present in `E` remains an `Apply`; for a direct symbolic argument, formation may
read a known callee Function's input contract but does not invoke or expand that
callee. The first callable for an identity is retained as a fact for later
concrete application. Apply-result refinement, Match-effective regions, generic
correlations, captured nested-function scopes, and recursion are later slices.
