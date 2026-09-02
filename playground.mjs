// ==========================================
// Browser Playground
// ==========================================

import { EditorView, minimalSetup } from 'codemirror'
import { indentWithTab } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'
import { Decoration, keymap, ViewPlugin } from '@codemirror/view'

// Everything the modules export is in scope of the evaluated code, so the
// playground speaks the same language as the source: Tuple, Record, the
// enum factories, contracts, matching, and the facts store.

import * as intern from './src/intern.mjs'
import * as contract from './src/contract.mjs'
import * as facts from './src/facts.mjs'
import * as enums from './src/enum.mjs'
import * as numeric from './src/numeric.mjs'
import * as domain from './src/domain.mjs'
import * as matching from './src/match.mjs'
import * as canonicalization from './src/canonical.mjs'
import * as functions from './src/function.mjs'
import { parseCst, buildSurfaceAst } from './src/parser/index.mjs'

const api = {
  ...intern, ...contract, ...facts, ...enums, ...numeric,
  ...domain, ...matching, ...canonicalization, ...functions,
}

// Keep the complete language API available to the browser console without
// overwriting window globals such as Number.
window.oddo = api

const names = Object.keys(api)
const values = Object.values(api)

const examples = [
  {
    name: 'Interning',
    code: `const a = Tuple(1, 2)
const b = Tuple(1, 2)
log('same tuple:', a === b)

const r = Record({ x: a, tag: "point" })
log('key order free:', r === Record({ tag: "point", x: Tuple(1, 2) }))`,
  },
  {
    name: 'Enum nodes',
    code: `const n = Add(Numeric(1), Add(Numeric(2), Numeric(3)))
log(n)
log('interned:', n === Add(Numeric(1), Add(Numeric(2), Numeric(3))))
log('stands at Numeric seats:', fulfills(n, Numeric))
log('at a strict Number seat:', fulfills(n, Number))`,
  },
  {
    name: 'Enum canonical forms',
    code: `const inner = Add(1, 2)
const expression = Add(inner, 3)

log('expanded E:', expression)
log('inner C:', inner[Canonical])
log('outer C:', expression[Canonical])
log('Range C:', Add(Range(1, 3), Range(10, 20))[Canonical])`,
  },
  {
    name: 'Function formation',
    code: `const increment = Function(() => n => Add(n, 1))
const same = Function(() => n => Add(1, n))
const call = Apply(increment, Tuple(2))

log('function canonical:', increment === same)
log('input demands:', increment[2])
log('expanded call:', call)
log('canonical result:', call[Canonical])`,
  },
  {
    name: 'Match structural Enums',
    code: `const value = Add(1, Mul(2, 3))

const result = match(value)(
  ($, [a, b, c]) =>
    $(Add(a, Mul(b, c)))(
      (a, b, c) => [a, b, c]
    ),

  $ => $(_)(() => null)
)

log('value:', value)
log('captures:', result)
log('exact Add shape:', value.constructor === Add.kind)`,
  },
  {
    name: 'Match repeated & wildcard',
    code: `const describe = value => match(value)(
  ($, [a]) =>
    $(Add(a, a))(
      a => 'same operand: ' + a
    ),

  ($, [right]) =>
    $(Add(_, right))(
      right => 'any left, right: ' + right
    ),

  $ => $(_)(() => 'not an Add')
)

log(describe(Add(2, 2)))
log(describe(Add(2, 3)))
log(describe(Mul(2, 2)))`,
  },
  {
    name: 'Match contracts & Equals',
    code: `const exact = value => match(value)(
  ($, [right]) =>
    $(Add(Equals(1), right))(
      right => 'Add starts at 1; right: ' + right
    ),

  $ => $(_)(() => 'no exact match')
)

log(exact(Add(1, 9)))
log(exact(Add(2, 9)))

log(match(50)(
  $ => $(Range(0, 100))(
    value => 'inside range: ' + value
  )
))

const expression = Add(3, 4)
log(match(expression)(
  $ => $(Number)(value => 'strict number: ' + value),
  $ => $(Numeric)(value => 'stands at Numeric: ' + value)
))`,
  },
  {
    name: 'Match order & passthrough',
    code: `const chosen = match(3)(
  $ => $(Number)(value => 'first Number case: ' + value),
  $ => $(Number)(() => 'second Number case'),
  $ => $(_)(() => 'fallback')
)
log(chosen)

const unmatched = Mul(1, 2)
log(match(unmatched)(
  ($, [a, b]) => $(Add(a, b))(() => 'Add')
) === unmatched)`,
  },
  {
    name: 'Combine: declared order',
    code: `const expression = Add(1, 2)

const result = match(Tuple(expression, 3))(
  $ => Combine(Number, Numeric)(
    (number, numeric) => [number, numeric]
  )
)

log('source order:', Tuple(expression, 3))
log('pattern order:', result)`,
  },
  {
    name: 'Combine: overlapping contracts',
    code: `const expression = Add(1, 2)

// 3 satisfies both contracts. Taking it for Numeric first would leave
// the expression for Number, so Combine backtracks to the valid assignment.
const result = match(Tuple(3, expression))(
  $ => Combine(Numeric, Number)(
    (numeric, number) => [numeric, number]
  )
)

log('candidates:', Tuple(3, expression))
log('Numeric, Number:', result)`,
  },
  {
    name: 'Combine: generic rollback',
    code: `const result = match(Tuple(2, 3))(
  ($, [other]) => Combine(other, Equals(2))(
    (other, two) => [other, two]
  )
)

// The first attempt binds other = 2 and then fails Equals(2) against 3.
// That speculative binding is restored before the successful assignment.
log('other, exact two:', result)`,
  },
  {
    name: 'Combine: duplicates & repetition',
    code: `const exactTwos = match(Tuple(2, 2))(
  $ => Combine(Equals(2), Equals(2))(
    (first, second) => [first, second]
  )
)

const repeated = values => match(values)(
  ($, [same]) => Combine(same, same)(
    (first, second) => 'same: ' + first + ', ' + second
  ),
  $ => $(_)(() => 'different')
)

log('two occurrences:', exactTwos)
log(repeated(Tuple(2, 2)))
log(repeated(Tuple(2, 3)))`,
  },
  {
    name: 'Combine: exact Tuple cardinality',
    code: `const pair = values => match(values)(
  $ => Combine(Number, Number)(
    (first, second) => 'pair: ' + first + ', ' + second
  ),
  $ => $(_)(() => 'not exactly two Numbers')
)

log(pair(Tuple(1)))
log(pair(Tuple(1, 2)))
log(pair(Tuple(1, 2, 3)))
log('raw Array:', pair([1, 2]))`,
  },
  {
    name: 'Structural sharing',
    code: `const shared = Tuple(1, 2)
const a = Record({ left: shared, right: Tuple(3, 4) })
const b = Record({ right: Tuple(3, 4), left: Tuple(1, 2) })

// deep equality is one pointer comparison - no walking
log('whole records:', a === b)
log('children shared:', a.left === shared && b.left === shared)`,
  },
  {
    name: 'Facts & the gate',
    code: `const n = Add(1, 2)
log('raw literals pass (transparency):', String(n))
log('declared result is Numeric:', producedOf(n) === Numeric)
log('n stands at Numeric seats:', fulfills(n, Numeric))

// strict Number seats still reject what is not a literal number:
log('a box at a strict Number seat:', fulfills(Numeric(1), Number))
log('an exact contract forwards:', fulfills(Equals(6), Number))`,
  },
  {
    name: 'Facts by identity',
    code: `// the facts store is keyed by canonical references - and since
// structurally equal means pointer-equal, a fact written against
// Tuple(1, 2) is readable from ANY Tuple(1, 2)
const Label = Symbol('Label')
learn(Tuple(1, 2), Label, "origin pair")
log('read back:', fact(Tuple(1, 2), Label))
log('other tuples unaffected:', fact(Tuple(1, 3), Label) === null)`,
  },
]

