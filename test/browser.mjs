// ==========================================
// Browser Test Runner
// ==========================================

import { suites } from './cases.mjs'

const el = (tag, className, text) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

const root = document.getElementById('results')
let pass = 0, fail = 0

for (const { title, cases } of suites) {
  root.append(el('h2', null, title))
  for (const { label, run } of cases) {
    let ok, error
    try { ok = run() === true } catch (e) { ok = false; error = e }
    ok ? pass++ : fail++
    const row = el('div', `case ${ok ? 'pass' : 'fail'}`)
    row.append(el('span', 'mark', ok ? '✓' : '✗'), el('span', 'label', label))
    if (error) row.append(el('span', 'error', String(error)))
    root.append(row)
  }
}

document.getElementById('summary').textContent =
  `${pass} passing, ${fail} failing - ${pass + fail} total`
