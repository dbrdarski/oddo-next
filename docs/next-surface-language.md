# NEXT — Current Surface Language Specification
## Reference surface for `oddo.next`

**Status:** Working current-state specification for implementation and review
**Date:** 2026-09-01
**Purpose:** Define the full NEXT source-language surface for the new JavaScript implementation, **`oddo.next`**, without importing stale analyzer machinery or historical Oddo semantics.
**Primary language source:** the Rust reference implementation and normative specifications in `dbrdarski/next`.

---

## 0. Authority and resolution policy

This document is a reconstruction of the current NEXT language. It is not a new language-design proposal.

Authority order:

1. **Current `dbrdarski/next` repository (`main`)** — the primary reference implementation and repository source for the current language.
2. **Later explicit author rulings** where they supersede repository text or an older implementation snapshot. Current overrides are listed in section 0.2.
3. **Normative NEXT documents in the Rust repository**, in the repository's own order:
   - `next-design-compendium-v1-0.md` — design intent;
   - `next-grammar-specification-v0-1.md` — what parses;
   - `next-kernel-ast-specification-v0-1.md` — post-parse node inventory/desugaring;
   - `next-semantics-companion-v0-1.md` — execution semantics.
4. **The concrete Rust lexer/parser/desugar/oracle/tests** as the executable realization of that design. An implementation limitation does not become language law when the normative design says otherwise.
5. **`oddo.next`** — the new JavaScript reimplementation and principal consumer of this specification. It may use different internal machinery, but it must implement NEXT semantics rather than redefine the language accidentally.
6. **`dbrdarski/oddo`** — historical predecessor only and the lowest-priority context source. Oddo may explain surviving syntax or ergonomics, but it never overrides NEXT.

The live public Rust repository describes itself as the NEXT reference implementation and states that the language design is fixed in its normative specifications. The repository also identifies the oracle interpreter as the truth source for execution and contract-rule testing.

### 0.1 Resolution rules

- Later explicit author rulings override earlier proposals and stale implementation snapshots.
- A current Rust implementation behavior wins over an older external consolidation unless a later author ruling supersedes it.
- A parser convenience is not automatically semantic language law.
- Deliberately open or fenced items remain open/fenced.
- `oddo.next` should implement the language, not preserve accidental limitations of either Rust or JavaScript host machinery.
- Original Oddo behavior is informative only when NEXT explicitly retained it.

### 0.2 Current superseding corrections

The following are current:

- The hask marker is **`#`**.
- Pattern matching is **`expr :: { ... }`**; there is no `match` keyword.
- Blocks use `when ... => ...` and `=> ...` exits; there is no NEXT `if` or `return`.
- Record patterns are exact by default; `..._` / `...name` explicitly open them.
- `?.` is one-step total access.
- Modules are namespace constructs, not Records.
- `where` is a name-level verified static assertion.
- The first arm-level `=>` delimits the arm result.
- Match arms require a pattern; guard-only `when` arms belong to Blocks.
- Blocks are valid arm and block-exit results.
- `@effect` means external-world Effect.
- `@reactive` is the reactive observer.
- `@mutable` and `@state` are distinct non-reactive/reactive state declarations.
- **CURRENT AUTHOR OVERRIDE:** `+` is numeric addition; **`++` is concatenation**. `++` is not postfix increment.
- `--` remains absent.

### 0.3 `oddo.next` implementation role

`oddo.next` is the JavaScript reimplementation this specification is intended to guide.

The implementation is free to choose JavaScript-specific internal representations for:

- interned values;
- contracts;
- Enum-like contract constructors;
- analyzer facts;
- caches;
- proof certificates.

Those representations are not NEXT syntax.

In particular, JavaScript implementation forms such as:

```text
instanceof
$
Enum(...)
internal seat/result declarations
```

must not leak into the NEXT surface merely because they are useful to implement `oddo.next`.

---

# 1. Surface doctrine

## 1.1 Semantics over form

The semantic language is primary; this is the one official source projection.

The parser must preserve enough syntax to analyze correctly, but syntax must not create a second semantic system.

## 1.2 Zero reserved words

NEXT has **zero reserved words**.

The following are ordinary identifiers lexically and become contextual only in defined syntactic seats:

```text
module
import
export
from
when
where
```

The values:

```text
true
false
null
```

are predeclared prelude bindings, not keywords.

The following do **not** exist as language words:

```text
match
if
return
case
```

`@`-prefixed names occupy a separate privileged namespace and cannot collide with ordinary identifiers.

## 1.3 Identifiers

```ebnf
IDENT := IdentStart { IdentPart }
```

- Source is Unicode.
- Identifier classes are Unicode identifier classes.
- `_` is excluded from ordinary identifiers because it is reserved for wildcard/hask-hole syntax.
- `$` is excluded from ordinary identifiers because it is reserved to template interpolation.
- `_` and `_n` are special hole/wildcard token forms, not ordinary names.
- `_n` uses decimal `n >= 1`.

The old Rust lexer approximated Unicode XID using host character predicates. That is an implementation shortcut, not the language definition.

---

# 2. Layout, lines, comments, separators

## 2.1 Blocks and statement discipline

Blocks are brace-delimited.

```next
{
  ...
}
```

Rules:

- One statement per line.
- No semicolons.
- Newlines and whitespace are otherwise lexer-skipped.
- Expressions continue greedily across lines.
- A statement must begin on a line after the final token of the preceding statement.
- Match arms and block exit arms begin on new lines.
- Multi-line expressions and pipelines require no continuation marker.

Known greedy-continuation example:

