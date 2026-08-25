# oddo.next — decisions

Topic-grouped dated record of rulings and their evidence. Amendment dates can
therefore postdate a following topic's original entry. `design.md` stays the
settled specification; entries here capture what was decided, on what grounds,
and what remains open before the specification absorbs it.

## 2026-08-20 — `produces` is imported machinery (diagnosis; correction pending)

**Ruling (Dane).** The `'produces'` fact, `producedOf`, and the made-by
fallback are imported declared-return-type machinery. They record a promise
about future evaluation ("Add nodes will yield Numerics") and answer a
present-tense membership question with it — classifying the expanded form
by the solved form's type before any solving exists. That is the
expanded-vs-solved tension, and it does not fit the philosophy: one
universe (the node IS the value), and facts record what is or what
happened, never what would happen.

**Evidence.**

- Removing the fallback from both membership paths kills exactly 4 of 53
  board rows — all one thing, node-inside-node nesting (`Add(1, Mul(2,
  3))`, `Add(Add(...))`, `Div` nesting, the nested raw-literal row).
  Everything else stands.
- The nested-Twin bugs un-cause themselves. `Twin(1, Twin(2, 2))` and
  `Twin(Twin(1,1), Twin(2,2))` constructed only because the circular
  `'produces'` entry fed the fallback; without the import both reject on
  seat logic alone, which was always correct. The entire generic-thunk arc
  (node-anchored thunks, seat claiming, the register-poisoning fix) was
  repair work on damage the import itself caused.
- The board was green (53/0) through the whole arc. Green does not detect
  imports — the Rust postmortem's lesson, replayed at demonstrator scale.
  The instrument that caught it was the author's felt-sense that the
  machinery was being patched rather than belonging.

**Replacement (proposed, not landed).** Node-inside-node membership via the
class chain — the author's original extends-the-return-contract idea (the
`extendFn` sketch): at first resolve, an enum whose result is a factory has
its hidden class placed under the result's hidden class, so
`mulNode instanceof Numeric` is structurally true. No fact, no fallback,
no reader.

**Breakage inventory if the correction lands.**

1. The 4 nesting rows — broken by deletion, restored by the chain
   (their results are factories; factories have classes to sit under).
2. One behavioral flip the chain cannot restore: `Numeric(Numeric(1))` —
   constructed today via the fallback, rejected without it. `Numeric`'s
   declared result is the union *node* — an instance, not a class — and a
   class cannot extend an instance. Only live case of a node-shaped
   result. Open ruling: can a box box a box?
3. Observation surface deleted with its subject: `producedOf` as an API,
   the four board rows that watch it, one playground line.
4. `$(E, E)(E)`'s result slot reverts to unruled. Twin's construction and
   rejection behavior is unaffected (seat logic), but the `(E)` states
   nothing again.

Untouched by that diagnosis: construction, seats, identity and interning,
transparency, unions, `Equals`, `Range`, Indeterminate forms, and `LL`
(self-result needs no chain — its own class already answers). `Optional` was
also untouched at the time; the later one-`Null` ruling below supersedes it.

**Doc surgery due when the correction lands:** every current-behavior account of
`produces` in `design.md`—the facts/result/membership sections, the generic thunk
account, domain traces, provisional function typing, and the parked/ruled-out
lists.

**Status (updated 2026-08-22).** Diagnosis ruled; replacement still not landed.
The historical “4 of 53” inventory predates canonical functions. The current
function layer also temporarily declares `CallArgument`, `Apply`, and `Match` as
producing `Numeric`; regression tests directly observe the first two, while the
`Match` declaration is visible in source. Removing `produces` now has to account
for these additional consumers as well as ordinary nested domain nodes. The
`Numeric(Numeric(1))` ruling remains unresolved.

## 2026-08-25 — nominal Tuple, Record, and Enum recognition landed

