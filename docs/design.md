# oddo.next — design

Agreed 2026-08-19, before the enum/contract implementation (revised the same
day: the result slot merges C2 and V2), and updated through the author rulings of
2026-08-25. Sections 1–6 preserve the core enum/contract implementation; sections
7–8 describe matching, canonical functions, and the ruled canonicalization layer,
including the first contextual-preparation slice landed on 2026-08-25. This file
and `decisions.md` remain the authority for the surfaces they describe. A
subsection explicitly says when it documents current code rather than the ruled
target.

Current verification: **157 passing, 0 failing**.

## 1. The interner (landed)

The interner never creates a value it returns. It only decides which
already-created reference is canonical: a hit returns the cached reference
(the given duplicate becomes garbage), a miss freezes the given value and
remembers it. Values enter one level at a time — children must already be
interned (or primitive) before their container is constructed — so no walk
recurses, nothing is copied, and no caller's object is ever rewritten.

- One trie, one walk: every path is prefixed by its door-specific tag
  (`Record`, `Tuple`, a hidden Enum class, or an Indeterminate-form class), so
  namespaces are structurally disjoint.
- An unfrozen object child is a raw literal that skipped its constructor:
  rejected with a TypeError at the door.
- Construction lives only in the front doors: `Record` (keyed by sorted
  entries), `Tuple` (keyed by elements), the Enum factories, and canonical
  Indeterminate-form constructors such as `ZeroDivision`/`ZeroMod`. Expansion
  results are not memoized by a separate call cache. Canonical function and
  call syntax such as `FunctionRef` and `Apply` are still ordinary Enum
  constructions, so equal nodes deduplicate normally.

Consequence: structurally equal means pointer-equal, so `===` is value
equality, deep equality is one pointer comparison, and canonical references
are perfect keys.

The cache stores leaves through `WeakRef`. Canonical identity is therefore a
live, process-local property: equal values held at the same time share a
reference, but the interner is not a permanent identifier or serialization
scheme. A value may be reconstructed after every prior live reference has
been collected.

Two boundary facts, stated so they are read as chosen: the JS surface is a
demonstrator, not a hardened API — the door's frozen guard catches
accidents (raw literals that skipped their constructor), not fence-hoppers;
an arbitrary object frozen by hand is outside the model, and legitimate
values exist only through the front doors. And `+0`/`-0` collapse to one
key (JS Map semantics) — deliberate, not accidental: the intended number
model has no signed zero.

## 2. Facts (landed)

System-side metadata lives in one store (`fact(subject, key)` /
`learn(subject, key, value)`, first-write-wins), keyed by the relevant reference:
Enum validators and hidden classes today, nodes and contract pairs later.
Nothing is attached as a property of a value or class—a value remains pure
structure, indistinguishable fresh or analyzed, and facts never participate in
identity.

Current entries are:

- `enum validator → Resolve` — the declaration's once-cached resolver;
- `constructor → Produces` — the declared result, recorded at first
  resolution: a contract, or the declaration's own generic, stored as itself
  and answering per node (§5);
- `constructor → Transparent` — the identical one-seat/result contract for a
  transparent Enum.

`Resolve`, `Produces`, and `Transparent` are shared module-exported Symbols. Fact
identity never depends on repeating a string spelling.

The canonical-function layer currently uses the `Produces` fact as temporary
scaffolding: `CallArgument`, `Apply`, and `Match` declare `Numeric` so their
symbolic nodes can occupy existing Numeric seats. That is not a per-function
input/result signature, and it is not the final account of symbolic result
shape. The pending correction in `decisions.md` must now account for these
consumers too.

The landed `Preparation` Enum now retains one preparation judgment structurally;
it is not stored as a fact or cache entry. Future metadata may retain additional
judgment associations and subcontract verdicts on pairs, but that storage mechanism
and key shape remain unpinned. Complete expanded `E` exists before contextual
normalization; the supported production slice retains contextual canonical `C`
beside it. A later judgment may retain `S` and never replaces either value; no
`S` integration is landed.

## 3. Enums: the three elements

Every Enum factory is a contract; membership-defined Enum nodes are contracts
too. Enums are building blocks of the contract system, but not every structural
Enum node is itself a contract. A declaration has up to three parts:

```js
Name = Enum(
  ($, [T1, T2]) => $(seat1, seat2)(result),   // seats, and ONE result slot
  (...args) => boolean                         // input validation — optional
)
```

- **Seats** (the first application) — one contract per position, checked at
  every construction. Positional, always.
