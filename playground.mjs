// ==========================================
// Browser Playground
// ==========================================

// Everything the modules export is in scope of the evaluated code, so the
// playground speaks the same language as the source: Tuple, Record, the
// enum factories, contracts, and the facts store.

import * as intern from './src/intern.mjs'
import * as contract from './src/contract.mjs'
import * as facts from './src/facts.mjs'
import * as enums from './src/enum.mjs'
import * as numeric from './src/numeric.mjs'
import * as domain from './src/domain.mjs'

const api = { ...intern, ...contract, ...facts, ...enums, ...numeric, ...domain }
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
    name: 'Facts & the gate',
    code: `const n = Add(Numeric(1), Numeric(2))
log('declared result is Numeric:', producedOf(n) === Numeric)
log('Numeric(1) at a Number seat:', Numeric(1) instanceof Number)

// raw literals at Numeric seats are stage 2 - today the gate refuses:
try { Add(1, 2) } catch (e) { log(String(e)) }`,
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