**Implementation status through `d10cf15`; no new semantic ruling.** Tuple and
Record remain peer doors on the shared interner rather than Enums, but their
demonstrator values are now nominal Array/Object subclasses recognized directly by
`instanceof Tuple` and `instanceof Record`. Numeric singleton Tuple construction
preserves the element rather than invoking Array's length overload. Record identity
uses sorted key/value entries and preserves an own `__proto__` entry as an ordinary
data property.

The existing Enum registry now defines `value instanceof Enum`; runtime structural
matching uses that nominal relation, so Tuple and Record values are not mistaken
for Enums. Enum seats and `Combine` use Tuple itself directly. The parallel
`CanonicalTuple` contract and reconstructive `isTuple` probe have been removed.
These changes preserve the three distinct identity namespaces and do not make
Tuple or Record into Enums.

## 2026-08-20 — formula canonicalization happens at formation (placement superseded)

**Superseded on 2026-08-25.** This entry remains as decision history. Its Number
polynomial form, canonical ordering, retained-demand principle, Numeric split,
and Indeterminate boundary remain in force. Its placement, transient-form,
positional function-integration, and source-pattern-boundary claims do not:
canonicalization is no longer performed inside an Enum factory, the expanded
form is retained, and `mapEnum` does not automatically normalize. The replacement
pipeline is recorded in the next entry.

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
in the canonical meaning. They are represented locally by canonical `Match`/arm
regions where needed; there is no mandatory always-present accepted-contract seat,
no `Any` filler, and no separate `Demand` node in the current design.

For example, over `Number`:

```text
x => 0 * x   → Match(x, Number => 0)
x => 0       → 0
```

The notation shows a partial region-to-result meaning: the first form still
demands a Number even though its polynomial result is zero. Branch-dependent
requirements stay in their corresponding Match regions rather than being flattened
into one global parameter contract.

Calls follow the same rule. A pre-normalization `Apply` exposes its obligations.
An admitted Pure, safe, completing Number call may be combined or erased by the
polynomial rule in that same formation transaction. The algebraic normal form does
not vary with whichever function value is later applied to an outer reference;
that value determines whether the retained obligations discharge. If they do not
discharge at the required boundary, the program is rejected—there is no fallback
noncanonical function body and no second application-dependent normalization.

The function sequence therefore remains:

```text
canonicalize the positional FunctionBody
→ apply its complete ordered outer references
→ discharge the retained obligations
→ intern the function value
```

Function identity remains the canonical FunctionBody plus its complete ordered
outer references. No accepted-domain field is added to `FunctionRef`.

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
the still-missing work belongs to contextual preparation as described below.

## 2026-08-25 — retain expanded, canonical, and solved forms

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

An `Apply` is treated the same way: preparation first derives its purity, safety,
completion, result, and admission obligations from `E`. An admitted call may then
be combined or erased from `C` without an arbitrary extra delay. A known call can
discharge during preparation; an unresolved reference retains obligations for a
later boundary. Discharge failure never chooses a fallback noncanonical body.

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

**Later implementation ruling and status (2026-08-25, through `fce81ac`; overrides
the representation-open language above).** Preparation is invoked as
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

The only production preparation rule currently recognizes zero multiplied, in
either operand order, by argument zero of a known unary function. Its two admitted
contexts and exact results are:

```text
prepare(E)(Number)
→ Preparation(E, Number, Number, Equals(0), Tuple(), 0)

prepare(E)(Difference(Top, Number))
→ Preparation(E, Difference(Top, Number),
              Indeterminate, Indeterminate, Tuple(), E)
```

Unsupported expressions, dependencies, arities, and contexts throw instead of
acquiring an invented judgment. In particular, production does not accept `Top`
and does not compose those two rows into an unconstrained result. That composition
remains blocked by the already-recorded temporary `Produces`/`Numeric`
overmembership. Current `Numeric` is wider than exact Number-or-Indeterminate: it
includes its own wrapper nodes and symbolic Numeric nodes admitted through
`Produces`; even its `Union(Number, Indeterminate)` result admits wrapper nodes via
the same result fallback. This slice does not implement general region
normalization, full polynomial normal form, obligations, a dedicated preparation
cache, `S`, or multi-argument preparation.