const runtimeEditorRoot = document.getElementById('editor')
const output = document.getElementById('output')
const picker = document.getElementById('examples')

document.getElementById('scope').textContent =
  `⌘/Ctrl+Enter runs · Esc then Tab leaves the editor · console: window.oddo · in scope: ${names.join(', ')}`

for (const { name } of examples) picker.append(new Option(name))

const print = (text, cls) => {
  const line = document.createElement('div')
  if (cls) line.className = cls
  line.textContent = text
  output.append(line)
}

const show = (v) => {
  if (typeof v === 'function') return v.name ? `ƒ ${v.name}` : 'ƒ'
  if (v === null || typeof v !== 'object') return typeof v === 'string' ? JSON.stringify(v) : String(v)
  if (Symbol.toStringTag in v) return String(v)
  if (Array.isArray(v)) return `[${Array.from(v, show).join(', ')}]`
  return `{ ${Object.entries(v).map(([k, x]) => `${k}: ${show(x)}`).join(', ')} }`
}

// A single expression evaluates to its value; anything else runs as a body.
const compile = (code) => {
  try { return new Function(...names, 'log', `return (\n${code}\n)`) }
  catch { return new Function(...names, 'log', code) }
}

let runtimeEditor

const run = () => {
  output.textContent = ''
  const log = (...vals) => print(vals.map(v => typeof v === 'string' ? v : show(v)).join(' '))
  const original = console.log
  console.log = (...vals) => { log(...vals); original.apply(console, vals) }
  try {
    const result = compile(runtimeEditor.state.doc.toString())(...values, log)
    if (result != null) print(`→ ${show(result)}`)
  } catch (e) {
    print(String(e), 'err')
  } finally {
    console.log = original
  }
}

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    color: 'var(--foam)',
    backgroundColor: 'transparent',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'inherit',
    lineHeight: '1.6',
  },
  '.cm-content': { padding: '0.9rem 0' },
  '.cm-line': { padding: '0 1rem' },
  '.cm-gutters': {
    color: 'var(--ice)',
    backgroundColor: 'rgba(2, 62, 138, 0.24)',
    borderRight: '1px solid rgba(0, 119, 182, 0.35)',
  },
  '.cm-activeLine, .cm-activeLineGutter': {
    backgroundColor: 'rgba(0, 180, 216, 0.08)',
  },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--cyan)' },
  '&.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(0, 119, 182, 0.65)',
  },
}, { dark: true })

