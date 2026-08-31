# oddo.next — design

Agreed 2026-08-19, before the enum/contract implementation (revised the same
day: the result slot merges C2 and V2), and updated through the author rulings of
2026-08-31. Sections 1–6 preserve the core
enum/contract implementation; sections
7–8 describe matching, canonical functions, and the ruled canonicalization layer.
The former production contextual-preparation prototype has been removed. This file
and `decisions.md` remain the authority for the surfaces they describe. A
subsection explicitly says when it documents current code rather than the ruled
target.

Current verification: **195 passing, 0 failing**.

## 1. The interner (landed)

The interner never creates a value it returns. It only decides which
already-created reference is canonical: a hit returns the cached reference
(the given duplicate becomes garbage), and a miss remembers the given value.
Values enter one level at a time — children must already be
interned (or primitive) before their container is constructed — so no walk
recurses, nothing is copied, and no caller's object is ever rewritten.

- One trie, one walk: every path is prefixed by its door-specific tag
  (`Record`, `Tuple`, a hidden Enum class, or an Indeterminate-form class), so
  namespaces are structurally disjoint.
- Construction lives only in the front doors: `Record` (keyed by sorted
  entries), `Tuple` (keyed by elements), the Enum factories, and canonical
  Indeterminate-form constructors such as `ZeroDivision`/`ZeroMod`. Expansion
  results are not memoized by a separate call cache. Canonical function and
  call syntax such as `FunctionRef` and `Apply` are still ordinary Enum
  constructions, so equal nodes deduplicate normally.
- `Tuple` and `Record` are nominal peer doors, not Enums. Their values answer
  `isInstance(value, Tuple)` and `isInstance(value, Record)` while retaining Array
  and Object behavior respectively. A one-element Tuple remains one element even
  when that element is a Number. Record copies sorted own enumerable entries;
  an own `__proto__` entry remains an ordinary data property.

Consequence: structurally equal means pointer-equal, so `===` is value
equality, deep equality is one pointer comparison, and canonical references
are perfect keys.

Under Oddo's language semantics, canonical references remain stable through the
mutation boundary rather than host-JavaScript freezing. Ordinary language code
cannot mutate values. Mutation is confined to mutator functions, which proxy
objects and copy on edit/set, so an edit never rewrites a published canonical
value. The pre-NEXT Oddo implementation already uses this model. This repository
does not implement those mutators or prevent direct host writes; its controlled
pipeline assumes the boundary and does not duplicate it with `Object.freeze`.
Direct host writes and direct use of inherited Array construction methods on
Tuple values are outside the language model.

The cache stores leaves through `WeakRef`. Canonical identity is therefore a
live, process-local property: equal values held at the same time share a
reference, but the interner is not a permanent identifier or serialization
scheme. A value may be reconstructed after every prior live reference has
been collected.

Two boundary facts, stated so they are read as chosen: the JS surface is a
demonstrator, not a hardened API, and legitimate language values exist through
the controlled front doors rather than host literals. And `+0`/`-0` collapse to
one key (JS Map semantics) — deliberate, not accidental: the intended number
model has no signed zero.

## 2. Facts (landed)

System-side metadata lives in one store (`fact(subject, key)` /
`learn(subject, key, value)`, first-write-wins), keyed by the relevant reference:
Enum validators and hidden classes today, nodes and contract pairs later.
Facts are not attached as properties of values or classes and never participate
in identity. The `Canonical` property described in §3 is semantic form retained
by Enum construction, not an entry from the facts store.

Current entries are:

- `enum validator → Resolve` — the declaration's once-cached resolver;
- `constructor → Produces` — the declared result, recorded at first
  resolution: a contract, or the declaration's own generic, stored as itself
  and answering per node (§5);
- `constructor → Transparent` — the identical one-seat/result contract for a
  transparent Enum;
- `canonical Function → Callable` — the first callable retained for that
  canonical identity;
- `canonical Function → Produces` — the callable's widest result bound derived
  from its complete pre-canonical body `E`. This fact is not a Function identity
  field.