## 2026-08-24 — canonical contracts and logical meaning

**Ruling (Dane).** Adopt `Top` and `Bottom` as the contract-algebra names. They
are denotationally the all-values and no-values contracts (the concepts sometimes
called Any and Never). `_` is extensionally the all-values match region while
remaining captureless wildcard syntax; it is not the named `Top` contract. Future
unconstrained contract seats use `Top`, not `_`.

There is one language `Null` value and contract. Explicit host `null` and
`undefined` normalize to it at a host-value ingress; omitted arguments,
missing fields, JavaScript control-flow `undefined`, and arity are not silently
converted to Null. Remove `Optional`; its former meaning is `Union(Null, T)`.

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
`Null` are canonical zero-seat membership-defined Enum values/contracts. Strict
binary `Union`, `Intersection`, and `Difference` contract Enums are also landed.
No parallel contract-construction helper remains. `_` is rejected as a stored
region branch. `Optional` is removed and `LL` uses an explicit `Null` terminator
through `Union(Null, LL)`.

The manually invoked `canonicalizeDomain` kernel now lands immediate
deduplication; Bottom identity and Top absorption for Union; Top identity and
Bottom absorption for Intersection; and `A\\A = Bottom`, `A\\Bottom = A`,
`Bottom\\A = Bottom`, and `A\\Top = Bottom` for Difference. Commutative laws
accept either operand order. Equality is canonical pointer equality. Handlers
inspect only immediate operands, preserve unknown candidates, and never recurse.
Bottom-up traversal, flattening, heterogeneous ordering, left-association,
containment, disjointness, effective Match remainders, and logical normalization
remain unimplemented. Host `null`/`undefined` ingress normalization is also not
landed.
The separately pending `Produces` correction still applies to these contract
atoms: a hypothetical node declared to produce `Bottom` or `Null` would currently
stand at that atom, although no current domain constructor does so.
The temporary `Produces`/`Numeric` overmembership described above still blocks
sound production preparation from an unconstrained `Top` context.

## 2026-08-22 — pattern construction failure propagates (current behavior)

Pattern construction and pattern fitting are separate phases.

- If a case definition throws while constructing its pattern, the error propagates
  and the whole match aborts. No valid pattern exists to test.
- Fallthrough is only for a successfully constructed pattern whose `fits` check is
  false.

The matcher does not catch constructor refusals and reinterpret malformed patterns
as ordinary non-matches. This is an existing phase boundary, not a pending
skip-versus-abort design fork; the previously documented question was spurious.

## 2026-08-22 — canonical functions and raw recursive formulas landed

Functions in the demonstrator are canonical Enum values, not native JavaScript
closures. A lowered `Lambda` form is applied to its ordered references by:

```js
internFn(form, ...references)
```

The form and complete ordered reference Tuple are the FunctionRef identity.
Internal Lambda references materialize lazily with the current ordered environment
when resolved. Recursion is detected by an exact-FunctionRef call stack. Re-entry
preserves a residual `Apply` node. Expansion retains all residual calls encountered
along the evaluated symbolic path; when a Match scrutinee remains pending, it
retains that complete Match and all of its continuations.

`expand` is structural symbolic unfolding. At the current commit it retains every
residual call it encounters, because formula canonicalization is not implemented.
That is current expanded-form behavior, not a permanent canonical-form rule:
contextual preparation may combine or erase an admitted pure call from `C` while
preserving durable `E` and the demands/admission obligations derived from it.
`expand` does not itself perform termination judgment, demand inference, or
solving. Source-to-Lambda lowering and richer recursive-reference layouts are not
landed.