runtimeEditor = new EditorView({
  doc: localStorage.getItem('oddo.playground') ?? examples[0].code,
  parent: runtimeEditorRoot,
  extensions: [
    minimalSetup,
    javascript(),
    oneDark,
    editorTheme,
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({
      'aria-label': 'JavaScript code editor',
      spellcheck: 'false',
    }),
    keymap.of([
      {
        key: 'Mod-Enter',
        run: () => (run(), true),
      },
      indentWithTab,
    ]),
    EditorView.updateListener.of(update => {
      if (update.docChanged)
        localStorage.setItem('oddo.playground', update.state.doc.toString())
    }),
  ],
})

document.getElementById('run').addEventListener('click', run)
document.getElementById('clear').addEventListener('click', () => { output.textContent = '' })

picker.addEventListener('change', () => {
  runtimeEditor.dispatch({
    changes: {
      from: 0,
      to: runtimeEditor.state.doc.length,
      insert: examples[picker.selectedIndex].code,
    },
    selection: { anchor: 0 },
    scrollIntoView: true,
  })
})

// ==========================================
// NEXT Surface AST Explorer
// ==========================================

const languageExamples = [
  {
    id: 'tour',
    name: 'Language tour',
    code: `describe = value => value :: {
  0 => "zero"
  Number when value > 10 => {
    doubled = value * 2
    => { kind: "large", value: doubled }
  }
  Number => { kind: "number", value }
  _ => { kind: "other", value }
}`,
  },
  {
    id: 'functions',
    name: 'Functions, blocks & exits',
    code: `identity = value => value

calculate = ([left, right], { scale }, ...rest) => {
  total = left + right
  scaled = total * scale
  when scaled < 0 => 0
  when scaled > 100 => {
    capped = 100
    => [capped, ...rest]
  }
  => [scaled, ...rest]
}

curry = left => right => left + right`,
  },
  {
    id: 'patterns',
    name: 'Match & patterns',
    code: `classify = (value, expected, allowed) => value :: {
  -1 | 0 => "small"
  Number when allowed => "number"
  [first, ...middle, last] => [first, middle, last]
  { name, position: [x, y], ..._ } => { name, x, y }
  ^expected => "expected"
  _ => null
}

nested = packet => packet :: {
  { payload: [head, ...tail], ..._ } => head :: {
    Number => { kind: "number", value: head }
    _ => { kind: "other", value: head }
  }
  _ => null
}`,
  },
  {
    id: 'operators',
    name: 'Operators & truthiness',
    code: `operators = (a, b, c, text, fallback) => {
  arithmetic = a + b * c ** -2
  grouped = -(a + b) ** 2
  difference = a - b
  remainder = a / b % c
  message = "value: " ++ text
  defaulted = a ?? fallback || c
  strict = a == b && b != c
  ordered = a < b && b <= c || a > b && b >= c
  negated = !strict
  choice = strict ? arithmetic : grouped
  truthyOr = ~text || fallback
  truthyAnd = ~text && message
  truthyGroup = ~(text || fallback) && message
  falsy = !~text
  => {
    arithmetic,
    grouped,
    difference,
    remainder,
    message,
    defaulted,
    ordered,
    negated,
    choice,
    truthyOr,
    truthyAnd,
    truthyGroup,
    falsy,
  }
}`,
  },
  {
    id: 'hasks',
    name: 'Hasks & pipes',
    code: `double = # _ * 2
configure = # target(_2, _, _1)
variadic = # target(_1, ..._2)
pipedHask = #(_ |> normalize |> render)

pipeline = value => value |> normalize |> double
backward = value => render <| decorate <| value

matched = value => (
  value :: {
    Number => value
    _ => 0
  }
) |> double

nested = # target(_, # inner(_))

escaped = #(_ :: {
  ^_ => "same"
  _ => "different"
})`,
  },
  {
    id: 'structures',
    name: 'Structures, access & templates',
    code: `build = (first, middle, last, name, key, base) => {
  call = target(first, ...middle, last)
  tuple = [first, ...middle, last,]
  record = {
    name,
    fixed: 1,
    [key]: last,
    ...base,
  }
  empty = { tuple: [], record: {} }
  plain = record.name
  indexed = tuple[0]
  totalField = record?.missing
  totalIndex = tuple?.[1]
  middleSlice = tuple[1...-1]
  prefix = tuple[...2]
  suffix = tuple[1...]
  whole = tuple[...]
  message = \`Hello \${name}; first: \${tuple[0]}\`
  nested = \`outer \${\`inner \${last}\`}\`
  => {
    call,
    tuple,
    record,
    empty,
    plain,
    indexed,
    totalField,
    totalIndex,
    middleSlice,
    prefix,
    suffix,
    whole,
    message,
    nested,
  }
}`,
  },
  {
    id: 'modules',
    name: 'Modules, where & contracts',
    code: `module Examples.Contracts

import { Number, String, Range, Equals, Union, Difference, Mod, Geo, HasField, } from Contracts
import Tuple

Percent = Range(0, 100)
MaybeLabel = Union(Equals(null), String)
NonZero = Difference(Number, Equals(0))
Even = Mod(2, 0)
Sequence = Geo(1, 2)
Named = HasField("name")

clamp where (Number, Percent) => Percent
export clamp = (value, limit) => {
  when value < 0 => 0
  when value > limit => limit
  => value
}`,
  },
  {
    id: 'privileged',
    name: 'State, effects & mutation',
    code: `@state count = 0
@mutable cache = {}
@computed doubled = value => value * 2

@mutate update = (value, replacement) => {
  count := value
  count +:= 1
  count -:= decrement
  count *:= scale
  count /:= divisor
  count %:= modulus
  count **:= exponent
  cache.items[start...end] := replacement
  cache.ready &&:= enabled
  cache.ready ||:= fallbackReady
  cache.choice ??:= fallback
}

@effect load = () => {
  => null
}

@reactive () => {
  current = count
  => current
}`,
  },
  {
    id: 'literals',
    name: 'Literals, comments & contextual names',
    code: `/// Contextual words remain ordinary names outside their grammar seats.
module = 0
import = 0xff
export = 0o755
from = 0b1010
when = 1_000_000
where = 1e-2

/* NEXT Numbers are exact; these are still surface literals here. */
decimal = 5.0
leading = .5
truthValues = [true, false, null]
escaped = "line\\nnext"
loaded = import("source")`,
  },
]

