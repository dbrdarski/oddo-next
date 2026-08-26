# Historical record — recursion and formula investigation

This file records the useful direction changes from the 2026-08-20/21
investigation. It is **not** the current API or design authority.

The committed implementation is described in `docs/HANDOVER-recursion.md` and
`src/function.mjs`. The current test suite reports **168 passing, 0 failing**.

**Later supersession (2026-08-25).** This history originally concluded that
canonicalization belonged inside factory formation and that the expanded candidate
was transient. That placement did not survive. The current ruling retains expanded
`E`, derives contextual canonical `C` from explicit semantic context, and keeps
later solved `S` separate. Polynomial, region, recursion, and matcher-reuse conclusions
remain valid unless explicitly tied below to the old factory placement.

## 1. Durable conclusions from the investigation

The following ideas survived into the implementation:

1. **Functions are canonical structural values.** Function code is represented by
   Enum trees rather than opaque JavaScript closures or a hand-authored metadata
   Record.
2. **A function value is a form applied to ordered outer references.** The public
   formation operation is `internFn(form, ...references)`.
3. **References are positional.** `OuterRef(index)` and owner-qualified
   `CallArgument(index, owner)` keep names out of identity.
4. **The owner is not optional.** There is one CallArgument shape in the committed
   code; it always contains both index and function owner.
5. **The oddo.next expansion result is the pre-normalization structural formula.**
   Expansion must not collapse an evaluated body to a scalar “drift” or keep only
   one recursive call. Every residual `Apply` encountered through supported
   Enum/Tuple traversal remains in that current pre-normalization structural result;
   a pending Match preserves its complete continuation. That result is durable `E`.
   Later contextual preparation may combine or erase an admitted pure call from
   `C` while preserving `E` and its derived demands/admission obligations.
6. **Recursion requires a call stack.** Re-entry is detected by exact canonical
   FunctionRef identity, not by function form, a root-only sentinel, a depth cap,
   or a fuel counter.
7. **Matching is reused.** Function-level `Match` delegates fitting to the existing
   ordered matcher rather than introducing a second pattern system.
8. **There is one value universe.** Existing domain Enums are rebuilt through their
   factories; no coefficient arrays or shadow formula AST landed.

## 2. What actually landed

The committed vocabulary is:

```js
Lambda(outerReferenceCount, argumentCount, body)
OuterRef(index)
CallArgument(index, owner)
Apply(callee, Tuple(...arguments))
Arm(pattern, result)
Match(scrutinee, Tuple(...arms))
MatchArgument(index)
internFn(form, ...orderedReferences)
expand(functionRef)
```

`internFn` returns a canonical internal FunctionRef keyed by the Lambda form and
canonical Tuple of ordered references. Lambda tokens in that environment are
materialized lazily with the same environment when their outer references resolve.
This supports self recursion and different-form mutual recursion under a common
reference layout.

`expand` seeds one `CallArgument(index, fn)` per declared argument, symbolically
evaluates helpers and ordinary Enum structure, and residualizes any call to an
already-active exact function reference:

```js
Apply(fn, Tuple(...evaluatedArguments))
```

A body such as:

```js
Add(
  Apply(self, Tuple(Sub(n, 1))),
  Apply(self, Tuple(Sub(n, 2)))
)
```

therefore retains both calls in expanded `E`. A pending call in a Match scrutinee
retains the complete Match continuation. These facts do not require every call
occurrence to survive contextual canonical `C`.

## 3. Probe machinery that did not land

The following shapes appeared in experiments or generated handovers but are not
part of the committed design:

- `CallArgument(value, index, function)` with empty and filled variants;
- `Fn(form, group)` or a semantic declaration-group node;
- source-declaration graph partitioning machinery;
- a custom recursion window or root-only stop exception;
- a separate `Eq` node or private pattern fitter;
- the probe's polynomial `Term`/`Poly` representation;
- `canonicalOf`, `Landing`, `domainOf`, or solve-row dispatch;
- fuel, sampling, iteration limits, or running recursion to infer termination.

The old probe code demonstrated possible local representations, not accepted
oddo.next architecture. In particular, its `Term`/`Poly` and Landing nodes must not be
described as “landed,” and its result tables are not evidence about current
behavior. It also cannot be used to infer a closed canonical rewrite inventory.

## 4. Canonical structural identity versus formula normalization

The current implementation canonicalizes equal written Enum structure through the
interner. It does not yet canonicalize algebraic equivalence:

```js
Add(1, 2) !== Add(2, 1)
Sub(Sub(n, 1), 1) !== Sub(n, 2)
```

The later placement is contextual preparation. Factories validate, construct, and
structurally intern their nodes; the complete pre-normal expression is durable
`E`. Pure preparation takes `E` plus explicit semantic context, derives
demands/regions/obligations, and retains canonical `C`. A later separate judgment
may derive retained `S`; its input/API remains unpinned. Structural matching still
selects local rules, but there is no Enum/createEnums formation hook and phase-blind
`mapEnum` cannot by itself transform `E` into `C`.

The target remains full polynomial normal form for the admitted `Number` region,
including stable ordering, distribution, collection/cancellation,
identities/annihilation, retained `Sub`, and `Pow`. There is no
`DeterminateNumber`; `Numeric` also contains Indeterminate, whose separately ruled
zero-multiplication specimen remains Indeterminate. Geo remains a separate
contract/domain feature rather than a Pow replacement.

Demands and call-admission obligations are derived from durable `E` and retained
as distinct preparation outputs and correlated canonical Match regions. This
allows an admitted call or Number operation to disappear from `C` without
broadening accepted inputs, and requires rejection when its obligations do not
discharge. It does not add a function-domain seat. The probe's specific
`Term`/`Poly` representation is not required.

The later logical ruling uses the same ordinary Match/Arm and contract values:
Top, Bottom, Null, Union, Intersection, and relative Difference. Every ordered arm
is intersected with the running remainder and every prior exact arm is subtracted
before the next one; `Rest` is only a conceptual name for that calculation. Pure
exact logical spellings canonicalize by their region-to-result meaning. De Morgan
and DNF are internal techniques, not public logical nodes.

## 5. Current implementation work

- Replace the temporary blanket `Numeric` declarations on `CallArgument`, `Apply`,
  and `Match` through consumer-derived argument demand, effective Match handling,
  and residual-call obligations. Do not infer a result theorem from FunctionRef;
  retain `Produces` for ordinary result-bearing forms.
- Implement the ruled matcher-driven contextual preparation of durable `E`,
  contextual `C` retention, later `S` association, Number polynomial form/Pow,
  canonical contract regions, effective Match remainders, Pure logical
  normalization, and retained expanded-form obligations. The shared matcher/domain
  binder is landed but performs no retention.
- Add Top, Bottom, one Null, Intersection, and Difference; remove Optional in
  favor of `Union(Null, T)`.
- Investigate Geo with its actual domain consumer and specify broader
  Indeterminate-consuming algebra separately.
- Define the later judgment tier separately; its input/API remains unpinned and
  retained `S` never replaces `E` or `C`.
- Add source-to-Lambda lowering only if a surface above the current lowered Enum API
  is required.
- Generalize recursive environments only when a concrete case requires different
  member layouts or projections.

This record should be read for motivation and rejected turns. For present behavior,
use the implementation, tests, `docs/design.md`, `docs/decisions.md`, and
`docs/HANDOVER-recursion.md`.