```next
x = a
- b
```

is parsed as:

```next
x = a - b
```

not as two statements.

## 2.2 Comments

```next
// line comment

/* block comment */

/// reserved for documentation comments
```

Block comments do not nest.

The format of `///` documentation is tooling territory and remains outside this surface spec.

## 2.3 Commas

Commas are separators only.

They separate:

- tuple elements,
- record fields,
- parameters,
- call arguments,
- contract lists where applicable.

Trailing commas are allowed in comma-separated forms.

There is no comma operator.

---

# 3. Literals

## 3.1 Numbers

Number literals use JS-like spelling but denote exact NEXT numbers rather than IEEE floating-point values.

Accepted forms include:

```next
0
42
.5
5.0
1e-2
0xff
0o755
0b1010
1_000_000
```

Semantic rule:

```next
1e-2
```

denotes the exact rational `1/100`.

Rejected:

```next
123n   // no BigInt suffix
017    // no legacy octal / leading-zero form
5.     // no trailing-dot numeral
```

`1/3` is ordinary division syntax, not a special fraction literal.

NEXT's number model does not include JS `NaN`, `Infinity`, or signed `-0`.

## 3.2 Strings

Ordinary string literals use double quotes only:

```next
"hello"
```

They are single-line.

Single-quoted strings are not part of the language.

The escape set follows the settled JS-style set, including:

```text
\n \t \r \0 \b \f \v \\ \" \' \xHH \uXXXX \u{...}
```

String storage semantics are UTF-16.

## 3.3 Templates

Backticks denote template strings:

```next
`Hello ${name}`
```

Templates:

- may span lines,
- support `${expr}` interpolation,
- are brace-depth aware,
- support template escapes including escaped backticks and `\${`.

Interpolation is total: every NEXT value has a defined interpolation rendering.

Raw strings are absent.

Tagged templates are rejected for v1.

---

# 4. Token and operator inventory

The active punctuation/operator inventory is:

```text
=>   ::   |>   <|   #   ?   :   ??   ||   &&   ==   !=
<=   >=   <   >    +   ++  -    *    /    %    **   !    ~
.    ?.   ...      [   ]   (    )    {    }    ,    =
@    ^    |        :=
+:=  -:=  *:=      /:= %:= **:= &&:= ||:= ??:=
```

Tokenization uses maximal munch.

Special lexical rules:

1. `?.` is not formed before a decimal digit, preserving forms such as `.5`.
2. `...` wins over shorter dot sequences.
3. compound mutation operators are single tokens.
4. `++` is a binary concatenation token, never postfix increment.

---

# 5. Operator precedence

Loosest to tightest:

| Tier | Form | Operators | Associativity |
|---:|---|---|---|
| 1 | Arrow | `=>` | right |
| 2 | Match | `::` | special |
| 3 | Pipes | `|>` / `<|` | `|>` left, `<|` right |
| 4 | Hask | `#` | prefix |
| 5 | Conditional | `? :` | right |
| 6 | Default / OR | `??` / `||` | left, shared tier |
| 7 | AND | `&&` | left |
| 8 | Equality | `==` / `!=` | left |
| 9 | Relational | `< <= > >=` | left |
| 10 | Additive / concatenation | `+ - ++` | left |
| 11 | Multiplicative | `* / %` | left |
| 12 | Unary | `- ! ~` | prefix |
| 13 | Exponent | `**` | right |
| 14 | Postfix | `. ?. [ ] ?.[ ] call()` | left chain |

## 5.1 Important precedence rules

### Match

```next
a |> b :: {
  ...
}
```

means:

```text
(a |> b) :: { ... }
```

A completed match may itself feed a pipe:

```next
x :: {
  ...
}
|> f
```

### Pipes

```next
x |> f
```

means application of `f` to `x`.

```next
f <| x
```

means application of `f` to `x`.

There is no argument-insertion rule.

Unparenthesized mixing is illegal:

```next
a |> f <| b
```

must be rejected.

### Hask reach

`#` reaches through tighter expression tiers but stops at pipes and match.

```next
# _ * 2
```

means a function whose body is `_ * 2`.

To include a pipe or match in a hask body, group it:

```next
#(_ |> f)

#(_ :: {
  ...
})
```

Immediate invocation also requires grouping:

```next
(# f(_))(x)
```

### Defaulting

`??` and `||` share one left-associative tier:

```next
a ?? b || c
```

means:

```text
(a ?? b) || c
```

### Exponent

Python-style unary/exponent interaction:

```next
-x ** 2
```

means:

```text
-(x ** 2)
```

The exponent may itself be unary:

```next
2 ** -3
```

### Relational chains

```next
a < b < c
```

parses but is semantically rejected: the first comparison yields Boolean, which cannot stand in the next relational operand seat.

The intended spelling is:

```next
a < b && b < c
```

---

# 6. Addition and concatenation — current author ruling

The older recovered surface used `+` for both Number addition and String concatenation. That rule is superseded.

Current surface:

```next
1 + 2
"a" ++ "b"
```

Rules:

- `+` is numeric addition.
- `++` is concatenation.
- `++` is a binary expression operator, not postfix mutation.
- `--` is not a NEXT operator.
- The parser must preserve `+` and `++` as distinct surface operations.
- The Analyzer must apply the corresponding operation contracts; it must not recover the old overloaded-`+` model.

This specification places `++` on the additive precedence tier with `+` and `-`, matching the role formerly occupied by String concatenation in the recovered expression grammar. If the current Rust `main` parser has a later explicit precedence placement, that implementation is authoritative and this table must be synchronized to it.