- **The result application** (the second application) — has three current
  uses:
  - **a contract** — `(Numeric)` — the declarative return: recorded once as
    the `Produces` fact. Never "run"; consumed later by *other* seats when
    the node sits in them (`Add(Add(1,2), 3)` works because the inner
    node's recorded fact satisfies the outer seat).
  - **a function** — `((T1, T2) => value => ...)` — the membership
    definition: how a value is checked against nodes of this enum. Called
    by the machinery **with the node's elements as arguments**, it returns
    the value-check. Records nothing as a fact.
  - **empty** — `()` — no meaningful declared result. Canonical function
    syntax uses this for structural nodes such as `Arm`, `Lambda`, and
    `FunctionRef`; the current machinery receives `undefined`, which provides
    no usable `Produces` fact.
  A multi-entry result cannot exist. "Produces A or B" is written explicitly:
  `(Union(A, B))`.
- **Input validation** (Enum's optional second argument) — runs at
  construction over all call arguments together, after the seat checks. Its
  only job is what per-position contracts cannot say: relations between
  arguments (`Range` needs `lo <= hi`). Anything about one argument alone
  belongs in a seat.

For a nonempty result, telling the two forms apart needs no marker: a bare
arrow—no `.prototype`, no `Symbol.hasInstance` of its own—can only be a check.
Everything else is treated as the contract-form result; intended examples are
an Enum factory, a `contractCheck` contract, a class, or a membership-defined
contract node. `undefined` is the explicit empty case described above.

**Parameters, not shared variables.** The membership function receives the
branches as ordinary parameters. JS function parameters are fresh per call
— the language itself provides each check with its own variables, so
checks cannot interfere with each other, nested checks of the same enum
included:

```js
const inner = Union(Number, Indeterminate)
const outer = Union(inner, String)

5 instanceof outer
// call check(inner, String)   → its own T1, T2 → 5 instanceof inner …
//    call check(Number, Indeterminate) → its OWN T1, T2 → true
// … back outside: T2 still holds String. Nothing shared, nothing to restore.
```

A membership function that instead closed over the seat generics lexically
would read shared mutable state and is ruled out (§10).

Each lazy Enum factory also registers its hidden constructor with the public
factory. `mapEnum(value, map)` uses that registry to map one level of a known
Enum value and rebuild it through its original factory. Rebuilding therefore
reruns per-construction validation, generic binding, and interning while reusing
the once-resolved declaration and facts. It does not bypass the front door. It
returns `undefined` for values that are not registered Enums. Recursive
traversal is the caller's job—canonical-function expansion handles Tuples
separately and otherwise leaves non-Enum values atomic.

`mapEnum` reconstruction validates and structurally interns the rebuilt Enum
through that same front door. It is phase-blind and does not by itself transform
expanded `E` into canonical `C`: it has no incoming semantic context. A later
explicit preparation stage uses the matcher to derive and retain `C`. `expand`
produces `E`; preparation is general machinery rather than an `expand`-specific
pass.

## 4. Membership

`v instanceof K` means "v can stand where K is demanded":

1. **Ground contracts** (a `contractCheck` predicate like `Number`, or a
   plain class like `Indeterminate`) answer directly. Every chain ends here.
2. **Enum factory** `F`: true if `v` is an `F`-node; or `v`'s recorded
   `Produces` fact satisfies `F` (stands-at, via `sub`); or `F` is
   *transparent* — then `v instanceof C2`.
3. **Enum node** `n` of enum `E`: if `E`'s result is the function form,
   apply it to `n`'s own elements and then to `v` (plus the stands-at
   clause). A node of an enum whose result is an opaque contract is not itself
   a contract—using it as one fails loudly (native error), never silently.
   Transparency widens the factory's membership; it does not turn each
   transparent wrapper node into a contract.

**Transparency rule**: exactly one seat, a contract-form result, the same
canonical reference as the seat (interning makes "same" a pointer check) →
the enum is a see-through box: what it accepts is what it counts as, so its
membership includes its declared contract's members.

**Opacity is load-bearing**: `Add`'s membership stays "is an Add node"
because solve-time dispatch will depend on shape tests; a widened default
would make `3 instanceof Add` true.

`sub` is reference identity today. Consequently, no containment is currently
derived between distinct `Equals`, `Range`, `Union`, kind, or transparent-box
contracts. Rows such as `sub(Equals(1), Range(0, 100)) → true` and
`sub(Range(0, 10), Range(5, 100)) → false` describe the parked calculable
algebra (§9), not current behavior. That future algebra is restricted to
contracts that expose their structure; opaque `contractCheck` predicates keep
identity-only treatment.

A factory's membership resolves the declaration on demand — first need,
not first construction: `Add(1, 1)` asks `Numeric` before `Numeric` ever
ran, so the check itself triggers the (once-cached) resolve.

Termination is structural, not assumed: membership descends through frozen,
acyclic contract nodes to ground checks; finite declarations, finite
descent.

## 5. Generics

Generics are the declarative layer: array-destructured (positional; an
infinite generator hands them out), they bind the call argument itself on
first use; a repeated seat re-checks by identity, which under interning is
value equality (`Twin = Enum(($, [E]) => $(E, E)(E))`: `Twin(7, 7)` passes,
`Twin(7, 8)` is rejected).

**A generic in the result slot means "makes what it holds"** (ruled with
the Twin arc). The write stays one uniform line — the store holds the
generic itself, the deferred thing, never a flattened copy. The generic's
carrier is a **thunk over the node it is asked about**: seats claim their
generics once at resolve (first seat wins for a repeated generic), and
`producedOf` calls a stored generic with the node, which answers from its
own element — `producedOf(Twin(2, 2))` is `2`, per node, forever, immune
to whatever was constructed since. Per-class sentence, per-node truth.
(`sub` has no rules for value-shaped facts yet, so "makes 1" does not yet
stand at `Numeric` seats — that flips deliberately when the singleton
rules land, §9.)

Membership functions never reference the seat generics. Their parameters
receive the node's elements positionally — the node is the storage of what
was bound, and the parameter names (`T1`, `T2`) match the generic names by
convention only. The declaration is resolved once per enum (`once` stays);
bindings live exactly as long as one construction's validation, with a
single reader. No register survives a job; no register is read by checks
or by facts.

The matcher reuses this same `generic`/`generics` primitive. Every case gets
fresh state; a repeated capture compares by canonical identity. Failed cases
do not leak bindings. `Combine` checkpoints the binding array with `slice()`
and restores it after every failed speculative assignment, preserving sparse
holes as well as values. No second capture implementation exists.

## 6. The domain

This listing summarizes the demonstrator landed through `f60df51`. The region
constructors currently provide strict construction, canonical structural identity,
and membership. The broader normalization laws immediately below remain a target.

```js
export const isRegion = value => isContract(value) && value !== _

const regionArguments = length => (...regions) =>
  regions.length === length && regions.every(isRegion)

const Domain = createEnums(() => class {

  Top = Enum($ => $()(() => value => value != null))
  Bottom = Enum($ => $()(() => () => false))
  Null = Enum($ => $()(() => value => value === Null))

  Union = Enum(($, [T1, T2]) =>
    $(T1, T2)((T1, T2) => value => value instanceof T1 || value instanceof T2),
    regionArguments(2))

  Intersection = Enum(($, [T1, T2]) =>
    $(T1, T2)((T1, T2) => value => value instanceof T1 && value instanceof T2),
    regionArguments(2))

  Difference = Enum(($, [base, excluded]) =>
    $(base, excluded)((base, excluded) => value =>
      value instanceof base && !(value instanceof excluded)),
    regionArguments(2))

  Numeric = Enum($ => $(Union(Number, Indeterminate))(Union(Number, Indeterminate)))

  Add = Enum($ => $(Numeric, Numeric)(Numeric))
  Sub = Enum($ => $(Numeric, Numeric)(Numeric))
  Mul = Enum($ => $(Numeric, Numeric)(Numeric))
  Div = Enum($ => $(Numeric, Numeric)(Numeric))

  Equals = Enum(($, [E]) => $(E)(E => value => value === E))

  Range = Enum(
    $ => $(Number, Number)((lo, hi) => value =>
      value instanceof Number && lo <= value && value <= hi),
    (lo, hi) => lo <= hi
  )

  LL = Enum($ => $(Numeric, Union(Null, LL))(LL))
})

export const Top = Domain.Top()
export const Bottom = Domain.Bottom()
export const Null = Domain.Null()

export const {
  Add, Sub, Mul, Div, LL, Numeric,
  Union, Intersection, Difference, Equals, Range
} = Domain
```

- `Top`, `Bottom`, and `Null` — canonical zero-seat membership-defined Enum
  values/contracts. `Top` admits every language value, `Bottom` admits none, and
  `Null` admits only itself. Raw host `null` and `undefined` are not `Null`; host
  ingress normalization is not yet implemented. Like every current contract,
  these atoms still inherit the separately ruled-for-removal `Produces` fallback:
  a hypothetical node declared to produce an atom would temporarily stand at it.
  No current domain constructor produces `Bottom` or `Null`.
- `Union`, `Intersection`, and `Difference` — binary membership-defined Enums.
  They require exactly two contract branches and reject `_`, which remains wildcard
  syntax rather than a stored region value. `Difference` is ordered.
- `Numeric` — the transparency rule at work: contract-form result identical
  to its one seat; membership reaches `typeof` through declared structure
  only, nothing repeated anywhere.
- `Indeterminate` — a structured exceptional numeric outcome. It is a branch of
  `Numeric`, not a `Number`. The ruled specimen does not turn schematic
  `Indeterminate(DivideByZero(...))` into Number zero under multiplication by
  zero; it remains in `Indeterminate`. The current code defines peer
  `ZeroDivision` and `ZeroMod` forms; the exact future
  cause/Kind and broader consuming algebra are deferred.
- `Add`/`Sub`/`Mul`/`Div` — opaque; stand at `Numeric` seats through the
  recorded fact.
- `Equals` — the singleton: `value === E`, exact because of interning; an
  exact-value contract for matching and later judgments.
- `Range` — a membership-defined two-seat Enum whose nodes are contracts. Seat
  contracts check each endpoint; the input validator enforces `lo <= hi`;
  membership checks the closed interval. Contract objects are not admitted as
  its endpoint values.
- `LL` — a two-seat recursive value with an explicit `Null` terminator. `LL(1)`
  and raw host-nullish tails reject; the empty/terminal tail is written `Null`.

### Canonical contract normalization target (vocabulary landed; laws not landed)

- `Top` is the contract fulfilled by every language value; `Bottom` is fulfilled
  by none. They are the algebraic concepts sometimes called Any and Never. `_`
  is extensionally the all-values match region while remaining captureless
  wildcard syntax; future unconstrained contract seats use `Top`, not `_`.
- There is one language `Null` value and contract. Explicit host `null` and
  `undefined` normalize to that value only at a host-value ingress. Missing
  arguments, absent fields, and JavaScript control-flow `undefined` do not.
- `Optional` is removed in current code. Its former denotation is written
  `Union(Null, T)`.
- `Union`, `Intersection`, and relative `Difference` form canonical regions.
  Union and Intersection flatten, order, deduplicate, and emit one left-associated
  binary shape. They apply the Top/Bottom, proved-containment, and
  proved-disjointness laws recorded in `decisions.md`. Unknown relations stay as
  residual canonical structure.

Only the manually invoked `canonicalizeDomain(Union(C, C)) → C` rule is currently
landed. There is no general region normalization caller, flattening/order pass,
Top/Bottom composition, containment/disjointness solver, effective Match remainder,
or logical canonicalization yet.

### Traces

`Add(1, 1)`:
seat asks `1 instanceof Numeric` → transparent → `1 instanceof
Union(Number, Indeterminate)` → apply Union's check to that node's elements
→ `1 instanceof Number` → typeof → true. Every step is either a declared
check applied to a node's own elements, or ground.

`Add(1, Mul(2, 3))`:
the `Mul` node fails Numeric's chain (not a number, not an Indeterminate)
→ but its recorded fact is `Numeric` → stands-at → true. Values enter
through membership, nodes enter through their recorded facts.

## 7. Runtime matching (landed)

`match(value)(...caseDeclarations)` is an ordered eliminator. Each case
declaration receives the ordinary `caseOf` constructor (`$`) and a fresh
iterator of generics. Cases are tried in source order; the first successful
case returns its handler result. If no case matches, `match` throws a
`TypeError`.

`fits(pattern, value)` has one small decision chain:

1. `_` matches anything and captures nothing.
2. A contract pattern uses `value instanceof pattern`.
3. A structural Enum pattern requires the same hidden Enum kind and arity,
   then recursively fits corresponding seats.
4. Everything else matches by canonical identity (`===`).

Pattern construction and pattern mismatch are not the same event. A case
declaration must first produce a valid pattern. If its declaration or Enum
construction throws, the error propagates and aborts the match. Only a valid,
successfully constructed pattern for which `fits` returns false falls through
to the next case. There is no catch-and-skip arm behavior.

Structural Enums may contain contracts in ordinary non-generic seats, so a
partial tree such as `Add(Number, 2)` is both a legal structural value and a
pattern. Declared value seats still validate normally: `Range(1, 2)` is valid
while `Range(Equals(1), Equals(2))` is not. Generic seats retain their generic
binding behavior. The landed binary region Enums add ordinary input validation on
top: `Union`, `Intersection`, and `Difference` require exactly two contract
branches and reject wildcard `_` as a persistent region operand. This strict
construction boundary is separate from the still-unimplemented algebraic
normalization relation.

An ordinary successful case calls its handler with generic bindings in generic
declaration order, not pattern traversal order. Non-generic pattern parts do
not add handler arguments. As one useful exception, a successful top-level
contract pattern with no generics passes the matched value itself. `_` still
passes nothing.

### Combine

`Combine(...patterns)(handler)` is a separate case combinator for unordered
occurrence assignment. Its matched value must be an exact canonical `Tuple`,
and tuple cardinality must equal pattern cardinality. It searches for a
one-to-one assignment from pattern positions to tuple occurrence indexes:

- duplicate values remain separate occurrences;
- patterns are considered in declaration order;
- candidate indexes are tried in source order;
- failed speculative generic bindings are restored before another assignment;
- backtracking handles overlapping contracts rather than committing greedily.

On success the handler receives every assigned occurrence in pattern order,
including positions whose patterns are contracts or wildcards. This is
deliberately different from an ordinary arm, whose handler receives only its
generic bindings. `Combine` is available in lowercase `match`; the canonical
function `Match`/`Arm` syntax described next does not encode its private case
marker.

## 8. Canonical functions and symbolic expansion (landed)

Functions are represented as canonical Enum values, not opaque host
functions:

```js
Lambda(referenceCount, callArity, formula)
OuterRef(index)
CallArgument(index, owner)
Apply(owner, Tuple(...arguments))
Match(value, Tuple(Arm(pattern, continuation), ...))
MatchArgument(index)

internFn(form, ...orderedReferences) // canonical FunctionRef
expand(functionRef)                  // residual structural formula
```

`Lambda` is an already-lowered function form. `OuterRef(i)` names position
`i` in its ordered reference environment. `internFn` requires exactly the
form's declared number of references and returns a frozen canonical
`FunctionRef(form, Tuple(...references))`. Form plus the complete ordered
environment is function identity: equal inputs reintern, while changing or
reordering references produces a different function value. No source parser,
closure inspection, or JavaScript-source canonicalizer is implied by this API.

An internal reference can be stored as a canonical `Lambda` form in the
environment. When its `OuterRef` is resolved—including in value, pattern, or
callee position—the form is lazily materialized with the owning function's
complete ordered environment. This is the same form-first/lazy-resolution
pattern used by Enum factories. It supports self recursion and different-form
mutual recursion when the forms share one complete reference layout; the
construction does not create cyclic JS objects or a separate function-group
value.

`expand(fn)` is symbolic invocation. It creates one owner-qualified
`CallArgument(index, fn)` for each declared call argument, then evaluates the
form by resolving outer references, substituting active call arguments,
invoking helper function values, and rebuilding registered Enums and canonical
Tuples through their normal factories. It does not accept concrete call
arguments and does not make `FunctionRef` a callable host function.

The active call stack is keyed by the exact canonical `FunctionRef`—not just
its `Lambda` form, and not `(function, arguments)`. Re-entering a function
already on that stack returns the residual call
`Apply(functionRef, Tuple(...evaluatedArguments))`. The frame remains active
through the complete body and is removed in `finally`, so every sibling
recursive call reached through supported Enum/Tuple traversal survives in the
formula and completed helpers leave no stale recursion marker. A body containing
two such calls therefore produces a tree containing both occurrences rather than
selecting one representative.

### Function Match reuses runtime matching

Canonical `Match` does not implement a second pattern engine. It instantiates
`MatchArgument(i)` as the corresponding generic, resolves `OuterRef` patterns,
and delegates the ordered arms to lowercase `match`. Arm order, contract
membership, structural matching, identity, construction failures, and
no-match errors consequently retain the semantics from §7.

The selected continuation reads its `MatchArgument` bindings. A nested Match
extends a copy of the prior binding vector rather than replacing it, including
sparse generic positions. A contract-only arm appends its forwarded matched
value. Pattern instantiation does not rewrite inside `Lambda` forms or closed
`FunctionRef` values; after that, lowercase `fits` may still match their Enum
structure normally.

If an evaluated Match scrutinee still contains a residual `Apply`, expansion
does not guess an arm. It rebuilds and preserves the complete Match, including
all patterns and continuations, with execution disabled. The residual Enum
tree is durable expanded form `E`. A later contextual preparation may combine or
erase an admitted pure call from canonical `C`, after deriving and retaining the
call's demands and admission obligations from `E`.

### Contextual formula preparation (ruled; first production slice landed)

Ordinary factories validate, construct, and structurally intern their Enum nodes;
they do not run algebraic canonicalization. Once writing, lowering, or expansion
has produced a complete pre-normal expression, that durable form is `E`. The
semantic pipeline is:

```text
retain complete expanded/pre-normal E
+ explicit semantic context
→ derive accepted region, result contract, obligations, and canonical C
→ retain E, C, and their preparation evidence
→ a later separate judgment may derive retained S
```

The production surface is the curried call `prepare(E)(incomingContract)`.
`incomingContract` is the direct canonical region contract: there is no `Context`
Enum and no one-element `Tuple` wrapper. The result is the ordinary canonical Enum
value, with this exact field order:

```text
Preparation(E, context, accepted, resultContract, obligations, C)
```

The `context` field is the same direct contract passed to `prepare`; `obligations`
is a canonical `Tuple`. The same `(E, context)` has one structural result, while
the same interned `E` may produce different `C` under different incoming regions.
Context is explicit, never ambient state or a contract variable. There is no
dedicated `(E, context)` lookup cache or facts-side association; ordinary Enum
interning still canonicalizes equal `Preparation` values. General correlated
multi-argument contexts are not supported, and their eventual representation
remains unpinned.

Accepted region, result contract, obligations, and canonical `C` are distinct
fields. Algebra may erase syntax from `C` only after its demands have been derived
from durable `E`. `E` is never overwritten; the landed `Preparation` value retains
both it and contextual `C`. A later judgment may derive `S`, which never merges
with or replaces `E` or `C`; its exact input, API, and association mechanism remain
unpinned, and no `S` integration is landed.

All structural forms remain ordinary values and Enums in one universe. Deriving
and retaining three stages does not introduce shadow formula ASTs. The interner
remains a shallow identity cache and performs no rewriting. `mapEnum` performs
phase-blind structural rebuilding; without an incoming context it cannot transform
`E` into `C`.

The existing matcher is the rule engine. `matchDomain` binds `match(E)` and an Enum
domain to a handler; production `prepare` uses that binder, then awaits the direct
incoming contract. It does not cache results or mutate `E`. Preparation decomposes
durable Enum structure and selects local canonicalization rules. This is not a
third `createEnums`/`Enum` callback. If contract-valued Enums require an explicit
structural-decomposition relation, it belongs to the preparation rule surface;
runtime/user bare contract patterns retain fulfilment semantics.

#### Landed preparation slice through `fce81ac`

Production currently recognizes only a `Mul` whose operands are literal zero and
`CallArgument(0, owner)`, in either order, where `owner` is a known unary `Lambda`
or `FunctionRef`. `argumentCountOf` exposes that known arity for this guard. The two
supported direct contexts produce:

```text
prepare(E)(Number)
→ Preparation(E, Number, Number, Equals(0), Tuple(), 0)

prepare(E)(Difference(Top, Number))
→ Preparation(E, Difference(Top, Number),
              Indeterminate, Indeterminate, Tuple(), E)
```

The Number row retains expanded `E` while contextual `C` collapses to zero. The
non-Number row retains the Indeterminate judgment and leaves `C` equal to `E` until
the broader consuming algebra is ruled. Unsupported expressions, dependencies,
arities, wrapped contexts, `_`, `Top`, and every other context throw; production
does not invent a default judgment.

The two rows are not yet composed into a result for incoming `Top`. That work is
blocked by the already-known temporary `Produces`/`Numeric` overmembership:
current `Numeric` membership is wider than exact Number-or-Indeterminate. It
includes its own wrapper nodes and, through `Produces`, symbolic Numeric nodes;
even its `Union(Number, Indeterminate)` result currently admits wrapper nodes
through the same result fallback. The landed rule is therefore neither general
region canonicalization nor full polynomial normalization.

#### Target Number polynomial normal form (not landed)

`Number` is the polynomial domain. There is no `DeterminateNumber`:
`Numeric = Union(Number, Indeterminate)`, and an Indeterminate is not a Number.

The target contextual preparation computes full polynomial normal form for an
admitted `Number` region: canonical children and positional references;
associative flattening and stable commutative ordering; literal and coefficient
folding;
distribution into a sum of monomials; coefficient collection, including
cancellation; identities and zero annihilation; `Pow` for repeated
factors/non-negative integer powers; and division by a known nonzero literal
coefficient when the result remains polynomial.

The output has coefficients first, structurally ordered factors and terms, a final
constant term, and left-associated binary products and sums. `Add(x, x)` becomes `Mul(2, x)`.
`Sub` remains: a polynomial accumulator may use signed coefficients; a leading
negative term uses its signed coefficient (for example `Mul(-1, x)`), while the
emitter uses `Sub` for later negative terms. Removing it would simplify only the
emitter's output grammar, not the semantic equality.

`Pow` and `Geo` have different roles. Pow is a value expression required by the
normal form. Geo is an important multiplicative-set contract to be specified with
its later domain consumer; it does not replace Pow. Variable division,
transcendental functions, and general exceptional algebra remain outside the first
polynomial implementation.

The language's `Number` semantics define this algebra. Host JavaScript `NaN`,
infinities, and signed zero do not expand the language theory; a host-value ingress
must reject or normalize foreign cases. An exact-rational package is an optional
implementation technique, not part of the specification.

`Indeterminate` has separately ruled consuming behavior. In particular,
`0 * Indeterminate(DivideByZero(...))` remains Indeterminate. The exact cause/Kind
and broader rules are deferred. A `Numeric` expression must therefore preserve its
Indeterminate region rather than blindly applying a Number-only annihilation law.
Where consuming behavior is deferred, no Number-only rule decides that region.

#### Retained demands and calls

The landed zero-multiplication slice emits the empty obligation `Tuple()` and does
not analyze calls. The broader target derives input, safety, purity, result, and
completion obligations from durable expanded `E` under the supplied context.
Algebra may erase syntax from `C` but not from `E`, and not from the prepared
meaning. Canonical `Match` regions can retain requirements only where they apply,
while the distinct accepted-region, result-contract, and obligation outputs remain
available to the judgment.

For Oddo/Next source:

```text
f = n => 0 * n

f = n => n :: {
  _ when Number => 0 * n
}

f = n => n :: {
  _ => 0 * n
}
```

The landed direct Number preparation has projection `0`. The target wildcard-body
judgment derives its own `Numeric` demand from `E`: its Number region maps to `0`,
while its Indeterminate region remains Indeterminate and its exact consuming
canonical form is deferred. Production cannot yet prepare the encompassing `Top`
context or emit that combined mapping. Therefore the target unguarded `0 * n` is
not represented by a Number-only arm.

This avoids an always-present accepted-contract parameter, a Top filler, and a
separate Demand node. Conditional requirements remain correlated with their arm,
without making the expanded evidence disposable.

In the broader target, an admitted Pure, safe, completing Number call may likewise
be combined or erased from `C` by the algebra. Its `Apply` in durable `E` supplies
the obligations. The concrete function later bound to an outer reference
determines whether those obligations discharge, not which polynomial body is
selected. Failure rejects the program; it never picks a noncanonical fallback or
triggers another normalization.
A known call may discharge during preparation and disappear from `C` immediately;
only unresolved evidence must survive to a later boundary.

The landed function identity remains:

```text
structurally interned Lambda form
+ complete ordered outer references
= FunctionRef identity
```

This contextual ruling does not change that current structural identity or add an
accepted-domain field to FunctionRef. The target integration point at which
prepared `C` becomes the canonical FunctionBody while durable `E` remains linked,
and whether the current identity account needs extension, remain unpinned and
require author judgment.

#### Canonical regions, Match, and logic

`Top`, `Bottom`, `Null`, `Union`, `Intersection`, and relative `Difference` are the
canonical region vocabulary described in §6. An ordered Match is converted into
effective, disjoint exact regions by threading its remainder:

```text
remaining₀ = incoming region
ownᵢ       = Intersection(patternRegionᵢ, guardRegionᵢ)
effectiveᵢ = Intersection(remainingᵢ, ownᵢ)

exact arm:     remainingᵢ₊₁ = Difference(remainingᵢ, ownᵢ)
non-exact arm: remainingᵢ₊₁ = remainingᵢ
```

`Rest` is only a conceptual name for `remaining`; it is not an Enum or pattern.
Every later arm excludes all earlier exact arms. Thus the Number arm in
`Equals(0) => a; Number => b` has effective region
`Difference(Number, Equals(0))`. A wildcard's own region is Top, so it receives
the current remainder. Selection of an exact arm commits its whole effective
region: that region is subtracted before the next arm even if preparing the body
derives a narrower accepted region. Body rejection does not become fallthrough.
Bottom rows disappear. Reordering and equal-result merging happen only after exact
disjointification; opaque/non-exact arms retain operational order.

For Pure exact logic, canonical meaning is the partial mapping from canonical
input regions to canonical result values. Emit it as ordinary Match/Arm trees.
De Morgan and DNF-style splitting are normalization techniques, not public logical
nodes or a separate BDD identity system.

Strict Match guards, ternary conditions, `!`, and the tested left seats of `&&` and
`||` demand Boolean. `~` is legal only at a conditional seat and loosens that seat;
it does not Booleanize. `!` produces Boolean. A grouped `~(...)` scopes through
nested conditional seats inside that group, including `~(consume(a && b))`, and
stops at a Lambda or explicit Match-arm boundary. `~consume(a && b)` does not
loosen the inner group. Loose falsity is exactly `{false, Null}`; zero is truthy.

Pure exact De Morgan/DNF-equivalent spellings collapse to the same region/result
rows while preserving their original demands. Effectful expressions and non-exact
ordered Matches are not reordered.

#### Pattern boundary

Preparation rules structurally match durable `E` and may bind operands that are
erased from `C`. Lowercase `match` itself always matches the value it is given: an
internal preparation rule given `E` sees expanded structure, while a runtime match
given `C` cannot recover source order or erased operands. Retaining `E` is not an
algebraic inverse-matching feature. The precise boundary at which source data and
source patterns are both prepared remains to be pinned with lowering. De-Bruijn
references are already stable structural atoms, so commutative ordering never
renames parameters.

The historical public `Term`/`Poly` probe is not prescribed. A private accumulator
may implement polynomial collection, but it publishes ordinary values/Enums. The
current Add/Mul factories still preserve written trees and fold nothing.

The landed `expand` currently produces durable pre-normalization structural `E`.
Its `mapEnum` reconstruction is phase-blind and cannot by itself transform `E`
into contextual `C`. An explicit caller supplies the semantic context to the
general preparation stage. Solving, domain judgment, and termination stay separate.

### Current boundary

This layer performs first-order structural unfolding, not concrete execution,
termination proof, or algebraic solving. Re-entry of the same function
residualizes immediately even when its arguments changed. Computed callees
such as Apply-of-Apply or a Match-produced function and per-form projections of
heterogeneous reference layouts are not implemented. Lazy mutually recursive forms
currently share one complete ordered reference ABI.

Recursive rebuilding traverses registered Enum arrays and exact canonical
Tuples. Pending-call detection scans Array values; both operations leave
Records, Maps/Sets, and arbitrary object graphs atomic. Function patterns have
ordinary ordered Arms only—no function-AST `Combine` or guards.
`CallArgument`, `Apply`, and `Match` are provisionally Numeric through
`Produces`; replacing that temporary seat-admission plumbing remains open. This
does not add an accepted-domain field to functions. Together with `Numeric`'s own
wrapper membership, it also prevents sound composition of the two landed
zero-multiplication rows under `Top`: current `Numeric` is wider than the exact
Number-or-Indeterminate value region.

Expansion is synchronous recursive descent and has no fixed-point engine. The
explicit production `prepare(E)(incomingContract)` stage and structural
`Preparation(E, context, accepted, resultContract, obligations, C)` value are
landed for the two zero-multiplication contexts described above. They retain `E`
and contextual `C` without a wrapper context, dedicated lookup cache, facts-side
association, FunctionBody integration, `S`, or multi-argument support. The host-function
guard rejects an ordinary function but
admits any function
carrying an own `Symbol.hasInstance` property. It checks presence only—not
callability, canonical provenance, or full contract validity—which is
consistent with this demonstrator's non-hardened boundary.

## 9. Implementation backlog and separate future work

- The `Produces` correction recorded in `decisions.md`. A class-chain
  replacement is proposed but not landed; its exact treatment of node-shaped
  results such as `Numeric(Numeric(1))` remains unresolved.
- Direct contextual preparation, the six-field `Preparation` Enum, and the two
  zero-multiplication judgments are landed. Remaining work includes composition
  under `Top`; the Number polynomial accumulator/emitter and `Pow`; every other
  expression/context rule; retained-obligation inference and discharge; caching or
  later association beyond ordinary Enum interning only if separately ruled; and
  FunctionBody integration.
- `Top`, `Bottom`, `Null`, strict binary `Union`/`Intersection`/`Difference`,
  `Optional` removal, and explicit-Null `LL` are landed as membership/structural
  forms. General region normalization beyond the manually invoked
  `Union(C, C) → C` rule remains open: flattening and ordering, Top/Bottom laws,
  containment and disjointness, effective Match remainders, Pure logical region
  normalization, host ingress for Number/Null, and conformance/property tests.
- Region extraction/exactness, guard lowering, conditional-seat Boolean validation,
  grouped `~` scoping, and obligation inference/discharge are all target work. The
  landed two-seat `Arm(pattern, result)` and ordinary symbolic Match do not yet
  provide them.
- Geo remains an important separate contract/domain feature. Its exact semantics
  and consumer should be investigated before implementation; it is not a
  substitute for Pow or polynomial syntax.
- Broader Indeterminate-consuming algebra and its exact cause/Kind vocabulary.
- The solve tier remains separate and may derive retained `S` without merging or
  replacing `E` or `C`; its exact input/API is unpinned. Landed
  `expand(FunctionRef)` is not this tier: it unfolds structure until exact
  function re-entry and currently retains the residual calls in its
  expanded `E`. That observation is not a rule that admitted pure calls must
  survive contextual `C`. `expand` does not infer a call domain, prepare `C`, or
  write solved-form facts.
- Source-to-`Lambda` lowering and richer function reference layouts. The
  current API starts with structurally interned lowered forms and one complete
  ordered reference environment; that does not imply they have already undergone
  contextual preparation.

## 10. Ruled out (do not reintroduce)

- A second custom-validator argument for output (V2): the result slot's
  function form *is* the membership definition. C2 and V2 were one idea in
  two slots.
- Membership functions closing over seat generics lexically: shared mutable
  state with a second reader — staleness and nested-check interference by
  construction. Parameters, which the language makes fresh per call, do the
  job with nothing to guard.
- A `Produces` thunk reading the per-call registers (answering with whatever
  the last call bound): the same second-reader disease one level down —
  demonstrated poisonable, one unrelated `Twin(Numeric, Numeric)` flipped
  an unrelated `Add(t, 2)` from rejected to constructed. A stored generic
  answers **for the node it is asked about**, never from ambient state.
- Flattening a generic result at the write (storing its resolved value or
  its seat index instead of the generic itself): the store keeps the
  deferred thing; resolution happens at read, with the node in hand.
- Per-construction build runs (deleting the `once`): unnecessary once
  checks take parameters; the declaration is pure and cached.
- A multi-entry result slot ("produces A or B" as a bare list): unions are
  written explicitly, `Union(A, B)`.
- N-ary unions (`Union(A, B, C)`): binary only; nesting composes any union,
  and the flat form multiplies spellings of one set.
- Reimplementing the kinds — `Tuple`, `Record` — or the Indeterminate
  classes as enums. The kinds and the enum factories are peer doors on the
  interner, not layers; something becomes an enum only when it already has
  the enum shape (a tag that is its identity, fixed contract-checked
  seats) with zero new machinery. The Indeterminate classes already do
  their contract job natively; deleting them solved no contract problem.
- Building the three verdicts into the demonstrator's `sub`: inside the
  calculable algebra boolean is complete; the boundary case (opaque
  predicates) is handled by keeping them outside the algebra, not by
  adding verdicts.
- Membership smuggled into the result position as a side-channel, or
  carried via `contractCheck` wrappers around validators.
- Keeping `Optional` as a second nullish contract constructor. The canonical
  language has one Null and writes the former meaning as `Union(Null, T)`.
  This is independent of the smaller class-chain replacement proposed for
  `Produces`, which remains in §9.
- Per-node storage of class-level facts; per-node membership closures
  (derivable data is not stored — a node's elements are its storage).
- `instanceof` behavior on opaque value nodes (silent false) — misuse stays
  a loud error.
- Context-variable channels for declaration facts (`resolving`) — the constructor
  binds lexically. This rejected ambient channel is unrelated to the explicit
  immutable input supplied to pure contextual preparation.
- Canonicity side-stores (the WeakSet brand) and any interner that
  constructs (`.map`/`Array.from` copies): the bug class is unrepresentable
  in the pure-cache interner.
- Parallel recognizers generally: one mechanism per fact, single writer,
  keyed by canonical identity.
