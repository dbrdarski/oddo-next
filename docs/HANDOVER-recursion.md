# Handover — the recursive-function arc & drift-as-the-formula (2026-08-21)

For the assistant continuing this work. **Everything in this arc is probe-only** —
none of it is in `src/`. The re-runnable record with the final probe verbatim is
`docs/recursion-canonicalization-arc.md`; this document is the working handover:
what's established, in whose words, what's open, and what must not be re-proposed.

---

## 1. Why the arc exists

Dane: *"let's test the whole logic against a recursive function"* — followed by
rejecting the first probe, which had a factory tag standing in for the function with
no body: *"there no CountDown function anywhere shown … you say it holds but should
I believe you?"* The standard set there governs everything after: **the function
itself on the table, every number derived from its structure, nothing asserted.**

## 2. The function as structure

The canonical shape comes from NEXT's μ-canonicalization spec v0.6: positional code
(`$n` for parameters, `@capn` for outer references), names never part of identity.
As probe enums:

```js
const ref = CallArgument(null, 0, OuterRef(0))     // "argument 0 of the fn in slot 0"
const K = Lambda(1, Match(
  Arm(Eq(ref, 0), 0),                              //  n == 0  ?  0
  Arm(null, Apply(OuterRef(0), Sub(ref, 2)))       //  : countDown(n - 2)
))
```

- **`CallArgument(value, index, function)` is Dane's node and has two forms**:
  value empty = the definition's unexpanded reference; value filled = the expanded
  structure at an arrival (`Sub(CallArgument(4, 0, cd), 2)`). One node kind, both
  interned formulas, drift readable off either. The function seat says *whose*
  argument this is — self-describing, no de Bruijn depth counting.
- **`OuterRef(i)`** is the form's parameter — the `(outerReference) =>` of his
  function form. It survives because the body cannot hold its own form (that's the
  cycle the design exists to avoid) and externals stay abstracted so twin groups
  share one form.
- The whole definition interns: rebuilding K is pointer-equal. Domain `Sub` is the
  code-former — the body's `n - 2` is the same node kind as any value formula. One
  universe; no separate op layer.

**Killed wrong turns (do not re-propose):** `Record({arity, stop, step})` with named
fields; self-reference by factory tag; a `Param` node without the function seat;
calling the empty value slot a mistake (it isn't — it's the unexpanded form).

## 3. Function identity — Dane's `internFn`, the arc's key result

> fnForm = (outerReference) => () => outerReference()
> fn = internFn(fnForm, fnForm)

As probed: `fn = Fn(form, group)`, `group = Tuple(...group forms, ...external fns)`.
**A group-internal reference enters the key as the FORM** — the cycle is cut in the
key, so no cyclic value ever exists, no construction window, no bisimulation pass.
**An external reference enters as the interned fn.** Proven by pointer equality:

```
a = () => b();  b = () => a();  c = () => c()   →  one fn (a === b === c)
p/q group calling increment vs twin calling decrement  →  distinct (externals in the key)
countDown: Fn(K, Tuple(K)) === cd               →  the capture resolves through the door
```

This replaces v0.6's construction-window + rooted-bisimulation machinery for these
cases with the plain interner. Recursive identity is the door's ordinary job.

## 4. Grounding at the door — no fuel, ever

- **Fuel, budgets, depth caps, evaluation-as-grounding are killed concepts** — by
  Dane here and by NEXT's termination decisions v4 (read its §5 "KILLED" before
  proposing any termination machinery; "no third ending; no budget"). countDown and
  `f(n−2)`-from-1 are that spec's own specimens.
- The call is a node; **its input-validation slot is the judgment** (the same landed
  mechanism that refuses `Range(5, 1)`). A refused call never constructs; execution
  carries no counter because only proven calls exist to run:

```
Apply(cd, 4)   → constructs → solve = 0
Apply(cd, 100) → constructs → solve = 0     (depth 51, no bound — depth ≠ non-completion)
Apply(cd, 5)   → REFUSED (5 not on the derived domain)
Apply(a)       → REFUSED (no reachable stop — a() never completes)
```

**Killed wrong turns:** the fueled interpreter; a `CallSite` node next to `Apply`
(ONE call node; an `OuterRef` callee = composing code, no judgment; a fn callee = a
demanded call, judged); a raw `Number` argument seat (the seat is the callee's
*derived* domain); a declared `Numeric` result on the call (that's the produces
import).

## 5. Drift is the formula — the ruling that names the arc

The assistant collapsed twice and was corrected twice:

1. drift = **−2**, a number read off the tree;
2. drift = an **`a·n + b` template** with everything else "outside the class" —
   the same collapse one level up. Dane: *"I want a case that solves all problems,
   not a single use case"*, then *"Why not `a * n ** z + b`, and a combination of
   such elements? Why not the actual formula?"*

The standing rule: **the whole tree is the formula.** A number is one collapsed
reading taken too early. Expansion — composing the formula into its own reference —
derives everything (this is what `CallArgument` preserves through folding: the
reference is the part canonicalization must never eat).

## 6. The canonical form is values

No shadow representations — the assistant's coefficient arrays were rejected
(*"What is this actually, not an Enum type?"*). The canonical form:

```js
Term = Enum($ => $(Number, Number)(Term))          // a*n**z: (coefficient, exponent)
Poly = Enum($ => $(Term, Optional(Poly))(Poly))    // ordered terms, highest power first
```

`Poly` is the landed `LL` pattern. Formulas are **born canonical** through three
constructors (`plus` merges ordered terms, combines like exponents, drops zeros;
`scale`; `times` distributes) — door-level canonicalization, no normalize pass.
**One evaluator serves both jobs**: `formula(tree, r)` evaluates the written tree in
formula-space; canonicalize = evaluate with the reference bound to n
(`N = Poly(Term(1,1))`); compose/substitute = evaluate with it bound to another
Poly. Pointer-true consequences: `n−1−1 ≡ n−2`, `(n−2)/2 ≡ n/2−1`,
`n·n+(n−n) ≡ n·n`, and the *judgments* intern too.

## 7. The judgment: canonical form (total) + solve rows (partial)

- **Stage 1 never fails inside the op table** — every step formula gets its
  canonical form, held and interned, even when nothing can judge it yet.
- **Stage 2 is a row inventory over canonical families.** The one row built,
  `Landing(a, b, s)` — the landing set of step `a·n + b` at stop `s`, membership in
  closed form: `a = 1` pure drift, both directions (countUp `n+3` included:
  `k = (s−n)/b` whole and positive); `a ≠ 1` geometric around the fixed point
  `p = b/(1−a)` (distance scales by `a`; member iff a whole number of scalings from
  the stop); `s = p` the collapse case — only p itself lands (`half = n/2`, the
  Zeno specimen; JS floats would lie by underflowing to 0, which is exactly why the
  door judges from the formula and never runs to see).
- **Refusals name what they cannot judge**: `no solve row yet for canonical form:
  1*n**2`. Growth = add a row with its soundness story — NEXT's own deferred
  step-kind ↦ orbit-shape table (`±d` ↦ grid, `×r` ↦ Geo). Never widen a template;
  never let incompleteness into the representation.
- **The judge performs zero expansions** — no sampling, no iteration (the
  two-sample version was corrected away). Composition exists as a demonstrable
  property, not a judgment step.

## 8. Open items (Dane's queue, his order)

1. **Calls at value seats without produces** — `q = () => p() + increment()` cannot
   be written: an `Apply` node doesn't stand at `Add`'s Numeric seats without the
   diagnosed import. **Dane is solving this himself, properly, without produces**
   — do not design it for him. The landed pattern matching and Codex's
   structural-seat admission (structural enums accept contract parts; partial trees
   are legal values) look like his solution path assembling. Queued tests:
   `Add(Apply(p), 1)`, the four nesting rows in `docs/decisions.md`, the open
   `Numeric(Numeric(1))` ruling.
2. **Multi-call / per-branch judgment** — all probes are one recursive call in one
   branch. Extending is *"something we should discuss, not a blanket ruling"* (his
   words). Bring as discussion.
3. **The produces-import correction** — diagnosed with full evidence in
   `docs/decisions.md`; still unauthorized.
4. **Landing the kernel vocabulary** (`Lambda`/`Match`-node/`Arm`/`CallArgument`/
   `OuterRef`/`Fn`/`Term`/`Poly`/`Landing`) in `src/` — entirely his call; nothing
   from this arc has landed. Note: the landed `match()` (value-level matcher) and
   the probe's `Match` AST node are different things — don't conflate them.
5. Where canonicalization code lives when it lands (formula constructors beside the
   interner; `Landing` beside `Range`; the row lookup) — sketched only.

## 9. Where we didn't see eye to eye

- **The collapses.** Twice the assistant reduced the formula to a solved artifact;
  Dane's correction stands as method: keep the extended form, derive from it, let
  rows read canonical shapes and let refusals name them.
- **Shadow representations.** Canonical forms are enums. Any "internal format"
  beside the universe is wrong here.
- **Fuel and its cousins** (budgets, retry caps, sampling counts) — killed on
  sight, both here and in the NEXT specs.
- **Invented shapes vs the given ones.** The assistant's Record-function, factory
  tags, Param-without-function-seat, CallSite all lost to the spec and to Dane's
  own forms (`CallArgument`, `internFn`) — which had usually been stated earlier
  and dismissed too quickly. When Dane has given a form, use it before inventing.
- **"Should I believe you."** Every claim gets run before it is stated; outputs
  shown; probe vs landed always labeled.

## 10. Pointers

- `docs/recursion-canonicalization-arc.md` — the full investigation record; its
  appendix is the final probe, re-runnable as-is.
- `docs/decisions.md` — the produces diagnosis + breakage inventory;
  canonicalization-is-one-logic.
- NEXT normative (`../next/docs/normative/`):
  `next-mu-canonicalization-specification-v0-6.md` (function shape & identity),
  `next-kernel-ast-specification-v0-1.md` (Lambda/Match/Apply, desugaring, patterns),
  `next-termination-decisions-v4.md` (grounding; the KILLED list),
  `next-application-induction-specification-v0-8.md` and
  `next-grounding-specification-v0-5.md` (the analyzer core this demonstrator is
  walking toward).

*End of handover.*