The surface `++` operator must not be confused with a contract-algebra constructor named `Concat(...)`: the latter may describe tuple/sequence contract composition and is a semantic contract constructor, not automatically the String operator.

---

# 7. Statements and bindings

## 7.1 Core statement forms

```ebnf
Statement :=
    Binding
  / ExpressionStatement
  / ImportStatement
  / ExportStatement
  / AtDeclaration
  / MutationStatement
  / WhereClause

BlockStatement := Statement / ArmStatement
```

`ArmStatement` is available only inside a Block.

## 7.2 Immutable binding

```next
name = expression
```

`=` is statement-only.

There is no assignment expression.

Binding targets may be:

- a name,
- an irrefutable tuple pattern,
- an irrefutable record pattern.

Examples:

```next
x = 10

[a, b] = pair

{ name, position: [x, y] } = user
```

Destructuring bindings must be proven irrefutable for the source contract.

## 7.3 Expression statement

Any expression may be a statement.

A pure expression whose value goes nowhere is legal but linted.

Act calls are ordinary statements in worlds where they are legal.

---

# 8. Functions and calls

## 8.1 Function form

Arrow functions are the only function form.

```next
double = value => value * 2

add = (left, right) => left + right
```

There is:

- no `function` keyword,
- no method syntax,
- no implicit receiver,
- no `rec` marker.

Named functions are ordinary immutable bindings whose value is a function.

## 8.2 Recursion and late binding

Direct and mutual recursion require no special syntax.

Function bodies are late-bound in the established lexical model.

Nested functions are ordinary local bindings.

## 8.3 First-class functions

Functions may be:

- stored,
- passed,
- returned,
- captured,
- placed in tuples and records.

## 8.4 No implicit currying

An incomplete call does not create a function.

```next
add(1)
```

is invalid if `add` requires two arguments.

Currying is explicit:

```next
add = a =>
  b => a + b
```

or expressed through a hask.

## 8.5 Parameters

Parameters may be:

```next
x => ...

(a, b) => ...

([x, y], { name }) => ...

(first, ...rest) => ...
```

Rules:

- rest parameter is final,
- rest receives an ordinary Tuple,
- destructuring may nest,
- introduced names are fresh local bindings,
- duplicate names in one parameter scope are invalid,
- pins are not allowed in parameters,
- named arguments are rejected,
- default parameters are rejected.

Literal parameter patterns such as:

```next
(0) => ...
```

are not part of the current official grammar. Their future admission remains deliberately unfinalized.

## 8.6 Calls and spreads

```next
f(a, b)

f(a, ...xs, b, ...ys)
```

Multiple spreads may mix with ordinary arguments.

Arguments and spread operands evaluate left-to-right.

---

# 9. Hasks

A hask converts an expression containing holes into a function.

The final marker is:

```text
#
```

Examples:

```next
# _ * 2

# f(_, config)

# operation(_2, _, _1)
```

## 9.1 Hole forms

```text
_
_1
_2
...
```

- `_n` denotes generated parameter position `n`.
- Repeated `_n` reuses the same parameter.
- Plain `_` introduces a distinct parameter.
- Indexed and plain holes may mix.
- Explicit indexes reserve their positions.
- Plain holes fill remaining positions in source order.
- Fixed indexes must be dense.

## 9.2 Rest holes

```next
# target(..._1)

# target(_1, ..._2)

# compareSequences([..._1], [..._1])
```

Rules:

- `..._n` denotes the variadic suffix beginning at generated argument position `n`.
- `..._` begins after all fixed generated parameters.
- A hask has at most one distinct rest suffix.
- The same rest suffix may be expanded multiple times.
- A fixed hole may not name a position owned by the rest suffix.

## 9.3 Nested hasks

Nested `#` starts a fresh numbering scope.

## 9.4 Hask escape from arm patterns

Inside an arm block nested in a hask:

```text
^_
^_n
```

refers one level outward to the enclosing hask arguments.

Pattern-position `_` is always wildcard; expression-position `_` is a hask hole.

---

# 10. Tuples

Tuples are immutable ordered structures written with square brackets.

```next
[]

[1]

[1, 2]

[1, ...middle, 4]
```

Rules:

- comma-separated,
- trailing comma allowed,
- middle spreads allowed,
- no elision holes.

The public structure and its standard module are both named **Tuple**.

There is no List/Array split in the current surface.

---

# 11. Records

Records are immutable named-field structures.

```next
{
  name: "Dane",
  age: 40,
}
```

Shorthand:

```next
{ name, age }
```

Computed key:

```next
{ [key]: value }
```

Spread:

```next
{
  ...base,
  name: "new",
}
```

Rules:

- field order does not participate in value identity,
- trailing comma allowed,
- literal-literal duplicate keys are compile errors,
- spread overlap is allowed,
- later spread/field values win,
- computed keys require the analyzer to prove a finite String key set,
- arbitrary map/dictionary semantics are not implied.

Placing a state binding in a Record or Tuple stores its **current content value**, not the mutable location.

---

# 12. Braces: Record vs Block

`{}` is always the empty Record in ordinary expression/function-arrow position.

Therefore:

```next
x => {}
```

returns the empty Record.

For non-empty braces after `=>`, the first-token shape distinguishes Record from Block.

A `{` begins a Record when the contents begin with a record field shape such as:

- `}`,
- `name:`,
- shorthand `name` followed by `,` or `}`,
- `[expr]:`,
- `...expr`.

Otherwise it is a Block.

### Privileged declaration exception

Inside an `@` declaration's arrow body, braces always mean a **Block**:

```next
@effect f = () => {}
```

is an empty effect body, not a function returning `{}`.

---

# 13. Access

## 13.1 Plain access

```next
record.field
tuple[index]
record[key]
```

Plain access is a **demanding** operation:

- receiver must be non-null,
- field must be present,
- index/key must be provably valid.

Failure to prove safety is a compile-time error.

Dot lookup carries no receiver context and creates no method call.

```next
math.double(5)
```

means:

1. read field `double`,
2. obtain a function value,
3. call it with `5`.

`math` is not passed implicitly.

## 13.2 Total `?.` access

```next
value?.field
value?.[index]
```

This is a **one-step** total access.

At that one hop:

- null receiver -> `null`,
- absent field/index -> `null`,
- successful access -> field/element value.

It does not automatically shield later hops.

```next
a?.b.c
```

is grammatically valid, but if `a?.b` may yield `null`, `.c` must independently prove a non-null receiver.

The operation intentionally collapses:

```text
missing
present-with-null
```

to the same result `null`.

A future presence-preserving lookup is outside the current surface.

---

# 14. Slicing and splicing

`...` is the unified plurality glyph.

Inside access brackets it denotes a slice.

```next
t[a...b]
t[...b]
t[a...]
t[...]
```

Slice semantics:

- half-open `[a, b)`,
- omitted lower bound = start,
- omitted upper bound = end,
- negative bounds count from the end,
- bounds are clamped,
- slices are total,
- identity slice `t[...]` is legal.

Mutation world additionally permits splice replacement:

```next
items[a...b] := replacement
```

The same surface applies to strings with string-specific indexing semantics.

---

# 15. Strings as indexed structures

Default String indexing, slicing, and length operate on **grapheme clusters**.

```next
s[i]
s[a...b]
String.length(s)
```

A String index yields a one-grapheme String; there is no `Char` value kind.

Explicit lower-level views are available through the String module:

```next
String.units(s)
String.points(s)
```

Conceptually:

- `units` exposes UTF-16 code units,
- `points` exposes Unicode code points.

Unicode segmentation tables are version-pinned by the language/runtime version.

---

# 16. Pattern grammar

Patterns are shared across:

- match arms,
- destructuring bindings,
- function parameters,

with scoped restrictions.

Core forms:

```text
literal
binding
_
tuple pattern
record pattern
nested pattern
contract pattern
rest pattern
alternation
pin
```

## 16.1 Literal patterns

Examples:

```next
0
-1
"ready"
true
false
null
```

`true`, `false`, and `null` resolve as prelude constants.

## 16.2 Binding and wildcard

```next
item
_
```

A bare identifier in ordinary pattern position creates a fresh binding.

`_` ignores the matched value.

## 16.3 Tuple patterns

```next
[]

[x]

[x, y]

[first, ...rest]

[first, ..._, last]
```

Patterns are exact by default.

A rest opens the pattern.

At most one rest exists per pattern level.

Middle rests are legal.

## 16.4 Record patterns

```next
{ name, age }

{ name, ..._ }

{ name, ...rest }
```

Record patterns are **exact by default**.

Use:

```next
..._
```

to allow and ignore remaining fields.

Use:

```next
...rest
```

to allow and capture remaining fields.

This supersedes the older design phase where record patterns were open by default.

## 16.5 Nested patterns

Patterns compose recursively:

```next
{
  user: {
    name,
    position: [x, y],
  },
}
```

## 16.6 Pins

Arm patterns may use:

```next
^name
```

to compare against an existing binding.

Pins are not allowed in function parameters.

## 16.7 Pattern alternatives

```next
p1 | p2 | p3
```

Alternatives are allowed for arbitrary patterns but are binding-free.

They may contain wildcard/rest-wildcard/pin forms but not introduce named captures whose binding identity would differ across alternatives.

## 16.8 Contract patterns

A capitalized pattern identifier is interpreted as a contract pattern and must resolve to a contract.

Example:

```next
value :: {
  Number => ...
  Failure => ...
  _ => ...
}
```

Capitalization is convention elsewhere; in pattern classification it has this syntactic role.

Constructed contract expressions are ordinary expressions outside pattern-name syntax.

---

# 17. Match

There is no `match` keyword.

Match is:

```next
value :: {
  pattern => expression
  pattern when guard => expression
  _ => expression
}
```

Rules:

- arms are ordered top-to-bottom,
- one arm begins per line,
- every arm requires a pattern,
- pattern is tested before guard,
- the first arm-level `=>` delimits the result,
- an arrow inside a guard must therefore be nested inside a grouped expression,
- an arm result may be an expression or a Block,
- guards are pure,
- match is expression-oriented,
- coverage is statically analyzed,
- unreachable arms are statically detectable,
- later arms receive the exact remainder not consumed by earlier arms.

The right side of `::` is exactly one arm block.

Arm blocks are syntax attached to `::`; they are not first-class values.

---

# 18. Blocks and exits

NEXT has no `return` and no `if`.

A block uses exit arms:

```next
{
  x = compute()

  when x < 0 => "negative"
  when x > 0 => "positive"
  => "zero"
}
```

Forms:

```next
when condition => expression
=> expression
```

`_ => expression` is accepted but redundant.

An exit result may be an expression or a Block.

A block can interleave:

- bindings,
- ordinary statements,
- guarded exits,
- unconditional exits.

A block is semantically the same control family as Match, with no explicit scrutinee.

Pure value-producing blocks may be partial; incompleteness matters when their result is consumed by a seat that demands a value.

