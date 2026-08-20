# oddo.next — decisions

Dated record of rulings and their evidence. `design.md` stays the settled
specification; entries here capture what was decided, on what grounds, and
what remains open — before the spec absorbs it.

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

Untouched: construction, seats, identity and interning, transparency,
unions, `Optional`, `Equals`, `Range`, Indeterminate forms, `LL`
(self-result needs no chain — its own class already answers).

**Doc surgery due with the correction:** §2's produces entry, §5's thunk
ruling (obsolete), §8 gains the import itself to the ruled-out list.

**Status.** Diagnosis ruled. Implementation waits on: the plan written
against the doc, the `Numeric(Numeric(1))` ruling, and an explicit go.