const nextContextualSeats = {
  moduleHeader: ['Module'],
  importStatement: ['Import', 'From'],
  exportStatement: ['Export'],
  whereClause: ['Where'],
  armStatement: ['When'],
  arm: ['When'],
}

const nextStringTokens = new Set([
  'StringLiteral',
  'TemplateStart',
  'TemplateChunk',
  'TemplateEnd',
])

const nextOperatorTokens = new Set([
  'PowerMutate', 'AndMutate', 'OrMutate', 'NullishMutate',
  'PlusMutate', 'MinusMutate', 'StarMutate', 'SlashMutate',
  'PercentMutate', 'Ellipsis', 'Arrow', 'Match', 'PipeForward',
  'PipeBackward', 'OptionalDot', 'Nullish', 'Or', 'And', 'Equal',
  'NotEqual', 'LessEqual', 'GreaterEqual', 'Concat', 'Power', 'Mutate',
  'Question', 'Colon', 'Less', 'Greater', 'Plus', 'Minus', 'Star',
  'Slash', 'Percent', 'Bang', 'Tilde', 'Dot', 'Assign', 'Caret',
  'Alternative', 'InterpolationStart', 'InterpolationRCurly',
])

const nextPunctuationTokens = new Set([
  'LBracket', 'RBracket', 'LParen', 'RParen', 'LCurly', 'RCurly',
  'Comma', 'InterpolationLCurly',
])