Mutator/Effect blocks have no ordinary value-coverage requirement.

---

# 19. Conditionals, Boolean operators, truthiness

## 19.1 Ternary

```next
condition ? thenExpr : elseExpr
```

The condition is a strict Boolean-tested seat.

## 19.2 Boolean operators

```next
a && b
a || b
!a
```

Their tested operands require Boolean by default.

## 19.3 Truthiness classification

The language-wide classification is:

```text
falsy  = false, null
truthy = every other value
```

In particular:

```text
0
""
[]
{}
```

are truthy.

## 19.4 Seat loosener `~`

`~` loosens a tested seat without converting the value.

Examples:

```next
~value || fallback

~value && next

!~value
```

`!~value` is the explicit falsiness test.

## 19.5 Null defaulting

```next
a ?? b
```

selects `b` only when `a` is `null`.

Therefore it differs from:

```next
~a || b
```

on `false`.

---

# 20. Equality

```next
a == b
a != b
```

are value equality/inequality.

There is:

- no `===`,
- no `!==`,
- no reference-equality operator,
- no observable reference identity.

Canonicalization/interning may make equality cheap internally, but this is not exposed as a distinct surface concept.

`instanceof` is not a NEXT surface operator. Its use in the JS demonstrator is implementation machinery for contract membership.

---

# 21. Contracts

Contracts are ordinary statically evaluated values/expressions in the language surface.

Prelude contract constructors include forms such as:

```next
Range(0, 100)
Mod(2, 0)
Equals(42)
Union(Number, String)
Difference(A, B)
HasField("name")
Geo(base, ratio)
```

The set evolves with the contract algebra, but they are ordinary prelude names rather than keywords.

Named contracts are ordinary bindings:

```next
Percent = Range(0, 100)
```

Capitalization is convention, not general language law.

Constructed contract expressions are valid:

```next
Union(Number, Equals(42))
```

A literal value in a contract-valued position is invalid only when the semantic consumer requires a contract; that is an Analyzer concern, not a reason to harden the raw JS demonstrator API.

## 21.1 Contract syntax and `oddo.next`

The **Rust NEXT contract system and normative contract specifications** are the language-semantic source for contract representation and composition.

`oddo.next` is the JavaScript reimplementation of those semantics. Its internal implementation may differ.

The NEXT surface remains ordinary expression syntax:

```next
Union(Number, Equals(42))
```

The parser must not reproduce JavaScript implementation machinery such as `instanceof`, `$`, `Enum(...)`, or internal seat/result declaration syntax. Those are implementation-building blocks, not NEXT source syntax.

---

# 22. `where`

`where` is a name-level static signature assertion.

Surface:

```next
name where (InputContract) => ReturnContract
```

For a multi-parameter argument tuple:

```next
name where (A, B) => R
```

It is:

- optional,
- static,
- verified rather than trusted,
- documentation/assertion of inferred behavior,
- not a runtime branch,
- not an enforcement mode,
- not a function-entry guard.

A body `when` changes the function's actual domain; `where` does not.

Function-entry `where` forms are rejected.

---

# 23. `conform`

`conform` is a language/prelude boundary operation, not dedicated parser syntax.

It accepts a declared Shape plus defaults/rules and produces a stable contract result including `Failure`.

The parser treats `conform(...)` as ordinary application.

Surface-specific consequences:

- nullable means a field contract includes `Null`,
- shape presence is not made optional,
- resulting records are full-keyed,
- Failure is ordinary data handled through Match/contract patterns.

The exact userland rule-configuration API belongs to its feature specification rather than the core grammar.

---

# 24. Modules

Modules are namespace constructs, **not Records**.

A module contains bindings; those bindings may be immutable or state locations.

## 24.1 Module header

```next
module Name
```

Dotted names are legal:

```next
module Geometry.Transform
```

The header:

- must be the first statement,
- is required iff the file exports anything,
- names the module independently of filesystem path,
- allows one module per file.

A file with no exports has no required module header and is unimportable as a module.

## 24.2 Imports

Selected bindings:

```next
import { count, increment } from Counter
```

Bare module import/namespace binding is part of the official grammar:

```next
import Counter
```

Imports are static.

Imported state bindings remain live reads of the originating state binding.

`from` accepts a module name, never a path or arbitrary expression.

Rejected:

```text
import * as
path imports
dynamic import syntax
```

## 24.3 Exports

```next
export name = value
```

`export` prefixes a binding.

There are:

- no default exports,
- no export lists,
- no `@` exports.

## 24.4 Module aliases

Module references may be aliased through ordinary binding:

```next
m = Counter
m.count
```

The alias resolves the same namespace binding.

## 24.5 Module spread into Records

```next
Geo2 = {
  ...Geometry,
  describe,
}
```

reads module bindings at spread time and constructs an ordinary Record.

For state bindings, the content value is read; the mutable location is never inserted into the Record.

## 24.6 Deliberate module opens

Still open:

- whether dotted module names eventually imply nesting semantics or remain pure names,
- modules in true value seats and module equality.

These are not parser blockers: dotted module-name grammar is already defined.

---

# 25. State and privileged `@` declarations

`@` marks privileged language operations.

Rules:

- `@` names are unshadowable,
- preloaded,
- spec-closed,
- not user-definable,
- not exportable,
- declaration forms are statements, never expressions.

Generic parser shape:

```next
@resident binding
```

or for the specifically allowed anonymous reactive form:

```next
@reactive () => {
  ...
}
```

Value-side modifier syntax does not exist:

```next
name = @effect (...) => ...
```

is invalid.

## 25.1 Current resident inventory

