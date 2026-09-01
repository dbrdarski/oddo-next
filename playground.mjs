// ==========================================
// Browser Playground
// ==========================================

import { EditorView, minimalSetup } from 'codemirror'
import { indentWithTab } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'
import { keymap } from '@codemirror/view'

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

const editorRoot = document.getElementById('editor')
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

let editor

const run = () => {
  output.textContent = ''
  const log = (...vals) => print(vals.map(v => typeof v === 'string' ? v : show(v)).join(' '))
  const original = console.log
  console.log = (...vals) => { log(...vals); original.apply(console, vals) }
  try {
    const result = compile(editor.state.doc.toString())(...values, log)
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

editor = new EditorView({
  doc: localStorage.getItem('oddo.playground') ?? examples[0].code,
  parent: editorRoot,
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
  editor.dispatch({
    changes: {
      from: 0,
      to: editor.state.doc.length,
      insert: examples[picker.selectedIndex].code,
    },
    selection: { anchor: 0 },
    scrollIntoView: true,
  })
})