const nextContextualTokenNames = new Set([
  'Module', 'Import', 'Export', 'From', 'When', 'Where',
])

const nextResidents = new Set([
  'state', 'mutable', 'mutate', 'effect', 'computed', 'reactive',
])

const nextConstants = new Set(['true', 'false', 'null'])
const nextCommentPattern =
  /\/\/[^\r\n\u2028\u2029]*|\/\*(?:[^*]|\*(?!\/))*(?:\*\/|$)/g

const nextSyntaxSeats = cst => {
  const contextual = new Set()
  const contractPatterns = new Set()

  const visit = node => {
    if (node?.name == null) return

    for (const key of nextContextualSeats[node.name] ?? []) {
      for (const token of node.children[key] ?? []) {
        if (token.startOffset >= 0) contextual.add(token.startOffset)
      }
    }

    if (node.name === 'sequencePattern' && node.children.Caret == null) {
      for (const token of node.children.Identifier ?? []) {
        if (/^\p{Lu}/u.test(token.image)) {
          contractPatterns.add(token.startOffset)
        }
      }
    }

    for (const values of Object.values(node.children)) {
      for (const child of values) {
        if (child?.name != null) visit(child)
      }
    }
  }

  visit(cst)
  return { contextual, contractPatterns }
}

const nextTokenClass = (token, index, tokens, seats) => {
  const name = token.tokenType.name
  const previous = tokens[index - 1]
  const next = tokens[index + 1]

  if (seats.contextual.has(token.startOffset)) return 'cm-next-keyword'
  if (seats.contractPatterns.has(token.startOffset)) return 'cm-next-type'
  if (name === 'NumberLiteral') return 'cm-next-number'
  if (nextStringTokens.has(name)) return 'cm-next-string'
  if (name === 'At') return 'cm-next-modifier'
  if (name === 'Hask' || name === 'Wildcard' || name === 'IndexedHole') {
    return 'cm-next-special'
  }
  if (nextOperatorTokens.has(name)) return 'cm-next-operator'
  if (nextPunctuationTokens.has(name)) return 'cm-next-punctuation'

  if (name === 'Identifier' || nextContextualTokenNames.has(name)) {
    if (nextConstants.has(token.image)) return 'cm-next-constant'
    if (previous?.tokenType.name === 'Caret') return null
    if (previous?.tokenType.name === 'At' && nextResidents.has(token.image)) {
      return 'cm-next-modifier'
    }
    if (previous != null &&
      (previous.tokenType.name === 'Dot' ||
        previous.tokenType.name === 'OptionalDot')) {
      return 'cm-next-property'
    }
    if (next?.tokenType.name === 'LParen') return 'cm-next-function'
    if (next != null &&
      (next.tokenType.name === 'Assign' ||
        next.tokenType.name === 'Arrow' ||
        next.tokenType.name === 'Where')) {
      return 'cm-next-definition'
    }
  }

  return null
}

