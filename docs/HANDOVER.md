# Handover — the pattern-matching arc (2026-08-21)

> **Addendum (later the same day):** the `asPattern` window described in §3 and §5
> was the regression; Codex removed it. Current resolution in `src/`: no ambient
> context at all — admission is per-enum. A **structural** enum (its prototype is
> not a contract: Add, Mul, Twin, …) admits contract parts at non-generic seats
> anywhere — a partial tree is a legal value (`Add(Number, 2)` constructs). A
> **contract-valued** enum (Range, Equals, Union, Optional, Numeric) never admits
> contract parts — `Range(Equals(1), Equals(2))` throws, closing §2.2 structurally.
> Nested matches are legal (no state to poison). §4's residue consideration is gone
> with the window; the arm-skip-vs-abort semantics question stands on its own
> merits, still Dane's to decide. The `kind` rename (§2.1) stands. Board 75/0.

For the next assistant continuing THIS work: Dane's pattern matching for the Enums,
the review of it, the two fixes that followed, the pattern/value context mechanism,
and the one question that is still open. Board is **73 passing, 0 failing** with the
working tree as described in §5.

Orientation, one line each: `docs/design.md` is the enum-surface authority;
`docs/decisions.md` holds dated rulings; `docs/recursion-canonicalization-arc.md`
is the previous arc; the philosophy in force: the constructor gate IS the analysis,
one universe, throws are refusal verdicts (routine, data-driven, catchable — the
board's own `throws()` helper treats them as expected outcomes).

---

## 1. What Dane built (committed, `ad99ff9`)

Ordered pattern matching where **patterns are ordinary nodes** — constructed through
the same door as values, with contracts sitting in seats as parts.

```js
match(Add(1, Mul(2, 3)))(
  ($, [a, b, c]) => $(Add(a, Mul(b, c)))((a, b, c) => [a, b, c]),  // captures
  ($, [b])       => $(Add(Equals(1), b))(b => ...),               // contract leaf
  $              => $(Numeric)(value => ...),                      // whole-value contract
  $              => $(_)(() => ...)                                // wildcard
)
```

- `src/match.mjs`: `_` wildcard (`contractCheck(() => true)`, frozen); `caseOf` =
  the `$`; `fits` walks four rules — wildcard, contract (membership/`instanceof`),
  enum node (same `constructor`, same length, parts recurse), identity (`===`).
- Captures are the existing generic registers: fresh `generic()` per arm, generics
  bind through their own contractCheck validators during `fits`, handler receives
  the bindings in creation order. Failed arms leak nothing.
- Ordered arms, first fit wins, exhaustion throws `No pattern matched`.
- Handler convention: a contract-only pattern (not `_`, no bindings) passes the
  matched value; otherwise the bindings.
- To let patterns construct: the Enum validator admits contract parts at
  **non-generic** seats (`isContract` in `src/contract.mjs`; generic seats keep
  identity semantics untouched); `contractCheck` gained an `extend` parameter
  (descriptor spread) — use THAT for decorating contracts, never `Object.assign`.

## 2. The review: three findings, three fates

All three were verified by running them (never claim behavior from memory — he
checks):

1. **Factory membership leak — real, fixed (uncommitted).** The factory carried the
   hidden class as `constructor`, and `producedOf` reads `v.constructor`, so after a
   factory's first construction the factory itself answered with its products'
   fact: `Mul(1, 2); Mul instanceof Numeric === true`, and `match(Mul)` against a
   `$(Numeric)` pattern matched. **Fix (his direction): rename the shared key** —
   `src/enum.mjs` extends the factory with `{ kind: constructor }`, so
   `Add.kind === Add(1, 2).constructor`, and `producedOf` no longer sees factories.
   Board rows updated + a regression row ("a resolved factory does not stand at its
   result contract"). `match.mjs` needed no change (its `.constructor` reads are
   node-to-node).
2. **`Range(Equals(1), Equals(2))` input-validation quirk — RULED NOT AN ISSUE,
   closed.** (`lo <= hi` string-coerces contract parts; direction-dependent; Dane
   closed it. Do not reopen.)
3. **Values could hold contract parts** — `Add(1, Add(Number, 2))` constructed in
   ordinary code. Ruled: contract parts belong to pattern construction only; values
   must never hold them. This produced the pattern window (§3).

## 3. The pattern window (uncommitted) — and how it got its shape

Requirement: contracts legal at seats only while a pattern is being built;
impossible in value code. A literal extra argument can't reach the user's *nested*
calls (`$(Add(a, Mul(b, c)))` — the inner `Mul(...)` is the user's own call), so the
context is ambient — and its final shape is **Dane's**, arrived at over several
corrections of the assistant's versions:

- Assistant v1: a counter + `asPattern(fn)` with `try/finally` around the whole
  case. Rejected: procedural style in a functional codebase; a "global patterns
  count feels super dirty"; and the try-justifications didn't survive scrutiny.
- Dane's corrections that decided the design:
  - **The window is exactly case-entry → `$`.** Patterns are created inside
    `$( /* here */ )( /* and not here */ )`. Handlers are outside the window by
    construction, not by discipline.
  - **The exhaustion throw needs no cleanup** — by the time match runs out of
    arms, every `$` already closed its window.
  - **There is no "bug throw vs routine throw" taxonomy.** `Add("x", b)` refuses
    identically in pattern context and value context — same door, same check. A
    refusal is the system's normal "no".
- **Final shape** (in the tree now): a boolean register in the codebase's
  reset-at-entry discipline, three comma-style touch points, no `try` anywhere:

```js
// contract.mjs
let pattern = false
export const asPattern = (on) => (pattern = on, on)
export const inPattern = () => pattern

// enum.mjs - the admission clause
!definitions[i].generic && inPattern() && isContract(args[i]) || args[i] instanceof definitions[i]

// match.mjs - each row opens; $ closes; end of match closes
asPattern(true)
const [pattern, handler] = define(caseOf, generics(createGeneric))
...
const caseOf = (pattern) => (asPattern(false), (handler) => [pattern, handler])
...
asPattern(false)
throw new TypeError('No pattern matched')
```

- **Known residue, discussed and accepted-as-known:** a refusal *during pattern
  construction* (e.g. `$(Range(lo, hi))` with runtime `lo > hi`, or a mis-typed
  part) propagates out of match with the flag still up; it heals at the next
  match's first row. Every path that stays inside match is covered. Whether §4
  changes this is Dane's decision — do not re-litigate the try/finally route.

Verified at the boundaries: a handler cannot build a contract-part value
(`Add(Number, 2)` throws inside handlers); the world is clean after an exhaustion
throw; `Add(Number, 2)` throws in ordinary code while `$(Add(Number, b))` matches.

## 4. THE OPEN QUESTION — Dane has not decided; ASK, don't assume

**When a pattern refuses to construct, is that (a) the whole match aborting, or
(b) just that arm refusing — fall through to the next arm?**

Today it is (a). The discussion trail pointing at (b): patterns embed runtime data,
so a construction refusal can be data-driven, and since refusals are the system's
one "no", a pattern that can't build for this data looks like an arm that doesn't
apply — same verdict as `fits` failing. (b) would also close the window on every
refusal path as a side effect, erasing §3's residue.

The previous assistant implemented (b) uninvited (an `attempt` try/catch helper in
`match.mjs`) and was reverted on the spot. The question is genuinely open — bring
it to Dane as a question, with both consequences stated plainly.

## 5. Working tree at handover (uncommitted; committing is Dane's call)

- `src/enum.mjs` — `{ kind: constructor }` extend; `inPattern()` in the admission
  clause; import updated.
- `src/contract.mjs` — the `asPattern`/`inPattern` register (with comment).
- `src/match.mjs` — window touch points as in §3. (This file was briefly edited
  without permission and reverted — diff it against §3's description before
  trusting anything.)
- `test/cases.mjs` — rows: "factory kind is the node constructor", "different
  factories expose different kinds", "a resolved factory does not stand at its
  result contract", "a value cannot hold a contract part", "the same shape is
  legal as a pattern".
- `playground.mjs` — demo line uses `Add.kind`.
- `npm test` → 73/0.

## 6. Where we didn't see eye to eye (this arc)

- **try/finally.** The assistant defended it with shifting justifications
  (cleanup → routine exhaustion throws → throw taxonomies); Dane demolished each
  and the register discipline won. If you find yourself reaching for a `try`,
  assume the design is wrong first.
- **The ambient register.** Dane tolerates the boolean flag; he called the shared
  global "super dirty" and would take a cleaner mechanism that keeps the surface
  `$(Add(a, b))` with plain factories. Rejected along the way: counter+finally;
  `Object.assign` bolt-ons (use `contractCheck`'s `extend`); pattern-ness as a
  facts classification (proposed, not taken up); per-factory twin pattern doors
  (parallel mechanism — his kill-word).
- **Review language.** The first review was written in the assistant's shorthand
  and was unreadable; the standard is plain language plus tested repros, every
  claim run before stated, order-of-operations spelled out (the factory leak only
  appears after a factory's first resolve — that tripped the discussion once).
- **Authorization.** One violation in this arc: implementing §4(b) off mockery of
  the assistant's asking-ceremony. Nothing is a go except a go: not agreement, not
  a diagnosis, not frustration, not mockery of how you ask. When the decision
  point arrives, state it in one plain line and stop.

*End of handover.*