Current declared inventory:

```text
@state
@mutable
@mutate
@effect
@computed
@reactive
```

Some statutes remain fenced/parked, but these names are the current resident family.

## 25.2 State declarations

```next
@state x = initial

@mutable cache = initial
```

Both create mutable binding locations.

Difference:

- `@state` participates in reactive scheduling,
- `@mutable` is non-reactive.

Their value references read current immutable content.

Exact default-mutator spelling remains parked.

## 25.3 Mutators

```next
@mutate update = args => {
  state := value
}
```

More generally:

```next
@mutate update = (a, b) => {
  x := ...
  y.path := ...
}
```

Mutators are synchronous transactional mutation-world functions.

`:=` and compound mutation forms exist only in mutation world.

## 25.4 Effects

```next
@effect load = args => {
  ...
}
```

Effects are the external-world act kind.

`@effect` is **not** the reactive observer.

## 25.5 Reactive forms

`@reactive` is the reactive observer modifier.

`@computed` is the reactive pure-derivation resident.

The reactive scheduling/lifecycle layer remains fenced; this surface specification records the names and the already-ruled declaration doctrine but does not invent missing lifecycle statutes.

---

# 26. Mutation syntax

Mutation is statement-only and legal only in mutation world.

```ebnf
MutationStatement := Path MutOp Expression
```

Operators:

```text
:=
+:=
-:=
*:=
/:=
%:=
**:=
&&:=
||:=
??:=
```

Examples:

```next
count := count + 1

count +:= 1

user.name := newName

items[a...b] := replacement
```

There is no postfix mutation.

```next
x++
```

is invalid **as postfix mutation**.

This does not conflict with binary concatenation:

```next
"a" ++ "b"
```

which is valid.

There is no assignment-in-expression.

---

# 27. Rejected surface forms

The following are explicitly outside the current language or outside the stated use of an otherwise-valid token:

```text
if
return
match
case
loops
break
continue

function declarations
methods / implicit receivers
implicit partial application
named arguments
default arguments
parameter pins

bitwise operators
postfix increment/decrement (`x++`, `x--`)
postfix mutation
=== / !==
reference equality
in
instanceof
typeof
new
delete
void
await
yield
unary +
comma operator
assignment expressions

BigInt n suffix
legacy octal
trailing-dot numeric literals
NaN / Infinity / -0 semantics

single-quoted strings
raw strings
tagged templates (v1)

import * as
path imports
dynamic import syntax
module blocks

@ exports
user-defined privileged operations
```

---

# 28. Deliberately open / fenced items

These must **not** be silently filled by the parser or analyzer.

## 28.1 Open

- General shadowing policy outside the already-ruled parameter/pattern cases.
- Module values in true value seats and module equality.
- Whether dotted module names gain nesting semantics.
- Literal parameter patterns (currently absent from grammar; likely excluded).
- Full Reals beyond the exact-rational current number model.
- Final umbrella terminology for privileged operations.
- Mutator return semantics: leaning toward returns, but unstamped.

## 28.2 Parked/fenced act-surface work

- exact default-mutator spelling,
- `require`-shaped entry prohibitions,
- guarded acts and per-act-kind arm semantics,
- binding-position discharge forms,
- Effect resource cleanup,
- `@suppress` / `@proof` / strict/gray-ack spellings,
- Oddo-style `@state:` block batch form,
- final resident statutes where not already ruled.

## 28.3 Fenced concurrency surface

Actor/message/thread syntax remains outside the current active surface.

---

# 29. Parser-blocking mechanical questions not actually author-ratified

The recovered language surface is substantially complete. However, the old Rust implementation log contains a few **implementation choices** that were never promoted to author-ratified language rules.

They should be resolved explicitly before calling the new parser grammar frozen.

## 29.1 Split arrow across lines

The official grammar allows whitespace/newlines to be skipped and says expressions continue greedily.

Inside a Block, this creates an ambiguity:

```next
x = n
=> x
```

Is that:

```text
x = n
=> x          // unconditional block exit
```

or does the first line continue as:

```text
x = n => x    // lambda
```

The old Rust parser **chose** to require `=>` on the same line as its function parameters, specifically to remove this ambiguity:

```next
(a, b) => body     // accepted

(a, b)
=> body            // rejected by the old parser choice
```

That choice was explicitly logged as needing author confirmation and no later confirmation was found.

### Recommended resolution

Stamp:

> **A function arrow `=>` must occur on the same source line as the closing token of its parameter form. A line-leading `=>` inside a Block is always an unconditional exit arm.**

This fits the one-statement-per-line discipline and removes the only known line-sensitive lambda/block ambiguity.

Until stamped, treat this as **RECOMMENDED, NOT YET NORMATIVE**.

## 29.2 Contextual word at ambiguous statement head

The language doctrine requires contextual words to remain ordinary identifiers outside their defined seats.

The old Rust parser admitted that some statement-head uses of names such as `import` were an unsupported ambiguity.

That is an implementation limitation, not a valid restriction on the zero-reserved-word doctrine.

### Resolved requirement

The new parser must commit to a contextual form only when its complete syntactic seat matches.

Otherwise the token remains an ordinary identifier.

Do **not** revive the old parser limitation as language law.

## 29.3 `5.foo`

The old lexer chose to tokenize:

```next
5.foo
```

as:

```text
5 . foo
```

rather than rejecting it lexically.

The grammar's trailing-dot ban only clearly rejects a dangling `5.` and does not explicitly settle this member-access spelling.

This is a minor lexical spelling question, not a semantic one.

### Recommended resolution