const nextCommentDecorations = (source, from, to, decorations) => {
  const gap = source.slice(from, to)
  for (const match of gap.matchAll(nextCommentPattern)) {
    const start = from + match.index
    decorations.push(
      Decoration.mark({ class: 'cm-next-comment' })
        .range(start, start + match[0].length)
    )
  }
}

const nextDecorations = source => {
  const result = parseCst(source)
  const seats = nextSyntaxSeats(result.cst)
  const decorations = []
  let offset = 0

  result.tokens.forEach((token, index) => {
    nextCommentDecorations(source, offset, token.startOffset, decorations)

    const from = token.startOffset
    const to = token.endOffset + 1
    const className = nextTokenClass(token, index, result.tokens, seats)
    if (className != null && to > from) {
      decorations.push(Decoration.mark({ class: className }).range(from, to))
    }
    offset = to
  })

  nextCommentDecorations(source, offset, source.length, decorations)
  return Decoration.set(decorations, true)
}

const nextSyntaxHighlighting = ViewPlugin.fromClass(class {
  constructor(view) {
    this.decorations = nextDecorations(view.state.doc.toString())
  }

  update(update) {
    if (update.docChanged) {
      this.decorations = nextDecorations(update.state.doc.toString())
    }
  }
}, {
  decorations: value => value.decorations,
})

const languageEditorRoot = document.getElementById('language-editor')
const languageExamplePicker = document.getElementById('language-examples')
const astTree = document.getElementById('ast-tree')
const astStatus = document.getElementById('ast-status')
const astDiagnostics = document.getElementById('ast-diagnostics')

for (const { id, name } of languageExamples) {
  languageExamplePicker.append(new Option(name, id))
}

const initialLanguageExample = languageExamples.find(({ id }) =>
  id === localStorage.getItem('oddo.language.example')
) ?? languageExamples[0]

languageExamplePicker.value = initialLanguageExample.id

let languageEditor
let astEntries = []
let nodeSummaries = new WeakMap()
let selectedSummary = null
let selectingFromTree = false

const isAstNode = value =>
  value != null &&
  !Array.isArray(value) &&
  typeof value === 'object' &&
  typeof value.type === 'string' &&
  value.span != null

const indexAst = ast => {
  const entries = []

  const visit = (value, depth = 0) => {
    if (value == null || typeof value !== 'object') return

    if (Array.isArray(value)) {
      value.forEach(child => visit(child, depth))
      return
    }

    const node = isAstNode(value)
    if (node) {
      entries.push({
        node: value,
        depth,
        width: value.span.endOffset - value.span.startOffset,
      })
    }

    for (const [key, child] of Object.entries(value)) {
      if (key !== 'span' && key !== 'type') visit(child, depth + (node ? 1 : 0))
    }
  }

  visit(ast)
  return entries
}

const nodeAtOffset = (offset, sourceLength) => {
  const point = sourceLength > 0 && offset >= sourceLength
    ? sourceLength - 1
    : Math.max(0, offset)
  let selected = null

  for (const entry of astEntries) {
    const { startOffset, endOffset } = entry.node.span
    const contains = startOffset === endOffset
      ? point === startOffset
      : startOffset <= point && point < endOffset

    if (!contains) continue
    if (selected == null ||
      entry.width < selected.width ||
      entry.width === selected.width && entry.depth > selected.depth) {
      selected = entry
    }
  }

  return selected?.node ?? null
}

