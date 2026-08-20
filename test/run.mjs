// ==========================================
// Board Runner
// ==========================================

// Runs the full semantic suite; exits non-zero on any failure, so the
// board gates npm test as the executable specification.

import { suites } from './cases.mjs'

let pass = 0, fail = 0
for (const { title, cases } of suites) {
  console.log(`\n${title}`)
  for (const { label, run } of cases) {
    let ok
    try { ok = run() === true } catch { ok = false }
    ok ? pass++ : fail++
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  }
}
console.log(`\n${pass} passing, ${fail} failing`)
process.exitCode = fail && 1
