# Handover — canonical functions and recursive expansion

This document covers the retained legacy recursive evaluator. The former
production contextual-preparation prototype has been removed; `design.md` and
`decisions.md` remain the design authority. `npm test` reports **187 passing, 0
failing**.

The additive nonrecursive callable-formation path is specified by the later ruling in
`decisions.md`; recursion for that representation remains deferred.

Semantic contract fulfilment uses
`fulfills(value, Contract) = isInstance(value?.valueOf(), Contract)`.
`Equals(value)` forwards its nested value, Indeterminate retains itself, and
generic pattern captures retain the original value. `isInstance` remains the
direct relation for nominal Tuple, Record, Enum, and exact syntax-kind recognition;
see the 2026-08-26 entry in `decisions.md`.

## 1. Canonical function values

Function code is represented by ordinary canonical Enum trees:

- `Lambda(outerReferenceCount, argumentCount, body)` — a lowered function form.
- `OuterRef(index)` — a hole filled from the form's ordered reference environment.
- `CallArgument(index, owner)` — argument `index` of an owner expression
  (`OuterRef`, `Lambda`, or canonical `FunctionRef`).
- `Apply(callee, Tuple(...arguments))` — a call node.
- `Arm(pattern, result)` and `Match(scrutinee, Tuple(...arms))` — function-level
  ordered matching.
- `MatchArgument(index)` — a handler binding reference inside a Match result.

`internFn(form, ...references)` applies a canonical `Lambda` form to its ordered
reference environment and returns one canonical function value. Its identity is
exactly:

```js
(form, Tuple(...references))
```

Rebuilding equal forms with equal ordered references returns the same function
reference. Changing a reference or its position produces a different function.
The lowering producer supplies the complete valid form and ordered reference
environment. `internFn` preserves and interns that structure; it does not harden
the demonstrator by rechecking reference counts or rejecting host functions.

This is a lowered-form API. Source parsing and source-to-`Lambda` lowering are not
implemented here. Consequently, the `a`/`b`/`c`/`d` collapse discussed during the
investigation holds when lowering encodes their internal references as the same
canonical form token. `internFn` does not inspect JavaScript closures to discover
that lowering.

## 2. Recursion without cyclic values

An internal function reference is stored as its canonical `Lambda` form in the
ordered reference environment. When its `OuterRef` is resolved—including in value,
pattern, or callee position—that form is lazily materialized with the current
environment:

```js
internFn(referencedForm, ...currentReferences)
```

No cyclic JavaScript object, function-group value, or separate recursion identity is
involved in this lowered subset. It supports self recursion, mutual recursion between
different forms, and shared external references when the forms use the same ordered
reference layout.

The recursion check uses the complete canonical function identity, not the form
alone. Two functions that share a form but have different applied references do not
stop one another accidentally.

## 3. Expansion and its stop condition

`expand(fn)` invokes a canonical function with one symbolic
`CallArgument(index, fn)` per declared argument.

Evaluation substitutes active call arguments, resolves outer references, evaluates
helper calls, and rebuilds registered Enum values and nominal canonical Tuple
trees through their respective doors. When evaluation
reaches a function identity already active on the call stack, it returns:

```js
Apply(fn, Tuple(...evaluatedArguments))
```

At the current commit the residual call stays in durable expanded form `E`.
Every recursive call reached through the supported Enum/Tuple traversal is
preserved there; a body with two such calls yields a tree containing both.
Completed helper calls leave the stack, so later independent calls are not mistaken
for recursion. This is not a permanent canonical-form rule: a future contextual
judgment may combine or erase an admitted pure call from `C` after deriving its
demands and admission obligations from `E`.

`expand` extracts the resulting structural formula `E` along the evaluated symbolic
path. It does not execute recursion to completion, prove termination, derive an
input domain, or simplify arithmetic itself. It still preserves a value such as
`Sub(Sub(n, 1), 1)` rather than rewriting it to `Sub(n, 2)`.

The former `prepare(E)(incomingContract)`/`Preparation` implementation handled
only two symbolic zero-multiplication contexts and had no caller in Function
formation. It has been removed. `test/contextual-prepare.model.mjs` retains the
Number/Indeterminate examples as a test-only reference. No production contextual
preparation API, cache, solved-`S` integration, or multi-argument judgment exists.
`Produces` remains the ruled widest-result relation; its temporary function-form
declarations still need to become accurate.

## 4. Function-level Match

Symbolic `expand` preserves every complete function `Match` without selecting an
arm. Concrete `apply(fn, ...arguments)` delegates pattern selection to the ordinary
ordered `match()` implementation.

- Arms are tried in order; the first fit wins.
- `MatchArgument(i)` creates or refers to generic binding seat `i`.
- Handler values follow generic declaration order, including through nested matches.
- A contract-only arm forwards the matched value.
- Captured patterns are resolved before matching.
- Pattern instantiation does not rewrite inside Lambda forms or closed FunctionRef
  values; ordinary matching can still inspect their Enum structure.
