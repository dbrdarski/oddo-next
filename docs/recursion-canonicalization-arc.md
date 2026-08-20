# oddo.next — the recursion & canonicalization arc (2026-08-20)

**Status: investigation record.** Everything here ran as probes; `src/` is untouched.
`design.md` remains the authority on the landed surface; rulings that graduate go to
`decisions.md`. This file records what was tried, what Dane corrected or ruled, what
the probes proved, and what is open — so the arc can be resumed without re-deriving it.

Provenance marks: **[Dane]** = his ruling/correction/design. Claude's errors are named
as errors.

---

## 1. The challenge

**[Dane]** "Let's test the whole logic against a recursive function." The first probe
faked it — `CountDown = Enum($ => $(Numeric)(Numeric))` was a tag with no body, the
stop condition was hand-supplied. **[Dane]** rejected it: *"there no CountDown function
anywhere shown, not its AST Enum structure. you say it holds but should I believe you?"*
Everything after follows from taking that seriously: the function itself must be on the
table, and every number derived from it.

## 2. The function shape (from the NEXT specs)

Two spec trips, each killing an invention:

- `next-mu-canonicalization-specification-v0-6.md`: one function, one code shape —
  positional de-Bruijn parameters (`$n`), positional outer references (`@capn`), no
  names in identity. The function value is the code **applied** to its references.
- `next-kernel-ast-specification-v0-1.md`: `Lambda(params, body)`, `Match` as the sole
  control node, the ruled ternary lowering (`c ? t : e` → guard arm + else arm).
- `next-termination-decisions-v4.md`: evaluation-as-grounding is **killed**; the walk
  has two endings, base or revisited state — *"no third ending; no budget."*
  countDown is literally a spec specimen: `f(n−2)` from 1 — descent yes, landing no,
  **refuted by the grid**, witness = the call's own written argument.

Errors killed en route: a `Record({arity, stop, step})` function shape (named fields in
identity); self-reference by factory tag (superseded group-identity side channel); a
fueled interpreter (the killed budget); a hand-rolled `grounded` predicate at the wrong
place.

countDown as structure, final form:

```js
const ref = CallArgument(null, 0, OuterRef(0))       // "argument 0 of the fn in slot 0"
const K = Lambda(1, Match(
  Arm(Eq(ref, 0), 0),                                //  n == 0  ?  0
  Arm(null, Apply(OuterRef(0), Sub(ref, 2)))         //  : countDown(n - 2)
))
const cd = Fn(K, Tuple(K))
```

The whole definition is one interned value: rebuilding it is pointer-equal. There is no
name anywhere — `countDown` exists only as structure.

## 3. `CallArgument(value, index, function)` — the one reference node **[Dane]**

His original form, restored after two of Claude's wrong turns (first dropping the
function seat for a bare `Param(0)`, then calling the empty value slot a mistake):

- **value empty** → the definition's unexpanded reference ("whatever arrives").
- **value filled** → the expanded structure at an arrival: `Sub(CallArgument(4, 0, cd), 2)`.

One node kind, two forms, both interned formulas. The reference is self-describing —
`(index, function)` says whose argument it is; no depth-counting conventions.

## 4. The function form: `internFn(form, ...outerReferences)` **[Dane]**

> fnForm = (outerReference) => () => outerReference()
> fn = internFn(fnForm, fnForm)

The applied reference list **is** the resolution of recursive identity:

- a **group-internal** reference enters as the **form** (the cycle is cut in the key —
  no cyclic value is ever constructed, no construction window, no bisimulation pass);
- an **external** reference enters as the **interned fn** (function references are
  ordinary Enum arguments).

In the probe: `Fn(form, group)` with `group = Tuple(...forms, ...external fns)`;
`OuterRef(i)` indexes the group. Proven consequences, all pointer-checks:

```
a = () => b();  b = () => a();  c = () => c()      → one fn reference (a === b === c)
p = () => q();  q = () => cond ? p() : increment() → Fn(pForm, Tuple(pForm, qForm, increment))
twin group with decrement                          → different pointer (p !== p2)
countDown                                          → Fn(K, Tuple(K)) === cd
```

**Why `OuterRef` survives** (answering "why is Capture still in play"): it is the
form's parameter — the `(outerReference) =>` — not μ-spec vocabulary. The body cannot
hold its own form (that is the cycle), and externals must stay abstracted too, because
that is exactly what lets p and p′ share one form while differing only in the applied
list. The sharing is the point of the design.

