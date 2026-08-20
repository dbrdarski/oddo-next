# oddo.next — design

Agreed 2026-08-19, before implementation (revised same day: the result slot
merges C2 and V2). This file is the authority for the enum/contract surface;
the implementation follows it, and where code and this document disagree,
the code is wrong. Earlier layers (interner, facts store) are documented
here as they stand in the code.

## 1. The interner (landed)

The interner never creates a value it returns. It only decides which
already-created reference is canonical: a hit returns the cached reference
(the given duplicate becomes garbage), a miss freezes the given value and
remembers it. Values enter one level at a time — children must already be
interned (or primitive) before their container is constructed — so no walk
recurses, nothing is copied, and no caller's object is ever rewritten.

- One trie, one walk: every path is tag-prefixed (`Record`, `Tuple`, or the
  hidden enum class), so namespaces are structurally disjoint.
- An unfrozen object child is a raw literal that skipped its constructor:
  rejected with a TypeError at the door.
- Construction lives only in the front doors: `Record` (keyed by sorted
  entries), `Tuple` (keyed by elements), and the enum factories. Calls are
  never memoized; only construction dedups.

Consequence: structurally equal means pointer-equal, so `===` is value
equality, deep equality is one pointer comparison, and canonical references
are perfect keys.

## 2. Facts (landed)

Everything the system derives about canonical references lives in one
system-side store (`fact(key, name)` / `learn(key, name, value)`,
first-write-wins), keyed by the reference itself: hidden classes today,
nodes and contract pairs later. Nothing is ever stored on a value or a
class — a value is pure structure, indistinguishable fresh or analyzed, and
facts never participate in identity.

Current entries: `constructor → 'produces'` — the declared result, recorded
at first resolve: a contract, or the declaration's own generic, stored as
itself and answering per node (§5). Planned: solved forms (`Add(1,2)` links
to `Equals(3)`, never merges), sub verdicts on pairs.

## 3. Enums: the three elements

Every enum is a contract; enums are the building blocks of the contract
system. A declaration has up to three parts:

```js
Name = Enum(
  ($, [T1, T2]) => $(seat1, seat2)(result),   // seats, and ONE result slot
  (...args) => boolean                         // input validation — optional
)
```

- **Seats** (the first application) — one contract per position, checked at
  every construction. Positional, always.
- **The result slot** (the second application) — takes exactly one thing,
  in one of two forms:
  - **a contract** — `(Numeric)` — the declarative return: recorded once as
    the `produces` fact. Never "run"; consumed later by *other* seats when
    the node sits in them (`Add(Add(1,2), 3)` works because the inner
    node's recorded fact satisfies the outer seat).
  - **a function** — `((T1, T2) => value => ...)` — the membership
    definition: how a value is checked against nodes of this enum. Called
    by the machinery **with the node's elements as arguments**, it returns
    the value-check. Records nothing as a fact.
  A multi-entry result cannot exist — the slot takes one thing. "Produces A
  or B" is written explicitly: `(Union(A, B))`.
- **Input validation** (Enum's optional second argument) — runs at
  construction over all call arguments together, after the seat checks. Its
  only job is what per-position contracts cannot say: relations between
  arguments (`Range` needs `lo <= hi`). Anything about one argument alone
  belongs in a seat.

Telling the two result forms apart needs no marker: a bare arrow — no
`.prototype`, no `Symbol.hasInstance` of its own — can only be a check.
Everything else (a factory, a `contractCheck` contract, a class, an
interned node) is a contract.

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
would read shared mutable state and is ruled out (§8).

## 4. Membership

`v instanceof K` means "v can stand where K is demanded":

1. **Ground contracts** (a `contractCheck` predicate like `Number`, or a
   plain class like `Indeterminate`) answer directly. Every chain ends here.
2. **Enum factory** `F`: true if `v` is an `F`-node; or `v`'s recorded
   `produces` fact satisfies `F` (stands-at, via `sub`); or `F` is
   *transparent* — then `v instanceof C2`.
3. **Enum node** `n` of enum `E`: if `E`'s result is the function form,
   apply it to `n`'s own elements and then to `v` (plus the stands-at
   clause). A transparent enum's node defers to its declared contract the
   same way. A node of an enum whose result is an opaque contract is not
   itself a contract — using it as one fails loudly (native error), never
   silently.

**Transparency rule**: exactly one seat, a contract-form result, the same
canonical reference as the seat (interning makes "same" a pointer check) →
the enum is a see-through box: what it accepts is what it counts as, so its
membership includes its declared contract's members.

**Opacity is load-bearing**: `Add`'s membership stays "is an Add node"
because solve-time dispatch will depend on shape tests; a widened default
would make `3 instanceof Add` true.

`sub` is interned identity today, growing rule by rule with each rule's
first consumer (§7). Its domain is the calculable algebra — `Equals`,
`Range`, `Union`, the kinds, transparent boxes — where every contract
exposes its structure (a singleton its value, a range its endpoints, a
union its branches, a box its contract), every pair is decidable, and
boolean answers are final truth, not approximation: `sub(Equals(1),
Range(0, 100))` is a computed yes, `sub(Range(0, 10), Range(5, 100))` a
computed no. Opaque predicates (`contractCheck(v => ...)`) sit outside the
algebra by design: `sub` grants them identity only, and a gate that cannot
prove an admission rejects it loudly at construction. The three verdicts
(proven / refuted-with-witness / unproven) belong to the algebra's
boundary — NEXT's full analyzer, not the demonstrator.

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
rules land, §7.)