const spanLabel = span =>
  `${span.startLine}:${span.startColumn}–${span.endLine}:${span.endColumn} · ` +
  `[${span.startOffset}, ${span.endOffset})`

const scalarLabel = value => {
  if (typeof value === 'string') return JSON.stringify(value)
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  return String(value)
}

const appendText = (parent, className, text) => {
  const span = document.createElement('span')
  span.className = className
  span.textContent = text
  parent.append(span)
}

const renderAstValue = (value, key) => {
  if (value == null || typeof value !== 'object') {
    const leaf = document.createElement('div')
    leaf.className = 'ast-leaf'
    appendText(leaf, 'ast-key', `${key}:`)
    appendText(leaf, 'ast-value', scalarLabel(value))
    return leaf
  }

  if (Array.isArray(value)) {
    const details = document.createElement('details')
    details.className = 'ast-collection'
    const summary = document.createElement('summary')
    appendText(summary, 'ast-key', `${key} `)
    appendText(summary, 'ast-value', `[${value.length}]`)
    details.append(summary)
    const children = document.createElement('div')
    children.className = 'ast-children'
    value.forEach((child, index) =>
      children.append(renderAstValue(child, `[${index}]`)))
    details.append(children)
    return details
  }

  const details = document.createElement('details')
  const summary = document.createElement('summary')
  const children = document.createElement('div')
  children.className = 'ast-children'

  if (isAstNode(value)) {
    details.className = 'ast-node'
    if (value.type === 'Program') details.open = true
    appendText(summary, 'ast-key', `${key}: `)
    appendText(summary, 'ast-type', value.type)
    appendText(summary, 'ast-span', spanLabel(value.span))
    nodeSummaries.set(value, summary)
    summary.addEventListener('click', event => {
      if (event.target === summary) return
      event.preventDefault()
      selectSourceNode(value)
      requestAnimationFrame(() => revealNode(value))
    })
  } else {
    details.className = 'ast-collection'
    appendText(summary, 'ast-key', key)
  }

  details.append(summary)
  for (const [childKey, child] of Object.entries(value)) {
    if (childKey !== 'type' && childKey !== 'span') {
      children.append(renderAstValue(child, childKey))
    }
  }
  details.append(children)
  return details
}

const revealNode = node => {
  const summary = nodeSummaries.get(node)
  if (summary == null) return

  selectedSummary?.classList.remove('ast-selected')
  selectedSummary = summary
  selectedSummary.classList.add('ast-selected')

  let parent = summary.parentElement
  while (parent != null && parent !== astTree) {
    if (parent.tagName === 'DETAILS') parent.open = true
    parent = parent.parentElement
  }

  astStatus.textContent =
    `${astEntries.length} nodes · ${node.type} · ${spanLabel(node.span)}`
  summary.scrollIntoView({ block: 'nearest' })
}

const revealOffset = offset => {
  const sourceLength = languageEditor.state.doc.length
  const node = nodeAtOffset(offset, sourceLength)
  if (node != null) revealNode(node)
}

const selectSourceNode = node => {
  selectingFromTree = true
  languageEditor.dispatch({
    selection: {
      anchor: node.span.startOffset,
      head: node.span.endOffset,
    },
    scrollIntoView: true,
  })
  selectingFromTree = false
  languageEditor.focus()
}

const diagnosticPosition = (error, sourceLength) => {
  if (error.span != null) return error.span

  const token = error.token
  if (token?.startOffset >= 0) {
    return {
      startOffset: token.startOffset,
      endOffset: Math.min(sourceLength, token.endOffset + 1),
      startLine: token.startLine,
      startColumn: token.startColumn,
    }
  }

  if (error.offset >= 0) {
    return {
      startOffset: error.offset,
      endOffset: Math.min(sourceLength, error.offset + Math.max(1, error.length ?? 1)),
      startLine: error.line,
      startColumn: error.column,
    }
  }

  const previous = error.previousToken
  return {
    startOffset: previous?.endOffset >= 0 ? previous.endOffset + 1 : sourceLength,
    endOffset: sourceLength,
    startLine: previous?.endLine,
    startColumn: previous?.endColumn >= 0 ? previous.endColumn + 1 : null,
  }
}