- If a concrete scrutinee still contains an `Apply`, the complete `Match`
  continuation remains residual instead of selecting an arm prematurely.

This is ordered matching. The separate value-level `Combine` combinator is landed
and tested, but there is no Combine arm in the function Enum vocabulary.

A symbolic `CallArgument` remains inside the preserved expanded Match. It is not
sent through concrete pattern fulfilment during formation. General symbolic branch
judgment remains a later preparation concern.

Pattern construction and pattern fitting are different phases. If constructing an
arm's pattern throws, the match aborts because no valid pattern exists. Fallthrough
occurs only after a valid pattern has been constructed and fails to fit.

## 5. Formation boundary

These Enums are a reusable representation of already-lowered internal forms, not
a linter for the producer that creates them. Their factories state seats and
intern structure, but they do not duplicate lowering promises about whole
indexes/counts, outer-reference bounds, complete reference environments, owner
kinds, Tuple arm contents, host functions, or call arity. `internFn`, symbolic
substitution, invocation, and `expand` likewise omit those defensive preflights.

Those constraints still describe valid lowering where applicable; malformed
source has not become valid. A future parser/linter owns its diagnostics. Runtime
checks remain only where the current evaluator must select an implemented semantic
path, such as materializing a supported callee.

`CallArgument`, `Apply`, and `Match` currently declare `Numeric` as a temporary
result so they can occupy existing Numeric seats. This relies on the repository's
retained `Produces` machinery, but the blanket declarations are formation
scaffolding, not inferred function return contracts. A known nonrecursive Apply is
invoked during expansion; residual calls require later obligation machinery.

## 6. Current test surface

The committed suite covers:

- canonical form and function identity;
- self and different-form mutual recursion;
- external-reference identity and ordering;
- exact recursive residual calls and multiple calls;
- helper composition and stack cleanup;
- arbitrary Enum reconstruction through `mapEnum`;
- ordered, contract-only, and nested Match bindings;
- captured and closed-function patterns;
- residual Match continuations;
- nominal Tuple/Record identity and registered `isInstance(value, Enum)`
  provenance;
- canonical zero-seat Top/Bottom/Null contract Enum values and binary region
  membership Enums;
- local, nonrecursive region deduplication and Top/Bottom reduction laws;
- test-only contextual Number/Indeterminate reference judgments.

## 7. Current boundaries

The following are not landed:

1. Replacement of the temporary blanket `Numeric` declarations on function
   expressions without a FunctionRef return theorem: consumer-derived argument
   demand, effective Match handling, and residual-call obligations.
2. Explicit incoming-region canonicalization at the function/body boundary. The
   removed Preparation prototype must not be restored as a parallel path; its
   six-field shape and Number/Indeterminate rows remain only in the retained test
   model. Every production expression/context rule and correlated multi-argument
   context remains unimplemented. The target `Number` polynomial form
   still requires distribution,
   coefficient collection/cancellation, identities/annihilation, stable ordering,
   left-associated output, retained `Sub`, and `Pow`. `Geo` remains a separate
   important contract/domain feature. There is no `DeterminateNumber`; a `Numeric`
   expression also has an Indeterminate region, and zero multiplication of the
   ruled DivideByZero-style specimen remains Indeterminate.
3. The separate solve and call-domain judgment layers. Their exact input/API and
   association mechanism remain unpinned; retained `S` never merges with or
   replaces `E` or `C`.
4. General canonical region/logic normalization. Zero-seat Top, Bottom, and Null
   contract Enum values, binary Union/Intersection/Difference membership Enums,
   Optional removal, explicit-Null LL, and the immediate root deduplication
   and Top/Bottom laws are landed. The kernel does not recurse. Bottom-up traversal,
   flattening/order/left-association, containment/disjointness, effective Match
   remainders, Pure exact region-to-result logical normalization, guard/`~`
   lowering, and host ingress remain open. `Rest` is only the running remainder
   calculation, not a node.
5. General retained evidence and obligations. Branch-local Match regions can
   encode the correlated partial mapping without an always-present function-domain
   field. The Number algebra may erase a call from `C`; known calls may discharge
   at the proper future judgment boundary, while unresolved outer references retain
   obligations. Failure never selects a different canonical form. Later solved
   `S` remains unimplemented.
6. Source-to-form lowering above the canonical `Lambda` API.
7. Recursive environments whose members require different reference layouts or
   projections.
8. Computed call targets (such as Apply-of-Apply or Match-produced functions),
   Record traversal, non-Numeric result contracts, and function-level Combine arms.

Do not infer the probe's `Term`/`Poly` representation, `Landing` node, two-form
`CallArgument`, `Fn(form, group)`, or a separate recursive identity mechanism from
older probe documents. The probe's particular node representation is not part of
the landed design.

The existing matcher is the settled rule engine. Future contextual rules may
structurally inspect complete `E`; runtime bare contract patterns retain fulfilment
semantics. A runtime match given `C` never recovers erased source operands. The
precise source data/pattern boundary remains to be pinned with lowering.

*End of handover.*