Membership functions never reference the seat generics. Their parameters
receive the node's elements positionally — the node is the storage of what
was bound, and the parameter names (`T1`, `T2`) match the generic names by
convention only. The declaration is resolved once per enum (`once` stays);
bindings live exactly as long as one construction's validation, with a
single reader. No register survives a job; no register is read by checks
or by facts.

## 6. The domain

```js
export const { Add, Sub, Mul, LL, Numeric, Union, Optional, Equals } = createEnums(() => class {

  Union = Enum(($, [T1, T2]) =>
    $(T1, T2)((T1, T2) => value => value instanceof T1 || value instanceof T2))

  Optional = Enum(($, [T]) =>
    $(T)(T => value => value == null || value instanceof T))

  Numeric = Enum($ => $(Union(Number, Indeterminate))(Union(Number, Indeterminate)))

  Add = Enum($ => $(Numeric, Numeric)(Numeric))
  Sub = Enum($ => $(Numeric, Numeric)(Numeric))
  Mul = Enum($ => $(Numeric, Numeric)(Numeric))

  Equals = Enum(($, [E]) => $(E)(E => value => value === E))

  LL = Enum($ => $(Numeric, Optional(LL))(LL))
})
```

- `Union` — the one genuinely custom membership: the disjunction over its
  branches, received as parameters.
- `Optional` — "null or member" — an ordinary definition beside `Union`; it
  is not machinery.
- `Numeric` — the transparency rule at work: contract-form result identical
  to its one seat; membership reaches `typeof` through declared structure
  only, nothing repeated anywhere.
- `Add`/`Sub`/`Mul` — opaque; stand at `Numeric` seats through the recorded
  fact.
- `Equals` — the singleton: `value === E`, exact because of interning. Seed
  of the solved-form bridge.
- `LL` — result stage applied explicitly (`(LL)`).

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

## 7. Parked (open, deliberately)

- `sub` rules, each landing with its first consumer: the transparency hop
  and the union rules with `Div`, containment with `Range`, the singleton
  rule (`sub(Equals(v), B)` = `v instanceof B`) when `Equals` nodes reach
  seats. What a union node "produces" reopens here, if a consumer appears.
- Indeterminate construction: the classes stay — they already serve as an
  open ground contract through the prototype chain, and R-3 already holds
  (a form fails the typeof `Number` contract). The one missing piece is
  interning: constructors return the canonical instance (keyed by class +
  operand, so `1/0 !== 2/0`), which also makes the forms frozen and able
  to be children. Lands with `Div`. Final form names open (the sketch says
  `ZeroDivision`/`ZeroMod`; the NEXT ruling says `DivZero`/`ModZero`).
- Canonical forms for contract nodes: `Union(A, B)` and `Union(B, A)` are
  different nodes for the same set; flattening/dedup/ordering has no
  consumer yet.
- The solve tier: `solve : Node → Node`, links never merges.
- `Range` — needs input validation (`lo <= hi`) and an interval membership
  function — lands with the rule table.

## 8. Ruled out (do not reintroduce)

- A second custom-validator argument for output (V2): the result slot's
  function form *is* the membership definition. C2 and V2 were one idea in
  two slots.
- Membership functions closing over seat generics lexically: shared mutable
  state with a second reader — staleness and nested-check interference by
  construction. Parameters, which the language makes fresh per call, do the
  job with nothing to guard.
- A produces thunk reading the per-call registers (answering with whatever
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
- Machinery-level `Optional` and `extendFn` (retired; prototype-inheritance
  route superseded by recorded facts).
- Per-node storage of class-level facts; per-node membership closures
  (derivable data is not stored — a node's elements are its storage).
- `instanceof` behavior on opaque value nodes (silent false) — misuse stays
  a loud error.
- Context-variable channels for declaration facts (`resolving`) — the
  constructor binds lexically.
- Canonicity side-stores (the WeakSet brand) and any interner that
  constructs (`.map`/`Array.from` copies): the bug class is unrepresentable
  in the pure-cache interner.
- Parallel recognizers generally: one mechanism per fact, single writer,
  keyed by canonical identity.