const showDiagnostics = (errors, sourceLength) => {
  astDiagnostics.textContent = ''
  for (const error of errors) {
    const position = diagnosticPosition(error, sourceLength)
    const location = position.startLine != null && position.startColumn != null
      ? `${position.startLine}:${position.startColumn}`
      : `offset ${position.startOffset}`
    const row = document.createElement('div')
    row.className = 'ast-diagnostic'
    row.textContent = `${location} · ${error.message}`
    astDiagnostics.append(row)
  }
}

const showAstUnavailable = () => {
  astTree.textContent = ''
  const empty = document.createElement('div')
  empty.className = 'ast-empty'
  empty.textContent = 'Fix the source error to inspect its Surface AST.'
  astTree.append(empty)
  astStatus.textContent = 'Parse error'
  astEntries = []
  nodeSummaries = new WeakMap()
  selectedSummary = null
}

const parseLanguage = () => {
  const source = languageEditor.state.doc.toString()
  const result = parseCst(source)
  const errors = [...result.lexerErrors, ...result.parserErrors]

  if (errors.length > 0) {
    showDiagnostics(errors, source.length)
    showAstUnavailable()
    return
  }

  let ast
  try {
    ast = buildSurfaceAst(result.cst, source)
  } catch (error) {
    if (!(error instanceof SyntaxError) || error.span == null) throw error
    showDiagnostics([error], source.length)
    showAstUnavailable()
    return
  }

  astDiagnostics.textContent = ''
  astEntries = indexAst(ast)
  nodeSummaries = new WeakMap()
  selectedSummary = null
  astTree.textContent = ''
  astTree.append(renderAstValue(ast, '$'))
  astStatus.textContent = `${astEntries.length} nodes · parsed`
  revealOffset(languageEditor.state.selection.main.head)
}

languageEditor = new EditorView({
  doc: localStorage.getItem('oddo.language') ?? initialLanguageExample.code,
  parent: languageEditorRoot,
  extensions: [
    minimalSetup,
    nextSyntaxHighlighting,
    oneDark,
    editorTheme,
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({
      'aria-label': 'NEXT language editor',
      spellcheck: 'false',
    }),
    keymap.of([indentWithTab]),
    EditorView.updateListener.of(update => {
      if (update.docChanged) {
        localStorage.setItem('oddo.language', update.state.doc.toString())
        parseLanguage()
      } else if (update.selectionSet && !selectingFromTree) {
        revealOffset(update.state.selection.main.head)
      }
    }),
  ],
})

const loadLanguageExample = example => {
  languageEditor.dispatch({
    changes: {
      from: 0,
      to: languageEditor.state.doc.length,
      insert: example.code,
    },
    selection: { anchor: 0 },
    scrollIntoView: true,
  })
}

languageExamplePicker.addEventListener('change', () => {
  const example = languageExamples.find(({ id }) =>
    id === languageExamplePicker.value
  )
  localStorage.setItem('oddo.language.example', example.id)
  loadLanguageExample(example)
})

document.getElementById('language-example').addEventListener('click', () => {
  const example = languageExamples.find(({ id }) =>
    id === languageExamplePicker.value
  )
  loadLanguageExample(example)
})

const tabButtons = Array.from(document.querySelectorAll('[role="tab"]'))
const activateTab = selected => {
  for (const button of tabButtons) {
    const active = button === selected
    button.classList.toggle('active', active)
    button.setAttribute('aria-selected', String(active))
    button.tabIndex = active ? 0 : -1
    document.getElementById(button.getAttribute('aria-controls')).hidden = !active
  }
  if (selected.id === 'language-tab') {
    requestAnimationFrame(() => languageEditor.requestMeasure())
  }
}

tabButtons.forEach((button, index) => {
  button.addEventListener('click', () => activateTab(button))
  button.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    const direction = event.key === 'ArrowRight' ? 1 : -1
    const next = tabButtons[(index + direction + tabButtons.length) % tabButtons.length]
    activateTab(next)
    next.focus()
  })
})

parseLanguage()