Allow `5.foo` as ordinary postfix access tokenization and let the Analyzer reject it if Number has no such field/module access meaning.

This keeps lexing structural rather than type-aware.

Until stamped, treat this as **RECOMMENDED, NOT YET NORMATIVE**.

---

# 30. Surface-to-Analyzer boundary for `oddo.next`

The parser should produce a faithful **surface AST**.

It should not:

- resolve names,
- classify values by contracts,
- run canonicalization,
- decide operator domains,
- manufacture Enum nodes,
- perform `sub`,
- solve expressions.

The Analyzer/canonicalizer in `oddo.next` then converts resolved surface meaning into canonical NEXT semantic values and proof obligations. The Rust implementation/specifications define the semantics; `oddo.next` chooses the JavaScript representation.

A useful invariant is:

> **After Analyzer canonicalization, parser-only distinctions and sugar no longer survive unless they are semantically observable.**

Examples of intended boundaries:

```text
source Tuple literal
    -> semantic Tuple

source Record literal
    -> semantic Record

surface contract expression
    -> canonical contract value

surface operator
    -> semantic operation selected under its contract rules

surface name
    -> resolved binding/value

surface hask
    -> ordinary function semantics before identity analysis

surface pipe
    -> application

surface match/block control
    -> the canonical control representation chosen by the new analyzer
```

Do not import the old Rust implementation's extra intermediate machinery merely because it existed.

---

# 31. Canonicalization-sensitive surface obligations

The following surface decisions materially affect the semantic constructors and therefore must be fixed before canonicalization is considered complete:

1. **`+` is Number addition; `++` is concatenation.** They are distinct surface operations.
2. `-`, `*`, `/`, `%`, `**` are numeric-family operations.
3. equality is total value equality and is distinct from contract membership.
4. `?.` is a semantic one-step total access, not mere parser sugar.
5. `...` has exactly three roles by position: spread, rest, slice.
6. Record pattern exactness/rest changes the derived contract.
7. Tuple rest/spread affects tuple-length contracts.
8. contract patterns must resolve to actual contract values.
9. `where` is assertion metadata, not a domain-changing guard.
10. `@state`/`@mutable` references are reads of locations; the location is not a value.
11. modules are namespace/binding structures, not Records.
12. source spans/provenance must not participate in canonical semantic identity.

---

# 32. Compact EBNF

The following is the active parser skeleton after the resolutions above.

```ebnf
Program        := [ModuleHeader] { Statement }

ModuleHeader   := "module" DottedName
DottedName     := IDENT { "." IDENT }

ImportStatement :=
      "import" "{" IDENT { "," IDENT } [ "," ] "}" "from" DottedName
    / "import" DottedName

ExportStatement := "export" Binding

Statement :=
      Binding
    / ExpressionStatement
    / ImportStatement
    / ExportStatement
    / AtDeclaration
    / MutationStatement
    / WhereClause

BlockStatement := Statement / ArmStatement

Binding             := BindTarget "=" Expression
BindTarget          := IDENT / TuplePattern / RecordPattern
ExpressionStatement := Expression

MutationStatement := Path MutOp Expression
Path              := IDENT { "." IDENT / "[" IndexOrSlice "]" }
MutOp             := ":=" / "+:=" / "-:=" / "*:=" / "/:=" / "%:="
                   / "**:=" / "&&:=" / "||:=" / "??:="

AtDeclaration :=
      "@" IDENT Binding
    / "@" IDENT ArrowFunction

ArmStatement :=
      "when" MatchExpr "=>" ArrowBody
    / [ "_" ] "=>" ArrowBody

WhereClause := IDENT "where" "(" [ ContractList ] ")" "=>" Expression
ContractList := Expression { "," Expression }

Expression   := ArrowExpr

ArrowExpr    := Params "=>" ArrowBody
              / MatchExpr

Params       := IDENT
              / "(" [ ParamList ] ")"

ParamList    := Param { "," Param } [ "," ]

Param        := IDENT
              / TuplePattern
              / RecordPattern
              / "..." IDENT

ArrowBody    := Expression
              / Block

Block        := "{" { BlockStatement } "}"

MatchExpr    := PipeExpr { "::" ArmBlock }

ArmBlock     := "{" Arm { Arm } "}"

Arm          := Pattern [ "when" MatchExpr ] "=>" ArrowBody

PipeExpr     := HaskExpr { ("|>" / "<|") HaskExpr }

HaskExpr     := "#" TernaryExpr
              / TernaryExpr

TernaryExpr  := NullOrExpr [ "?" TernaryExpr ":" TernaryExpr ]

NullOrExpr   := AndExpr { ("??" / "||") AndExpr }

AndExpr      := EqExpr { "&&" EqExpr }

EqExpr       := RelExpr { ("==" / "!=") RelExpr }

RelExpr      := AddExpr { ("<" / "<=" / ">" / ">=") AddExpr }

AddExpr      := MulExpr { ("+" / "-" / "++") MulExpr }

MulExpr      := UnaryExpr { ("*" / "/" / "%") UnaryExpr }

UnaryExpr    := ("-" / "!" / "~") UnaryExpr
              / PowerExpr

PowerExpr    := PostfixExpr [ "**" UnaryExpr ]

PostfixExpr  := Primary { PostfixOp }

PostfixOp    := "." IDENT
              / "?." IDENT
              / "[" IndexOrSlice "]"
              / "?." "[" Expression "]"
              / "(" [ ArgList ] ")"

IndexOrSlice := Expression
              / [ Expression ] "..." [ Expression ]

ArgList      := Arg { "," Arg } [ "," ]

Arg          := Expression
              / "..." Expression

Primary      := NUMBER
              / STRING
              / TEMPLATE
              / IDENT
              / Hole
              / "(" Expression ")"
              / "#(" Expression ")"
              / TupleLit
              / RecordLit

Hole         := "_"
              / INDEXED_HOLE

TupleLit     := "[" [ Element { "," Element } [ "," ] ] "]"

Element      := Expression
              / "..." Expression

RecordLit    := "{" [ Field { "," Field } [ "," ] ] "}"

Field        := IDENT ":" Expression
              / IDENT
              / "[" Expression "]" ":" Expression
              / "..." Expression

Pattern      := AltPattern

AltPattern   := SeqPattern { "|" SeqPattern }

SeqPattern   := LiteralPat
              / "_"
              / IDENT
              / "^" IDENT
              / "^" ("_" / INDEXED_HOLE)
              / TuplePattern
              / RecordPattern

LiteralPat   := NUMBER
              / STRING
              / "-" NUMBER
              / PRELUDE_CONST

TuplePattern := "[" [ PatElem { "," PatElem } [ "," ] ] "]"

PatElem      := Pattern
              / Rest

RecordPattern := "{" [ PatField { "," PatField } [ "," ] ] "}"

PatField     := IDENT [ ":" Pattern ]
              / Rest

Rest         := "..." "_"
              / "..." IDENT
```

