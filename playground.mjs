// ==========================================
// Browser Playground
// ==========================================

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

const api = { ...intern, ...contract, ...facts, ...enums, ...numeric, ...domain, ...matching }
const names = Object.keys(api)
const values = Object.values(api)

const examples = [
  {
    name: 'Interning',
    code: `const a = Tuple(1, 2)
const b = Tuple(1, 2)
log('same tuple:', a === b)

const r = Record({ x: a, tag: "point" })
log('key order free:', r === Record({ tag: "point", x: Tuple(1, 2) }))

try { Record({ raw: { skipped: "the gate" } }) }
catch (e) { log('raw child:', String(e)) }`,
  },
  {
    name: 'Enum nodes',
    code: `const n = Add(Numeric(1), Add(Numeric(2), Numeric(3)))
log(n)
log('interned:', n === Add(Numeric(1), Add(Numeric(2), Numeric(3))))
log('stands at Numeric seats:', n instanceof Numeric)
log('at a strict Number seat:', n instanceof Number)`,
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
    name: 'Match order & failure',
    code: `const chosen = match(3)(
  $ => $(Number)(value => 'first Number case: ' + value),
  $ => $(Number)(() => 'second Number case'),
  $ => $(_)(() => 'fallback')
)
log(chosen)

try {
  match(Mul(1, 2))(
    ($, [a, b]) => $(Add(a, b))(() => 'Add')
  )
} catch (error) {
  log('no match:', String(error))
}`,
  },
  {
    name: 'Match unordered Tuple',
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
    name: 'Structural sharing',
    code: `const shared = Tuple(1, 2)
const a = Record({ left: shared, right: Tuple(3, 4) })
const b = Record({ right: Tuple(3, 4), left: Tuple(1, 2) })

// deep equality is one pointer comparison - no walking
log('whole records:', a === b)
log('children shared:', a.left === shared && b.left === shared)`,
  },
  {
    name: 'Define your own enum',
    code: `// a contract is a predicate behind instanceof
const Even = contractCheck(v => typeof v === "number" && v % 2 === 0)
log('4 is Even:', 4 instanceof Even, '| 3 is Even:', 3 instanceof Even)

// an enum is a gated constructor: args checked, result declared, node interned
const { Pair } = createEnums(() => class {
  Pair = Enum($ => $(Even, Even)(Even))
})
const p = Pair(2, 4)
log(p, '- interned:', p === Pair(2, 4))

// declared result: a Pair stands wherever Even is demanded, so pairs nest
log(Pair(6, Pair(2, 4)))
try { Pair(3, 4) } catch (e) { log(String(e)) }`,
  },
  {
    name: 'Facts & the gate',
    code: `const n = Add(1, 2)
log('raw literals pass (transparency):', String(n))
log('declared result is Numeric:', producedOf(n) === Numeric)
log('n stands at Numeric seats:', n instanceof Numeric)

// strict Number seats still reject what is not a literal number:
log('a box at a strict Number seat:', Numeric(1) instanceof Number)`,
  },
  {
    name: 'Facts by identity',
    code: `// the facts store is keyed by canonical references - and since
// structurally equal means pointer-equal, a fact written against
// Tuple(1, 2) is readable from ANY Tuple(1, 2)
learn(Tuple(1, 2), 'label', "origin pair")
log('read back:', fact(Tuple(1, 2), 'label'))
log('other tuples unaffected:', fact(Tuple(1, 3), 'label') === undefined)`,
  },
]

const editor = document.getElementById('editor')
const output = document.getElementById('output')
const picker = document.getElementById('examples')

document.getElementById('scope').textContent = `in scope: ${names.join(', ')}`

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
  if (Array.isArray(v)) return `[${v.map(show).join(', ')}]`
  return `{ ${Object.entries(v).map(([k, x]) => `${k}: ${show(x)}`).join(', ')} }`
}

// A single expression evaluates to its value; anything else runs as a body.
const compile = (code) => {
  try { return new Function(...names, 'log', `return (\n${code}\n)`) }
  catch { return new Function(...names, 'log', code) }
}

const run = () => {
  output.textContent = ''
  const log = (...vals) => print(vals.map(v => typeof v === 'string' ? v : show(v)).join(' '))
  const original = console.log
  console.log = (...vals) => { log(...vals); original.apply(console, vals) }
  try {
    const result = compile(editor.value)(...values, log)
    if (result !== undefined) print(`→ ${show(result)}`)
  } catch (e) {
    print(String(e), 'err')
  } finally {
    console.log = original
  }
}

document.getElementById('run').addEventListener('click', run)
document.getElementById('clear').addEventListener('click', () => { output.textContent = '' })

picker.addEventListener('change', () => {
  editor.value = examples[picker.selectedIndex].code
  localStorage.setItem('oddo.playground', editor.value)
})

editor.addEventListener('input', () => localStorage.setItem('oddo.playground', editor.value))

editor.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); run() }
  if (e.key === 'Tab') {
    e.preventDefault()
    const { selectionStart: s, selectionEnd } = editor
    editor.setRangeText('  ', s, selectionEnd, 'end')
  }
})

editor.value = localStorage.getItem('oddo.playground') ?? examples[0].code
