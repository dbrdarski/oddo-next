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

## 2026-08-20 — formula canonicalization happens at formation

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

### Pre-normalization demands

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

### Pattern boundary

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

**Implementation status (updated 2026-08-24).** Record key ordering is landed.
Formula normalization is not: `Add(1, 2) !== Add(2, 1)`,
`Mul(2, 3) !== Mul(3, 2)`, and literal arithmetic is not folded. The required work
is the structural formation hook, Number polynomial normalizer, retained Match
regions, and their tests—not a second solve-time identity mechanism.

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

**Implementation status.** None of `Top`, `Bottom`, `Null`, `Intersection`, or
`Difference` is landed. `Optional` still exists in current source. The current
matcher also chooses contract fulfilment before Enum decomposition, so the
internal structural route required for contract-formation rules is not landed.

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
That is current pre-normalization behavior, not a permanent canonical-form rule:
once the factory hook exists, it may combine or erase an admitted pure call
immediately in that same formation transaction while preserving the demands and
admission obligations derived from its candidate.
`expand` does not itself perform termination judgment, demand inference, or
solving. Source-to-Lambda lowering and richer recursive-reference layouts are not
landed.