Semantic classification supplements this grammar:

- a capitalized pattern identifier must resolve to a contract and becomes a contract pattern;
- `true` / `false` / `null` resolve as prelude constants;
- one rest per pattern level;
- alternations are binding-free;
- pins/hask escapes are arm-only;
- destructuring bindings/parameters require their allowed pattern restrictions;
- mixed `|>` / `<|` chains without parentheses are rejected;
- hole forms outside hask reach are rejected;
- `@` resident inventory is closed;
- statement and arm line rules are enforced.

---

# 33. Current implementation notes for `oddo.next`

The core surface is sufficiently specified to implement a faithful JavaScript parser/analyzer.

## 33.1 Concatenation is settled

Current author ruling:

```next
1 + 2
"a" ++ "b"
```

`+` and `++` are distinct semantic operations.

The older recovered rule that used `+` for String concatenation is historical and must not be reintroduced into `oddo.next`.

## 33.2 Same-line function arrow

The supplied Rust parser snapshot resolves the block-exit/lambda ambiguity by requiring the function `=>` to occur on the same source line as the closing token of the parameter form:

```next
(a, b) => body
```

versus a line-leading block exit:

```next
{
  x = n
  => x
}
```

Treat the current Rust `main` parser as authoritative for this mechanical rule.

## 33.3 Structural lexing of forms such as `5.foo`

Lexing should remain structural rather than type-aware. A spelling may be syntactically recognized even when the Analyzer later rejects the operation for the receiver contract.

---

# 34. `oddo.next` implementation target

`oddo.next` should implement this pipeline conceptually:

```text
NEXT source
    ↓
surface AST
    ↓
name / scope resolution
    ↓
surface desugaring
    ↓
canonical NEXT values and operations
    ↓
contract resolution / membership / subcontract
    ↓
demand-driven analyzer facts
```

Important boundary:

> **The JavaScript implementation should reproduce NEXT semantics, not the old Rust implementation architecture.**

The Rust code is authoritative evidence for the language and for executable behavior, but analyzer mechanisms that existed only to make that implementation work are not automatically part of the semantic model.

For the current contract-system rewrite, the companion design record:

```text
next-demand-stopping-contract-resolution-v0-1.md
```

captures the newer demand-stopping/result-producer/match-local-substitution rules discussed after the older Rust analyzer architecture. It is a contract-resolution companion, not additional surface syntax.

---

# 35. Relationship to original Oddo — historical context only

Original Oddo (`dbrdarski/oddo`) is NEXT's predecessor and has the lowest authority in this specification.

Oddo is useful for understanding syntax and ergonomic lineage. Surviving or transformed ideas include:

```next
x = value
f = x => x * 2

@state count = 0

@mutate increment = () => {
  count := count + 1
}
```

and the general family of:

```text
@state
@computed
@mutate
```

However, Oddo must **not** be imported wholesale.

Important non-transfers / transformations:

- Oddo compiled to JavaScript; NEXT has its own exact immutable value semantics.
- Oddo examples use `return`; NEXT does not. NEXT blocks use `when ... => ...` and `=> ...` exits.
- Oddo's UI/JSX surface is not part of the NEXT core language defined here.
- Oddo's historical `@effect` was reactive-side-effect terminology. In NEXT, **`@effect` is the external-world Effect act-kind**, while **`@reactive` is the reactive observer**.
- JavaScript identity/equality/coercion behavior from Oddo does not define NEXT.
- Oddo parser limitations or conveniences cannot override current NEXT grammar.

Oddo should therefore be used only to answer questions of lineage such as "why does this syntax exist?" when the current NEXT repository does not already settle the matter.

---

# 36. Compact authority summary for implementers

When implementing `oddo.next`, resolve conflicts in this order:

```text
later explicit author ruling
    ↓
current dbrdarski/next main implementation + current normative NEXT specs
    ↓
repository tests / oracle as executable evidence
    ↓
this consolidated surface handoff
    ↓
older NEXT working documents
    ↓
original Oddo historical context
```

Never reverse that order merely because an older document is more detailed.

---

*End of NEXT Current Surface Language Specification — `oddo.next` implementation handoff, 2026-09-01.*
