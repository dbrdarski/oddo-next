# oddo.next — design

Agreed 2026-08-19, before implementation. This file is the authority for the
enum/contract surface; the implementation follows it, and where code and this
document disagree, the code is wrong. Earlier layers (interner, facts store)
are documented here as they stand in the code.

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

Current entries: `constructor → 'produces'` — the declared result contract,
recorded at first resolve (concrete C2 only; see §5). Planned: solved forms
(`Add(1,2)` links to `Equals(3)`, never merges), sub verdicts on pairs.

## 3. Enums: the four elements

Every enum is a contract; enums are the building blocks of the contract
system. A declaration has up to four parts:

```js
Name = Enum(
  ($, [G1, G2]) => $(seat1, seat2)(result),   // C1 (seats) and C2 (result)
  (...args) => boolean,                        // V1 — optional
  contractCheck((...C2) => value => boolean)   // V2 — optional
)
```

- **C1** — one contract per position, checked at every construction.
  Positional, always.
- **C2** — recorded at construction, never "run": consumed later by *other*
  seats when the node sits in them (`Add(Add(1,2), 3)` works because the
  inner node's recorded C2 satisfies the outer seat). The result stage is
  written explicitly on every declaration.
- **V1** — runs at construction over all call arguments together, after the
  seat checks. Its only job is what per-position contracts cannot say:
  relations between arguments (`Range` needs `lo <= hi`). Anything about
  one argument alone belongs in C1.
- **V2** — defines membership where the default is too narrow. Curried: its
  leading parameters are the **resolved C2 entries**, then the value. It is
  passed as a `contractCheck(...)`-made contract — that is how the machinery
  tells the two optional validators apart: a plain function is V1, a
  contract carrier is V2. Order-free, at most one of each.

V1 pairs with C1 and receives what C1 checked (the call arguments). V2
pairs with C2 and receives what C2 declared (the return contracts).

## 4. Membership

`v instanceof K` means "v can stand where K is demanded":

1. **Ground contracts** (a `contractCheck` predicate like `Number`, or a
   plain class like `Indeterminate`) answer directly. Every chain ends here.
2. **Enum factory** `F`: true if `v` is an `F`-node; or `v`'s recorded C2
   satisfies `F` (stands-at, via `sub`); or `F` declares a V2 and its C2 is
   concrete — apply V2 to the C2 entries, then to `v`; or `F` is
   *transparent* — then `v instanceof C2`.
3. **Enum node** `n`: apply the enum's V2 to `n`'s resolved C2 entries, then
   to `v` (plus the stands-at clause). A transparent enum's node defers to
   its resolved C2 the same way. A node of an opaque enum with no V2 is not
   a contract — using it as one fails loudly (native error), never silently.

**Transparency rule**: exactly one seat, exactly one C2 entry, the same
canonical reference (interning makes "same" a pointer check), and no V2 →
the enum is a see-through box: what it accepts is what it counts as, so its
membership includes its declared contract's members. A declared V2 always
overrides the default (`Optional` has the transparent shape but means more
than its C2 says).

**Opacity is load-bearing**: `Add`'s membership stays "is an Add node"
because solve-time dispatch will depend on shape tests; a widened default
would make `3 instanceof Add` true.

`sub` is interned identity for now — the seam where the rule table
(unions, ranges, singletons) and the three verdicts
(proven / refuted-with-witness / unproven) grow later.

Termination is structural, not assumed: membership descends through frozen,
acyclic contract nodes to ground checks; finite declarations, finite descent.

## 5. Generics

Generics are the declarative layer: array-destructured (positional; an
infinite generator hands them out), they bind **the call argument itself**
on first use; a repeated seat re-checks by identity, which under interning
is value equality.

Resolution at check time reads **the node itself**: every C2 generic also
sits at a seat, so its bound value is the node's element at that position
(computable once per class). No per-node storage; the node's own elements
are the storage. A C2 generic that appears at no seat is a declaration
error. When C2 mentions generics, no `produces` fact is recorded — what a
union node produces is an explicitly open question, parked until `sub` can
consume the answer.

The names in `($, [T1, T2]) => ...` and in `contractCheck((T1, T2) => ...)`
are different variables that share names by convention: the first are
generics binding seats, the second are ordinary parameters receiving the
resolved C2 entries positionally. Nothing crosses between the closures.

## 6. The domain

```js
export const { Add, Sub, Mul, LL, Numeric, Union, Optional, Equals } = createEnums(() => class {

  Union = Enum(
    ($, [T1, T2]) => $(T1, T2)(T1, T2),
    contractCheck((T1, T2) => value => value instanceof T1 || value instanceof T2)
  )

  Optional = Enum(
    ($, [T]) => $(T)(T),
    contractCheck(T => value => value == null || value instanceof T)
  )

  Numeric = Enum($ => $(Union(Number, Indeterminate))(Union(Number, Indeterminate)))

  Add = Enum($ => $(Numeric, Numeric)(Numeric))
  Sub = Enum($ => $(Numeric, Numeric)(Numeric))
  Mul = Enum($ => $(Numeric, Numeric)(Numeric))

  Equals = Enum(
    ($, [E]) => $(E)(E),
    contractCheck(E => value => value === E)
  )

  LL = Enum($ => $(Numeric, Optional(LL))(LL))
})
```

- `Union` — the one genuinely custom membership: the disjunction over its
  resolved branches.
- `Optional` — transparent shape, but V2 declared: "null or member" exceeds
  its C2. Lives beside `Union` as an ordinary definition; it is not
  machinery.
- `Numeric` — the transparency rule at work: no V2, nothing repeated;
  membership reaches `typeof` through declared structure only.
- `Add`/`Sub`/`Mul` — opaque; stand at `Numeric` seats through recorded C2.
- `Equals` — transparent shape but its resolved C2 is a bound *value*, so
  the default would be nonsense; its V2 states the real membership: the
  singleton, by interned identity. Seed of the solved-form bridge.
- `LL` — result stage applied explicitly (`(LL)`), per the accepted block.

### Traces

`Add(1, 1)`:
seat asks `1 instanceof Numeric` → transparent → `1 instanceof
Union(Number, Indeterminate)` → Union's V2 over its branches →
`1 instanceof Number` → typeof → true. Three steps, each either a declared
V2 applied to declared C2, or ground.

`Add(1, Mul(2, 3))`:
the `Mul` node fails Numeric's chain (not a number, not an Indeterminate)
→ but its recorded C2 is `Numeric` → stands-at → true. Values enter through
membership, nodes enter through C2.

## 7. Parked (open, deliberately)

- What a generic-C2 node records as its `produces` fact (nothing today).
- Meaning of a multi-entry C2 (never used; unruled).
- The `sub` rule table and the three verdicts.
- Indeterminate forms as gated interned values — `DivZero(a)` / `ModZero(a)`
  keyed by (form, operand) so `1/0 !== 2/0`; required before an
  Indeterminate can be anyone's child (the frozen door); the
  `extends Number` vehicle dies then.
- Variadic seats / N-ary `Union` (binary nests meanwhile).
- The solve tier: `solve : Node → Node`, links never merges.
- `Range` — the enum that needs both V1 (`lo <= hi`) and V2 (interval
  membership) — lands with the rule table.

## 8. Ruled out (do not reintroduce)

- Membership smuggled into the result position, or any custom validation
  conflated with C2.
- Validators receiving generics as parameters (they receive call arguments
  / resolved C2 entries).
- Machinery-level `Optional` and `extendFn` (retired; prototype-inheritance
  route superseded by recorded C2).
- Per-node storage of class-level facts; per-node membership closures
  (derivable data is not stored).
- `instanceof` behavior on opaque value nodes (silent false) — misuse stays
  a loud error.
- Context-variable channels for declaration facts (`resolving`) — the
  constructor binds lexically.
- Canonicity side-stores (the WeakSet brand) and any interner that
  constructs (`.map`/`Array.from` copies): the bug class is unrepresentable
  in the pure-cache interner.
- Parallel recognizers generally: one mechanism per fact, single writer,
  keyed by canonical identity.
