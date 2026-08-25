# Handover — canonical functions and recursive expansion

This document describes committed behavior beginning with `cf99272` and labels the
later ruled-but-unimplemented canonicalization target separately. `design.md` and
`decisions.md` remain the design authority. `npm test` reports **129 passing,
0 failing**.

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
Ordinary host functions are rejected as bodies/references. The current
demonstrator guard admits a function carrying any own `Symbol.hasInstance`
property; it checks presence only, not callability or canonical provenance.
Language-level function values themselves are canonical Enums.

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
helper calls, and rebuilds existing Enum and canonical Tuple trees. When evaluation
reaches a function identity already active on the call stack, it returns:

```js
Apply(fn, Tuple(...evaluatedArguments))
```

At the current commit the residual call stays in durable expanded form `E`.
Every recursive call reached through the supported Enum/Tuple traversal is
preserved there; a body with two such calls yields a tree containing both.
Completed helper calls leave the stack, so later independent calls are not mistaken
for recursion. This is not a permanent canonical-form rule: later contextual
preparation may combine or erase an admitted pure call from `C` while retaining
`E` and the demands/admission obligations derived from it.

`expand` extracts the resulting structural formula `E` along the evaluated symbolic
path. It does not execute recursion to completion, prove termination, derive an
input domain, or currently simplify arithmetic. At `cf99272`, for example, it
preserves `Sub(Sub(n, 1), 1)` rather than rewriting it to `Sub(n, 2)`. Implementing
the explicit contextual preparation stage is the next semantic step.

Factories continue to validate, construct, and structurally intern their nodes;
the complete expansion result is durable `E`. Pure preparation takes `E` plus
explicit context, derives accepted/result regions and obligations, and retains
canonical `C`. This is semantic notation rather than a pinned JavaScript API. The
same `E` can produce different local `C` under different Match regions. `mapEnum`
is phase-blind structural rebuilding and has no incoming context, so it cannot by
itself transform `E` into `C`. `expand` does not own a special normalizer, but an
explicit caller must invoke the general preparation stage.

## 4. Function-level Match

Function `Match` delegates pattern selection to the ordinary ordered `match()`
implementation.

- Arms are tried in order; the first fit wins.
- `MatchArgument(i)` creates or refers to generic binding seat `i`.
- Handler values follow generic declaration order, including through nested matches.
- A contract-only arm forwards the matched value.
- Captured patterns are resolved before matching.
- Pattern instantiation does not rewrite inside Lambda forms or closed FunctionRef
  values; ordinary matching can still inspect their Enum structure.
- If the evaluated scrutinee still contains an `Apply`, the complete `Match`
  continuation remains residual instead of selecting an arm prematurely.

This is ordered matching. The separate value-level `Combine` combinator is landed
and tested, but there is no Combine arm in the function Enum vocabulary.

A bare symbolic `CallArgument` is matched using the same ordinary pattern semantics
as every other value. General symbolic branch judgment is not implemented.

Pattern construction and pattern fitting are different phases. If constructing an
arm's pattern throws, the match aborts because no valid pattern exists. Fallthrough
occurs only after a valid pattern has been constructed and fails to fit.

## 5. Validation boundaries

Construction and expansion reject malformed forms and calls:

- reference and argument indices must be non-negative integers;
- outer references in a Lambda body must fit its declared reference count;
- `internFn` requires exactly that many applied references;
- argument and arm collections must be canonical Tuples;
- callee and CallArgument owner expressions must be an `OuterRef`, `Lambda`, or
  canonical `FunctionRef`;
- call arity is checked before a call can become residual;
- ordinary host functions without an own `Symbol.hasInstance` marker are rejected;
  the marker is a presence-only demonstrator guard, not provenance validation.

`CallArgument`, `Apply`, and `Match` currently declare `Numeric` as a temporary
result so they can occupy existing Numeric seats. This relies on the repository's
current `Produces` machinery and is not a final account of function result shape.

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
- invalid references, host functions, Tuple shape, and arity.

## 7. Current boundaries

The following are not landed:

1. Replacement of the temporary Numeric/`Produces` treatment of function
   expressions.
2. Implementation of oddo.next's matcher-driven contextual preparation over
   durable `E`, including retention of contextual `C`. `Number` has the full
   polynomial form: distribution,
   coefficient collection/cancellation, identities/annihilation, stable ordering,
   left-associated output, retained `Sub`, and `Pow`. `Geo` remains a separate
   important contract/domain feature. There is no `DeterminateNumber`; a `Numeric`
   expression also has an Indeterminate region, and zero multiplication of the
   ruled DivideByZero-style specimen remains Indeterminate.
3. The separate solve and call-domain judgment layers. Their exact input/API and
   association mechanism remain unpinned; retained `S` never merges with or
   replaces `E` or `C`.
4. The canonical contract/logic layer: Top, Bottom, one Null, Intersection,
   Difference, Optional removal, effective Match remainders, and Pure exact
   region-to-result logical normalization, including guard/`~` lowering and host
   ingress. `Rest` is only the running remainder calculation, not a node.
5. Retained expanded evidence and obligations. Durable `E` remains alongside the
   distinct accepted region, result contract, obligations, and canonical `C`.
   Branch-local Match regions can encode the correlated partial mapping without an
   always-present function-domain field. The Number algebra may erase a call from
   `C`; known calls may discharge during preparation, while unresolved outer
   references retain obligations for a later boundary. Failure never selects a
   different canonical form.
6. Source-to-form lowering above the canonical `Lambda` API.
7. Recursive environments whose members require different reference layouts or
   projections.
8. Computed call targets (such as Apply-of-Apply or Match-produced functions),
   Record traversal, non-Numeric result contracts, and function-level Combine arms.

Do not infer the probe's `Term`/`Poly` representation, `Landing` node, two-form
`CallArgument`, `Fn(form, group)`, or a separate recursive identity mechanism from
older probe documents. The probe's particular node representation is not part of
the landed design.

The existing matcher is the settled rule engine. Preparation rules structurally
inspect durable `E`; runtime bare contract patterns retain fulfilment semantics. A
runtime match given `C` never recovers erased source operands from retained `E`.
The precise source data/pattern preparation boundary remains to be pinned with
lowering.

*End of handover.*