`Resolve`, `Produces`, and `Transparent` are shared module-exported Symbols. Fact
identity never depends on repeating a string spelling.

`Produces` is the retained upper result bound. Nonrecursive Function formation
derives its return bound from complete expanded `E`, before selecting `C`. A
formed Apply constructor has a generic `Produces` carrier which reads that fact
from its target Function; `producedOf` itself remains unchanged. Thus
`Add(1, 1)` contributes the declared `Numeric` bound even though its `C` is
`Equals(2)`. A literal result contributes its exact `Equals(value)` contract, and
a Function-valued result contributes `Function` without invoking that returned
Function.

The remaining blanket bounds are temporary: `Match` and unresolved/legacy Apply
retain `Numeric` so their symbolic nodes can occupy existing Numeric seats. Those
fallbacks are formation scaffolding, not a per-function signature.
`CallArgument` instead produces its own symbolic kind; its demand follows from
its consumer.
Concrete application may select a `Match` body; symbolic formation retains the
complete Match. Residual calls and effective Match regions require later
obligations. This correction does not remove `Produces` from ordinary
result-bearing forms.

There is no production `Preparation` Enum or `prepare` API. The removed prototype
was never integrated with Function formation. The separate
`test/contextual-prepare.model.mjs` remains specification pressure for future
explicit-context judgments, not a production cache or value surface.

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
  - **a contract** — `(Numeric)` — the widest possible result contract,
    recorded once as the `Produces` fact. Never "run"; consumed later by
    *other* seats when the node sits in them (`Add(Add(1,2), 3)` works because
    the inner node's recorded fact satisfies the outer seat). Facts and later
    contextual judgments may derive a narrower result within this bound.
  - **a function** — `((T1, T2) => value => ...)` — the membership
    definition: how a value is checked against nodes of this enum. Called
    by the machinery **with the node's elements as arguments**, it returns
    the value-check. Records nothing as a fact.
  - **empty** — `()` — no meaningful declared result. Canonical function
    syntax uses this for structural nodes such as `Arm`, `Lambda`, and
    `FunctionRef`; the current machinery receives `null`, which provides
    no usable `Produces` fact. A `FunctionRef` is nevertheless the canonical
    function value by nominal Enum identity; the empty result slot merely avoids
    inventing a theorem about the result of applying that function.
  A multi-entry result cannot exist. "Produces A or B" is written explicitly:
  `(Union(A, B))`.
- **Input validation** (Enum's optional second argument) — an available way for
  an Enum to define an intrinsic relation across its arguments. It is not a
  defensive layer for facts guaranteed by the producer. The demonstrator's
  lowering, expansion, and canonicalization machinery controls its internal
  forms, so source diagnostics and producer promises belong in that producer, a
  linter, or the semantic judgment that consumes them. None of the current
  internal Domain or function-form declarations uses this optional
  hook.

For a nonempty result, telling the two forms apart needs no marker: a bare
arrow—no `.prototype`, no `Symbol.hasInstance` of its own—can only be a check.
Everything else is treated as the contract-form result; intended examples are
an Enum factory, a `contractCheck` contract, a class, or a membership-defined
contract node. `null` is the explicit empty case described above.

**Parameters, not shared variables.** The membership function receives the
branches as ordinary parameters. JS function parameters are fresh per call
— the language itself provides each check with its own variables, so
checks cannot interfere with each other, nested checks of the same enum
included:

```js
const inner = Union(Number, Indeterminate)
const outer = Union(inner, String)

fulfills(5, outer)
// call check(inner, String)   → its own T1, T2 → fulfills(5, inner) …
//    call check(Number, Indeterminate) → its OWN T1, T2 → true
// … back outside: T2 still holds String. Nothing shared, nothing to restore.
```

A membership function that instead closed over the seat generics lexically
would read shared mutable state and is ruled out (§10).

Each lazy Enum factory also registers its hidden constructor with the public
factory. `mapEnum(value, map)` uses that registry to map one level of a known
Enum value and rebuild it through its original factory. Rebuilding therefore
reruns declared-seat checking, generic binding, and interning while reusing
the once-resolved declaration and facts. It does not bypass the front door. It
returns `null` for values that are not registered Enums. Recursive
traversal is the caller's job—canonical-function expansion handles Tuples
separately and otherwise leaves non-Enum values atomic.

Each factory exposes its hidden constructor as `.kind`. The base `Enum` relation
likewise exposes `Enum.kind === Enum`, so `$(Enum)` follows the matcher's nominal
kind path instead of semantic fulfilment. Ambient canonical child reading can
therefore never turn a structural “any Enum” test into a test of that Enum's
canonical result.

### Expanded candidate and canonical form (initial context-free slice landed)

An Enum factory always returns its validated, structurally interned candidate
`E`. After construction it also writes the candidate's context-free canonical
form `C` under the shared `Canonical` Symbol:

```js
candidate[Canonical] =
  constructor[Canonical]?.(candidate) ?? candidate
```

`registerCanonical(EnumType, rule)` installs the rule on
`EnumType.kind[Canonical]`. The rule receives a matcher already bound to the
candidate; it does not receive the candidate separately. During that canonical
match, `Combine` reads each immediate operand through
`operand?.[Canonical] ?? operand`, so an outer rule sees the canonical result of
an already-constructed child without a recursive normalization pass. An
unmatched rule returns the original candidate, which consequently stores itself
as `C`.

The first registered `Add` rules fold two direct `Number.kind` values to an
`Equals` value, shift a `Range` by a Number, and add two Ranges endpoint-wise.
`Number` remains the semantic fulfilment contract used by Enum validation;
`Number.kind` is direct known-number matching and therefore does not admit a
symbolic `CallArgument` merely because that argument is allowed through contract
seats.

These factory rules are intentionally context-free. An explicit incoming region
may eventually permit additional rules—for example, a `Number` restriction can
permit symbolic zero annihilation—but no production API currently supplies that
context. Function formation derives demands from complete `E` before recursively
rebuilding the body and selecting stored `Canonical` forms for identity.

That same registry defines the nominal relation `isInstance(value, Enum)`.
Registered Enum values satisfy it; Tuple and Record values do not. Runtime
structural matching uses this relation rather than treating every Array subclass
as an Enum.

`mapEnum` reconstruction checks declared seats and structurally interns the
rebuilt Enum through that same front door, so the rebuilt candidate receives its
context-free `Canonical` property normally. `mapEnum` supplies no incoming
semantic context. `expand` produces structural `E`; it does not own another
normalizer.

## 4. Membership

`fulfills(v, K)` means "v can stand where K is demanded" and is implemented
by the single semantic wrapper:

```js
const fulfills = (value, Contract) =>
  (!Contract?.generic &&
    Kinds.CallArgument &&
    value?.constructor === Kinds.CallArgument) ||
  isInstance(value?.valueOf(), Contract)
```

`isInstance(value, Constructor)` is the sole wrapper around JavaScript's direct
instance relation. `fulfills` lets a transient contract forward its represented
value before asking that relation, and owns universal symbolic `CallArgument`
admission for non-generic contract seats:

1. **Ground contracts** (a `contractCheck` predicate like `Number`, or a
   plain class like `Indeterminate`) answer directly. Every chain ends here.
2. **Enum factory** `F`: true if `v` is an `F`-node; or `v`'s recorded
   `Produces` fact satisfies `F` (stands-at, via `sub`); or `F` is
   *transparent* — then `fulfills(v, C2)`.
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
would make `isInstance(3, Add)` true.

`sub` is reference identity today. Consequently, no containment is currently
derived between distinct `Equals`, `Range`, `Union`, kind, or transparent-box
contracts. Rows such as `sub(Equals(1), Range(0, 100)) → true` and
`sub(Range(0, 10), Range(5, 100)) → false` describe the parked calculable
algebra (§9), not current behavior. That future algebra is restricted to
contracts that expose their structure; opaque `contractCheck` predicates keep
identity-only treatment.

Transient forwarding already makes
`fulfills(Equals(1), Range(0, 100))` true; it does not install or cache the
separate general `sub` verdict.

A factory's membership resolves the declaration on demand — first need,
not first construction: `Add(1, 1)` asks `Numeric` before `Numeric` ever
ran, so the check itself triggers the (once-cached) resolve.

Termination is structural, not assumed: membership descends through finite,
acyclic contract nodes to ground checks; finite declarations, finite
descent.

`Equals(E).valueOf()` returns `E`, so exact transient contracts fulfil every
contract their nested value fulfils. `Indeterminate.valueOf()` returns the
complete Indeterminate instance, preventing its internal Number-box operand from
crossing the Number boundary. Generic pattern capture and nominal Tuple, Record,
Enum, and exact-kind recognition do not use semantic forwarding.

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

This listing summarizes the current demonstrator. The region constructors provide
canonical structural identity,
membership, and a local root-reduction kernel. The broader normalization laws
immediately below remain a target.

```js
export const isRegion = value => isContract(value) && value !== _

const Domain = createEnums(() => class {

  Top = Enum($ => $()(() => value => value != null))
  Bottom = Enum($ => $()(() => () => false))
  Null = Enum($ => $()(() => value => value === Null))

  Union = Enum(($, [T1, T2]) =>
    $(T1, T2)((T1, T2) => value =>
      fulfills(value, T1) || fulfills(value, T2)))

  Intersection = Enum(($, [T1, T2]) =>
    $(T1, T2)((T1, T2) => value =>
      fulfills(value, T1) && fulfills(value, T2)))

  Difference = Enum(($, [base, excluded]) =>
    $(base, excluded)((base, excluded) => value =>
      fulfills(value, base) && !fulfills(value, excluded)))

  Numeric = Enum($ => $(Union(Number, Indeterminate))(Union(Number, Indeterminate)))

  Add = Enum($ => $(Numeric, Numeric)(Numeric))
  Sub = Enum($ => $(Numeric, Numeric)(Numeric))
  Mul = Enum($ => $(Numeric, Numeric)(Numeric))
  Div = Enum($ => $(Numeric, Numeric)(Numeric))

  Equals = Enum(($, [E]) => $(E)(E => value => value === E))

  Range = Enum($ => $(Number, Number)((lo, hi) => value =>
    fulfills(value, Number) && lo <= value && value <= hi))

  LL = Enum($ => $(Numeric, Union(Null, LL))(LL))
})

export const Top = Domain.Top()
export const Bottom = Domain.Bottom()
export const Null = Domain.Null()

export const {
  Add, Sub, Mul, Div, LL, Numeric,
  Union, Intersection, Difference, Equals, Range
} = Domain

Object.defineProperty(Equals.kind.prototype, 'valueOf', {
  value() { return this[0] }
})
```

- `Top`, `Bottom`, and `Null` — canonical zero-seat membership-defined Enum
  values/contracts. `Top` admits every language value, `Bottom` admits none, and
  `Null` admits only itself. Raw host-nullish values are not `Null`; host
  ingress normalization is not yet implemented. Like every current contract,
  these atoms also participate in ordinary `Produces` stands-at admission: a
  hypothetical node whose widest declared result is an atom stands at that atom.
  No current domain constructor produces `Bottom` or `Null`.
  Here Bottom admits no realized value; a form declared to produce Bottom is a
  result-bound statement about that form, not a realized member of Bottom.
- `Union`, `Intersection`, and `Difference` — binary membership-defined Enums in
  the canonical region vocabulary; `Difference` is ordered. Their operands are
  contract regions and `_` remains wildcard syntax rather than a persistent
  region value. Those are lowering/canonicalization rules, not defensive checks at
  the reusable Enum door.
- `Numeric` — the transparency rule at work: contract-form result identical
  to its one seat; membership reaches `typeof` through declared structure
  only, nothing repeated anywhere.
- `Indeterminate` — a structured exceptional numeric outcome. It is a branch of
  `Numeric`, not a `Number`. The ruled specimen does not turn schematic
  `Indeterminate(DivideByZero(...))` into Number zero under multiplication by
  zero; it remains in `Indeterminate`. Its `valueOf()` retains the complete
  Indeterminate instance rather than exposing the internal Number-box operand.
  The current code defines peer
  `ZeroDivision` and `ZeroMod` forms; the exact future
  cause/Kind and broader consuming algebra are deferred.
- `Add`/`Sub`/`Mul`/`Div` — opaque; stand at `Numeric` seats through the
  recorded fact.
- `Equals` — the singleton: `value === E`, exact because of interning; an
  exact-value contract for matching and later judgments. It is transient for
  semantic admission: `Equals(E).valueOf()` forwards `E` through `fulfills`.
- `Range` — a membership-defined two-seat Enum whose nodes are contracts. Seat
  contracts check each endpoint and membership checks the closed interval. A
  reversed interval remains an expressible empty form and may later canonicalize
  to `Bottom`; the constructor does not lint endpoint order. A transient exact
  contract can occupy an endpoint seat through its value, so
  `Range(Equals(1), Equals(2))` is valid and retains those written contract
  operands.
- `LL` — a two-seat recursive value with an explicit `Null` terminator. `LL(1)`
  and raw host-nullish tails reject; the empty/terminal tail is written `Null`.

### Canonical contract normalization target (vocabulary and root laws landed)

- `Top` is the contract fulfilled by every language value; `Bottom` is fulfilled
  by none. They are the algebraic concepts sometimes called Any and Never. `_`
  is extensionally the all-values match region while remaining captureless
  wildcard syntax; future unconstrained contract seats use `Top`, not `_`.
- There is one language `Null` value and contract. Explicit host-nullish values
  normalize to that value only at a host-value ingress. Missing arguments,
  absent fields, and JavaScript control-flow absence do not.
- `Optional` is removed in current code. Its former denotation is written
  `Union(Null, T)`.
- `Union`, `Intersection`, and relative `Difference` form canonical regions.
  Union and Intersection flatten, order, deduplicate, and emit one left-associated
  binary shape. They apply the Top/Bottom, proved-containment, and
  proved-disjointness laws recorded in `decisions.md`. Unknown relations stay as
  residual canonical structure.

The manually invoked `canonicalizeDomain` kernel now implements these immediate
root laws:

```text
Union(A, A) → A                 Intersection(A, A) → A
Union(Bottom, A) → A            Intersection(Top, A) → A
Union(Top, A) → Top             Intersection(Bottom, A) → Bottom

Difference(A, A) → Bottom
Difference(A, Bottom) → A
Difference(Bottom, A) → Bottom
Difference(A, Top) → Bottom
```

The Union and Intersection rules accept either operand order. Equality is
canonical pointer equality. Handlers inspect only the immediate operands, preserve
unknown candidates exactly, and never call `canonicalizeDomain` recursively.
There is still no general normalization caller, bottom-up traversal,
flattening/order/left-association pass, containment/disjointness solver, effective
Match remainder, or logical canonicalization.

### Traces

`Add(1, 1)`:
seat asks `fulfills(1, Numeric)` → transparent →
`fulfills(1, Union(Number, Indeterminate))` → apply Union's check to that
node's elements → `fulfills(1, Number)` → typeof → true. Every step is either a declared
check applied to a node's own elements, or ground.

`Add(1, Mul(2, 3))`:
the `Mul` node fails Numeric's chain (not a number, not an Indeterminate)
→ but its recorded fact is `Numeric` → stands-at → true. Values enter
through membership, nodes enter through their recorded facts.

## 7. Runtime matching (landed)

`match(value)(...caseDeclarations)` is an ordered eliminator. Each case
declaration receives the ordinary `caseOf` constructor (`$`) and a fresh
iterator of generics. Cases are tried in source order; the first successful
case returns its handler result. If no case matches, `match` returns its
original value unchanged.

`fits(pattern, value)` has one small decision chain:

1. `_` matches anything and captures nothing.
2. A direct kind pattern such as `Number.kind` uses `isInstance` and does not
   inherit symbolic contract admission.
3. A contract pattern uses `fulfills(value, pattern)`. A generic capture uses
   `isInstance(value, pattern)` instead, because capture is structural and must
   retain the original value rather than forward it.
4. A structural Enum pattern and value must both satisfy the registered nominal
   `isInstance(value, Enum)` relation, then have the same hidden kind and arity; their
   corresponding seats are fitted recursively.
5. Everything else matches by canonical identity (`===`).

Pattern construction and pattern mismatch are not the same event. A case
declaration must first produce a valid pattern. If its declaration or Enum
construction throws, the error propagates and aborts the match. Only a valid,
successfully constructed pattern for which `fits` returns false falls through
to the next case. There is no catch-and-skip arm behavior.

Structural Enums may contain contracts in ordinary non-generic seats, so a
partial tree such as `Add(Number, 2)` is both a legal structural value and a
pattern. Declared value seats still validate normally through `fulfills`:
`Range(1, 2)` and `Range(Equals(1), Equals(2))` are both valid because the exact
contracts forward `1` and `2`. Generic seats retain and capture their original
values. `Union`, `Intersection`, and `Difference` remain a binary canonical
vocabulary over contract regions, and `_` remains invalid as a persistent branch.
Lowering/canonicalization owns those source rules; their reusable Enum factories
do not duplicate them as construction-time lint.

An ordinary successful case calls its handler with generic bindings in generic
declaration order, not pattern traversal order. Non-generic pattern parts do
not add handler arguments. As one useful exception, a successful top-level
contract pattern with no generics passes the matched value itself. `_` still
passes nothing.

### Combine

`Combine(...patterns)(handler)` is a separate case combinator for unordered
occurrence assignment. A non-Tuple iterable candidate, including an Enum, is
converted locally with `Tuple(...candidate)`; there is no parallel
Tuple-recognition contract. Occurrence cardinality must equal pattern cardinality.
It searches for a
one-to-one assignment from pattern positions to tuple occurrence indexes:

- duplicate values remain separate occurrences;
- patterns are considered in declaration order;
- candidate indexes are tried in source order;
- failed speculative generic bindings are restored before another assignment;
- backtracking handles overlapping contracts rather than committing greedily.

On success the handler receives every assigned occurrence in pattern order,
including positions whose patterns are contracts or wildcards. This is
deliberately different from an ordinary arm, whose handler receives only its
generic bindings. Ordinary matching retains the occurrences as supplied. A
matcher bound by `registerCanonical` instead reads each occurrence's stored
`Canonical` form before fitting and passes that form to the handler. `Combine`
is available in lowercase `match`; the canonical
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
`i` in its ordered reference environment. The lowering producer supplies the
form's complete ordered references; `internFn` does not duplicate that source
check and returns a canonical `FunctionRef(form, Tuple(...references))`.
Form plus the complete ordered environment is function identity: equal inputs
reintern, while changing or reordering references produces a different function
value. No source parser, closure inspection, or JavaScript-source canonicalizer is
implied by this API.

The same boundary applies to the lowered syntax Enums: their factories state
seats and preserve structure but do not lint whole indexes/counts, reference
bounds, owner kinds, arm collections, host functions, or call arity. Those are
producer/source rules. Expansion retains only operational rejection needed by
the semantics it currently implements.

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
arguments, select `Match` arms, or make `FunctionRef` a callable host function.

`apply(fn, ...arguments)` is the separate concrete operation. It uses the same
reference resolution, call stack, and Enum/Tuple rebuilding, but concrete Match
selection is enabled.

The active call stack is keyed by the exact canonical `FunctionRef`—not just
its `Lambda` form, and not `(function, arguments)`. Re-entering a function
already on that stack returns the residual call
`Apply(functionRef, Tuple(...evaluatedArguments))`. The frame remains active
through the complete body and is removed in `finally`, so every sibling
recursive call reached through supported Enum/Tuple traversal survives in the
formula and completed helpers leave no stale recursion marker. A body containing
two such calls therefore produces a tree containing both occurrences rather than
selecting one representative.

### Function Match separates formation from concrete application

Symbolic `expand` never selects a `Match` arm. It rebuilds and preserves the
complete Match, resolving outer references and symbolic call arguments throughout
its scrutinee, patterns, and continuations. This complete Enum tree is durable
expanded form `E`.

Concrete `apply` does not implement a second pattern engine. It instantiates
`MatchArgument(i)` as the corresponding generic, resolves `OuterRef` patterns,
and delegates the ordered arms to lowercase `match`. Arm order, contract
fulfilment, structural matching, identity, construction failures, and unmatched
value passthrough consequently retain the semantics from §7.

The selected continuation reads its `MatchArgument` bindings. A nested Match
extends a copy of the prior binding vector rather than replacing it, including
sparse generic positions. A contract-only arm appends its forwarded matched
value. Pattern instantiation does not rewrite inside `Lambda` forms or closed
`FunctionRef` values; after that, lowercase `fits` may still match their Enum
structure normally.

If a concrete Match scrutinee still contains a residual `Apply`, application does
not guess an arm and preserves the complete continuation. A later contextual
preparation may combine or erase an admitted pure call from canonical `C`, after
deriving and retaining the call's demands and admission obligations from `E`.

### Explicit-context canonicalization (ruled target; prototype removed)

Enum factories retain expanded candidate `E` and write context-free `C`. Function
formation derives its ordered input-demand Tuple from complete `E` before it
recursively rebuilds the body and selects those stored canonical forms. No
production `prepare(E)(incomingContract)` function or `Preparation` Enum exists.

The removed prototype represented one contextual judgment as:

```text
Preparation(E, context, accepted, resultContract, obligations, C)
```

and implemented only these two zero-multiplication rows:

```text
(E, Number)                  → accepted Number, C = 0
(E, Difference(Top, Number)) → accepted Indeterminate, C = E
```

That prototype had no caller in Function formation and has been removed rather
than carried into the `Apply` work. The separate
`test/contextual-prepare.model.mjs` retains broader examples as test-only design
pressure. It is not a production API, cache, or second formula representation.

The semantic distinction remains: an explicit incoming `Number` restriction may
permit `Mul(0, x) → 0` while retaining the demand, whereas an unguarded `Numeric`
argument also admits `Indeterminate` and cannot be erased by the Number-only rule.
Integrating that context at the correct body-canonicalization boundary is future
work. There is currently no production implementation of the explicit-context
case.

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

Current nonrecursive Function formation derives ordered input demands from `E`
before selecting canonical body `C`. The broader target also derives safety,
purity, result, and completion obligations before algebra erases their originating
syntax. Canonical `Match` regions can retain conditional requirements where they
apply. No general obligation representation or explicit-context body judgment is
landed.

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

The retained test model gives the explicit Number body projection `0`. The target
wildcard-body judgment derives its own `Numeric` demand from `E`: its Number region
maps to `0`, while its Indeterminate region remains Indeterminate and its exact
consuming canonical form is deferred. Production cannot yet emit that combined
mapping. Therefore the target unguarded `0 * n` is not represented by a
Number-only arm.

This avoids an always-present accepted-contract parameter, a Top filler, and a
separate Demand node. Conditional requirements remain correlated with their arm,
without making the expanded evidence disposable.

For a formed Function with no `CallArgument` anywhere in its argument tree, Apply
now invokes the retained callable during Enum canonicalization. The Apply node
remains expanded `E`; the invoked body's recursively selected canonical form is
stored at `E[Canonical]`. A symbolic formed call remains its own `C`. A residual
Apply supplies obligations that later recursion and termination machinery must
discharge. Failure rejects the program; it never picks a noncanonical fallback or
triggers another normalization.

The current nonrecursive Function identity is canonical body `C`, its complete
ordered outer-reference Tuple, and the ordered input-demand contract Tuple. The
result contract is derived and is not another identity component. The legacy
Lambda/FunctionRef evaluator remains separate recursion evidence.

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

Future explicit-context rules may structurally match complete `E` and bind operands
that disappear from `C`. Lowercase `match` always sees only the value it is given;
a runtime match against `C` cannot recover source order or erased operands. The
precise source data/pattern boundary remains to be pinned with lowering. De-Bruijn
references are stable structural atoms, so commutative ordering never renames
parameters.

The historical public `Term`/`Poly` probe is not prescribed. A private accumulator
may implement polynomial collection, but it publishes ordinary values/Enums. The
current `Add` rules fold known Number/Range cases; the current Pure `Mul` rule folds
known Number zero products, orders a residual zero first, and preserves unresolved
or Indeterminate products.

The landed `expand` currently produces pre-normalization structural `E`.
`mapEnum` reconstruction is phase-blind; there is no production explicit-context
stage. Solving, domain judgment, and termination stay separate.

### Current boundary

This layer performs first-order structural unfolding, not concrete execution,
termination proof, or algebraic solving. Re-entry of the same function
residualizes immediately even when its arguments changed. Computed callees
such as Apply-of-Apply or a Match-produced function and per-form projections of
heterogeneous reference layouts are not implemented. Lazy mutually recursive forms
currently share one complete ordered reference ABI.

Recursive rebuilding traverses registered Enum values and nominal canonical
Tuples through their respective doors. Pending-call detection scans Array values;
both operations leave
Records, Maps/Sets, and arbitrary object graphs atomic. Function patterns have
ordinary ordered Arms only—no function-AST `Combine` or guards.
`Match` and unresolved/legacy Apply retain provisional Numeric fallbacks.
`CallArgument` produces its own symbolic kind and receives demands from its
consumers. Formed Apply reads the result bound derived from its target
Function's pre-canonical `E`; concrete formed calls also retain their invoked
canonical result while symbolic calls remain residual. Replacing the remaining
fallbacks requires consumer-derived argument demands, effective Match handling,
and residual-call obligations. This does not add an accepted-domain or result
field to functions.

Expansion is synchronous recursive descent and has no fixed-point engine. No
production explicit-context preparation stage is present. Internal form
constructors deliberately do not harden this controlled demonstrator against
malformed lowering output; a future parser/linter owns those diagnostics.

## 9. Implementation backlog and separate future work

- Replace the temporary `Numeric` declarations on `Match` and unresolved/legacy
  Apply without introducing a FunctionRef return theorem; retain effective Match
  results and represent obligations for residual calls. Complete generic
  correlations for symbolic `CallArgument` results remain separate. Prototype
  inheritance remains only an optional implementation refactor for static
  factory-shaped bounds; it is not separate language work.
- Implement explicit incoming-region canonicalization at the function/body
  boundary without restoring the removed `Preparation` prototype. The retained
  test model covers the Number/Indeterminate distinction but is not integrated.
  Remaining work includes the Number polynomial accumulator/emitter and `Pow`;
  every other expression/context rule; and retained-obligation inference and
  discharge.
- `Top`, `Bottom`, `Null`, strict binary `Union`/`Intersection`/`Difference`,
  `Optional` removal, and explicit-Null `LL` are landed as membership/structural
  forms. The manually invoked root kernel now lands deduplication and the direct
  Top/Bottom identity and absorption laws. Bottom-up traversal, flattening,
  heterogeneous ordering, left-association, containment and disjointness,
  effective Match remainders, Pure logical region normalization, host ingress for
  Number/Null, and broader conformance/property tests remain open.
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
  ordered reference environment; that does not imply an explicit-context judgment
  has already run.

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
  This is independent of the `Produces` result-bound relation.
- Per-node storage of class-level facts; per-node membership closures
  (derivable data is not stored — a node's elements are its storage).
- `isInstance` behavior on opaque value nodes (silent false) — misuse stays
  a loud error.
- Context-variable channels for declaration facts (`resolving`) — the constructor
  binds lexically. This rejected ambient channel is unrelated to the explicit
  immutable input supplied to pure contextual preparation.
- Canonicity side-stores (the WeakSet brand) and any interner that
  constructs (`.map`/`Array.from` copies): the bug class is unrepresentable
  in the pure-cache interner.
- Parallel recognizers generally: one mechanism per fact, single writer,
  keyed by canonical identity.