## 5. Grounding at the door — no fuel, no recursion in the judge

The call is a node; its input-validation slot (the same landed mechanism as
`Range(5, 1)`) carries the judgment:

```js
Apply = Enum($ => $(Union(Union(OuterRef, Lambda), Fn), Optional(Numeric))(Apply),
          (callee, arg) => callee instanceof OuterRef || arg instanceof domainOf(callee))
```

- `OuterRef` callee = composing code — no arrival, no judgment.
- `Lambda`/`Fn` callee = a demanded call — the argument is membership-checked against
  the callee's **derived** accepted domain.
- A refused call never constructs; execution carries no counter because only proven
  calls exist to be run. `Apply(cd, 100)` runs to depth 51 bare — unbounded depth and
  non-completion are different quantities.

**[Dane]** corrections folded in: `CallSite` deleted (it duplicated `Apply` — one call
node); the raw `Number` argument seat and the declared `Numeric` result were both wrong
(the seat is the callee's derived domain; a declared result is the produces-import).
The judge performs **zero** expansions — closed form, no sampling knob. *"No fuel, but
also no recursion (multiple calls to a single function) — or in worst case per branch,
but this is something we should discuss, not a blanket ruling."* → §9 open items.

## 6. Drift is the formula **[Dane]**

Claude collapsed twice and was corrected twice:

1. drift = **−2** (a number read off the tree) — collapse #1.
2. drift = the **`a·n + b` template** (a two-slot classifier; everything else "outside
   the class") — collapse #2, the same mistake one level up.

**[Dane]**: *"What is the extended form? The formula. You have been collapsing it to a
solution. I say drift as a reference, not as the exact concept."* And: *"Why not
`a * n ** z + b`, and a combination of such elements? Why not the actual formula?"*

The ruling that emerged: **the canonical form is the actual formula, canonicalized** —
an ordered combination of `a·n^z` terms, literals folded, like terms combined. The
representation never truncates; only the solve inventory is partial.

## 7. The canonical form as values — no shadow representations **[Dane]**

Claude's coefficient arrays (`[-2, 1]` + raw-array arithmetic) were rejected: *"What is
this actually, not an Enum type?"* The canonical form is enums:

```js
Term = Enum($ => $(Number, Number)(Term))          // a*n**z: (coefficient, exponent)
Poly = Enum($ => $(Term, Optional(Poly))(Poly))    // ordered terms, highest power first
```

`Poly` is the landed `LL` pattern. Formulas are **born canonical** through three
constructors that only build canonical values (the door owns normalization):

```js
plus(p, q)    // merge ordered terms; like exponents combine; zero coefficients drop
scale(p, k)   // multiply every coefficient
times(p, q)   // distribute: a·n^i × b·n^j = ab·n^(i+j), then merge
```

**One evaluator serves canonicalization and composition** — evaluate the written tree
in formula-space:

```js
formula(tree, r)                 // the reference evaluates to r
canonicalOf(tree) = formula(tree, N)      // N = Poly(Term(1,1)) — the reference itself
compose(tree, g)  = formula(tree, g)      // substitution = the same evaluation at g
```

Interning consequences (all pointer-true in the probes):

```
canonicalOf(n−1−1)      === canonicalOf(n−2)        // spellings collapse
canonicalOf((n−2)/2)    === canonicalOf(n/2−1)      // across different op mixes
canonicalOf(n·n+(n−n))  === canonicalOf(n·n)        // at every degree
(n/2−1) ∘ (n/2−1)       →  0.25·n − 1.5             // composition closed in the class
```

## 8. The judgment: canonical form (total) + solve rows (partial)

```js
domainOf(fn):
  cs = canonicalOf(step formula)             // always succeeds within the op table
  degree 1 → Landing(a, b, s)                // the one row that exists
  otherwise → throw "no solve row yet for canonical form: <shown>"
```

`Landing(a, b, s)` — the landing set of step `a·n + b` at stop `s`, one contract node,
membership = closed-form solve:

- `a = 1`: pure drift, both directions — `k = (s−value)/b` whole and positive.
  countDown → `Landing(1, −2, 0)` (evens ≥ 0); countUp `n+3` → `Landing(1, 3, 0)`
  (0, −3, −6, …).
- `a ≠ 1`: geometric around the fixed point `p = b/(1−a)` — distance scales by `a`;
  membership asks whether the arrival is a whole number of scalings from the stop.
  `n/2 − 1` (p = −2) → landing set 0, 2, 6, 14, …
- `s = p`: the stop sits on the fixed point — only p itself lands. `half = n/2` →
  `Landing(0.5, 0, 0)` = just 0. This is the Zeno specimen: exact arithmetic never
  reaches the fixed point; JS floats would lie by underflowing to 0 — which is why the
  door judges from the formula and never runs to see.

Judgments intern — `domainOf(n−1−1 version) === domainOf(n−2 version)` — the interner
as the judgment cache. Refusals **name** the canonical form they could not judge:
`square(2): REFUSED (no solve row yet for canonical form: 1*n**2)` — the formula is
held even where the solver is not yet entitled to an answer.

This two-stage shape matches NEXT's own deferred design (termination decisions D-4):
the step-kind ↦ orbit-shape table (`±d` ↦ grid, `×r` ↦ Geo), each row owing its own
soundness proof. Growth = adding a proven row; never widening a template, never
touching the representation.

## 9. Open, and what's next

- **Calls at value seats** — `q = () => p() + increment()` cannot be written: `Apply`
  nodes do not stand at `Add`'s Numeric seats without the produces import (the same
  question as the breakage inventory in `decisions.md`). **[Dane]**: *"I am going to
  solve the problem without produces, properly."* Queued test cases:
  `Add(Apply(p), 1)`, the four nesting rows, the open `Numeric(Numeric(1))` ruling.
- **Multi-call / per-branch judgment** — all probes are single recursive call, single
  branch. **[Dane]**: to be discussed, not blanket-ruled.
- **Pattern matching for the Enums — ruled the next implementation target [Dane].**
  The probes are the motivating corpus: `formula`, `evalE`, `plus`, `domainOf` are all
  hand-rolled matches (kind test = `instanceof`, positional binding = seat
  destructuring, guards = `if`). Membership is already the pattern test (factories,
  unions, `Equals`, `Range`, `Landing` all answer `instanceof`), which is NEXT's
  contracts-as-patterns: the enums are where contracts get made, Match is where they
  get consumed — the missing kernel half.

Also still pending from before this arc: the produces-import correction (diagnosed,
recorded, unauthorized).

## Appendix — the final probe, complete

The last full probe (canonical form as enums, one evaluator, Landing row, door wiring),
verbatim as it ran green:

```js
import { Enum, createEnums } from './src/enum.mjs'
import { Tuple } from './src/intern.mjs'
import { Add, Sub, Mul, Div, Numeric, Union, Optional } from './src/domain.mjs'
import { Number } from './src/numeric.mjs'

const { OuterRef, Eq, Apply, Arm, Match, Lambda, Fn, CallArgument, Term, Poly, Landing } = createEnums(() => class {
  OuterRef = Enum($ => $(Number)(OuterRef))
  Eq      = Enum($ => $(Numeric, Numeric)(Eq))
  Arm     = Enum($ => $(Optional(Eq), Union(Number, Apply))(Arm))
  Match   = Enum($ => $(Arm, Arm)(Match))
  Lambda  = Enum($ => $(Number, Union(Union(Match, Apply), Numeric))(Lambda))
  Fn      = Enum(($, [F, R]) => $(F, R)(Fn))
  CallArgument = Enum($ => $(Optional(Numeric), Number, Union(OuterRef, Fn))(Numeric))
  Term    = Enum($ => $(Number, Number)(Term))
  Poly    = Enum($ => $(Term, Optional(Poly))(Poly))
  Landing = Enum($ => $(Number, Number, Number)((a, b, s) => value => {
    if (!(value instanceof Number)) return false
    if (value === s) return true
    if (a === 1) return b !== 0 && (s - value) / b > 0 && globalThis.Number.isInteger((s - value) / b)
    const p = b / (1 - a)
    if (s === p) return value === p
    const ratio = (value - p) / (s - p)
    if (ratio <= 0) return false
    const k = Math.round(Math.log(ratio) / Math.log(1 / a))
    return k >= 1 && (1 / a) ** k === ratio
  }), (a) => a !== 0)
  Apply   = Enum($ => $(Union(Union(OuterRef, Lambda), Fn), Optional(Numeric))(Apply),
              (callee, arg) => callee instanceof OuterRef || arg instanceof domainOf(callee))
})

const plus = (p, q) => {
  if (p == null) return q
  if (q == null) return p
  const [pt, pr] = p, [qt, qr] = q
  if (pt[1] > qt[1]) return Poly(pt, plus(pr, q))
  if (pt[1] < qt[1]) return Poly(qt, plus(p, qr))
  const c = pt[0] + qt[0], rest = plus(pr, qr)
  return c === 0 ? rest : Poly(Term(c, pt[1]), rest)
}
const scale = (p, k) => p == null || k === 0 ? undefined : Poly(Term(p[0][0] * k, p[0][1]), scale(p[1], k))
const timesTerm = (q, c, z) => q == null ? undefined : Poly(Term(q[0][0] * c, q[0][1] + z), timesTerm(q[1], c, z))
const times = (p, q) => p == null ? undefined : plus(timesTerm(q, p[0][0], p[0][1]), times(p[1], q))
const divide = (p, q) => {
  if (q != null && q[1] == null && q[0][1] === 0) return scale(p, 1 / q[0][0])
  throw TypeError('outside the class: division by a formula')
}

const formula = (t, r) =>
  t instanceof CallArgument ? r
  : typeof t === 'number' ? (t === 0 ? undefined : Poly(Term(t, 0)))
  : t instanceof Add ? plus(formula(t[0], r), formula(t[1], r))
  : t instanceof Sub ? plus(formula(t[0], r), scale(formula(t[1], r), -1))
  : t instanceof Mul ? times(formula(t[0], r), formula(t[1], r))
  : t instanceof Div ? divide(formula(t[0], r), formula(t[1], r))
  : (() => { throw TypeError('no canonicalization row for this op') })()

const N = Poly(Term(1, 1))
const canonicalOf = (tree) => formula(tree, N) ?? Poly(Term(0, 0))

const domainOf = (fn) => {
  const code = fn instanceof Fn ? fn[0] : fn
  const [stopArm, stepArm] = code[1]
  const cs = canonicalOf(stepArm[1][1])
  const [t1, rest] = cs
  if (t1[1] === 1 && (rest == null || (rest[0][1] === 0 && rest[1] == null)))
    return Landing(t1[0], rest == null ? 0 : rest[0][0], stopArm[0][1])
  throw TypeError(`no solve row yet for canonical form: ${show(cs)}`)
}

const showT = (t) => t[1] === 0 ? `${t[0]}` : t[1] === 1 ? `${t[0]}*n` : `${t[0]}*n**${t[1]}`
const show = (p) => p == null ? '0' : p[1] == null ? showT(p[0]) : `${showT(p[0])} + ${show(p[1])}`

const ref = CallArgument(null, 0, OuterRef(0))
const mk = (tree) => (K => Fn(K, Tuple(K)))(
  Lambda(1, Match(Arm(Eq(ref, 0), 0), Arm(null, Apply(OuterRef(0), tree)))))

const resolveRef = (g) => (i) => g[i] instanceof Lambda ? Fn(g[i], g) : g[i]
const evalE = (e, env) =>
  typeof e === 'number' ? e
  : e instanceof Fn ? e
  : e instanceof CallArgument ? (e[0] ?? env.args[e[1]])
  : e instanceof OuterRef ? env.caps(e[0])
  : e instanceof Add ? evalE(e[0], env) + evalE(e[1], env)
  : e instanceof Sub ? evalE(e[0], env) - evalE(e[1], env)
  : e instanceof Div ? evalE(e[0], env) / evalE(e[1], env)
  : e instanceof Mul ? evalE(e[0], env) * evalE(e[1], env)
  : e instanceof Eq ? evalE(e[0], env) === evalE(e[1], env)
  : e instanceof Apply ? run(evalE(e[0], env), [evalE(e[1], env)])
  : undefined
const run = ([code, group], args) => {
  const env = { args, caps: resolveRef(group) }
  for (const [guard, result] of code[1])
    if (guard == null || evalE(guard, env) === true) return evalE(result, env)
}
const solve = (site) => evalE(site, {})
```

Verified in the probes: spelling collapse at degrees 1 and 2 (pointer-true), composition
closure, judgment interning, `cd(4)`/`mixed(14)` solving to 0 bare, `half(8)` and
`square(2)` refused at the door with the reason named, and the a/b/c ≡ one-fn and
p ≠ p′ identity results of §4.

*End of the arc record.*
