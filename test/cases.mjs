// ==========================================
// Test Cases (environment-agnostic)
// ==========================================

// Each case states a design goal and returns true when it holds.
// Red rows are goals the design has not landed yet, not regressions:
// the pending suite documents exactly where the work stands.

import { Tuple, Record } from '../src/intern.mjs'
import { producedOf } from '../src/contract.mjs'
import { Number, Indeterminate, ZeroDivision, ZeroMod } from '../src/numeric.mjs'
import { Add, Sub, Mul, Div, LL, Numeric, Union, Range } from '../src/domain.mjs'

const suite = (title, cases) => ({ title, cases })
const test = (label, run) => ({ label, run })
const throws = (run) => { try { run(); return false } catch { return true } }

export const suites = [

  suite('Interning engine', [
    test('Tuple(1, 2) === Tuple(1, 2)', () => Tuple(1, 2) === Tuple(1, 2)),
    test('tuples are frozen plain arrays', () => Object.isFrozen(Tuple(1, 2)) && Tuple(1, 2).constructor === Array),
    test('Record key-order independence', () => Record({ a: 1, b: 2 }) === Record({ b: 2, a: 1 })),
    test('empty record is canonical', () => Record({}) === Record({})),
    test('children pass through untouched', () => { const t = Tuple(1, 2); return Record({ x: t }).x === t }),
    test('deep nesting is canonical', () => Record({ x: Tuple(1, Tuple(2, 3)) }) === Record({ x: Tuple(1, Tuple(2, 3)) })),
    test('raw object child is rejected at the door', () => throws(() => Record({ x: { raw: 1 } }))),
    test('raw array child is rejected at the door', () => throws(() => Tuple([1, 2]))),
  ]),

  suite('Enum nodes', [
    test('Numeric(1) === Numeric(1)', () => Numeric(1) === Numeric(1)),
    test('String(Numeric(1)) is "Numeric(1)"', () => String(Numeric(1)) === 'Numeric(1)'),
    test('Numeric(1) instanceof Numeric', () => Numeric(1) instanceof Numeric),
    test('Add and Mul of equal elements stay distinct', () =>
      Add(Numeric(1), Numeric(2)) !== Mul(Numeric(1), Numeric(2))),
    test('node instanceof its own factory', () => Add(Numeric(1), Numeric(2)) instanceof Add),
    test('enum node as record child keeps identity', () => { const n = Numeric(7); return Record({ n }).n === n }),
    test('Tuple(1) and Numeric(1) live in different namespaces', () => Tuple(1) !== Numeric(1)),
  ]),

  suite('Declared results - "stands at" membership', [
    test('Add(Numeric(1), Numeric(2)) constructs', () => String(Add(Numeric(1), Numeric(2))) === 'Add(Numeric(1), Numeric(2))'),
    test('the fact landed: producedOf(add node) === Numeric', () => producedOf(Add(Numeric(1), Numeric(2))) === Numeric),
    test('add node stands at Numeric seats', () => Add(Numeric(1), Numeric(2)) instanceof Numeric),
    test('Add(Add(...)) nests and interns', () =>
      Add(Numeric(1), Add(Numeric(2), Numeric(3))) === Add(Numeric(1), Add(Numeric(2), Numeric(3)))),
    test('Numeric(1) is a Numeric', () => Numeric(1) instanceof Numeric),
    test('strict Number seats reject Numeric boxes (discharge discipline)', () => !(Numeric(1) instanceof Number)),
    test('add node does NOT stand at strict Number seats', () => !(Add(Numeric(1), Numeric(2)) instanceof Number)),
  ]),

  suite('Indeterminate forms', [
    test('interned: same operand, same instance', () => new ZeroDivision(1) === new ZeroDivision(1)),
    test('operand is in the identity: 1/0 differs from 2/0', () => new ZeroDivision(1) !== new ZeroDivision(2)),
    test('forms are distinct doors: 1/0 differs from 1%0', () => new ZeroDivision(1) !== new ZeroMod(1)),
    test('the box carries the operand back (valueOf)', () => +new ZeroMod(2) === 2),
    test('a form is an Indeterminate', () => new ZeroDivision(1) instanceof Indeterminate),
    test('a form is a Numeric (union branch)', () => new ZeroDivision(1) instanceof Numeric),
    test('a form is NOT a Number', () => !(new ZeroDivision(1) instanceof Number)),
    test('forms are childable: Add(1, 1/0) constructs and interns', () =>
      Add(1, new ZeroDivision(2)) === Add(1, new ZeroDivision(2))),
  ]),

  suite('Div & Range', [
    test('Div nests at Numeric seats', () => Add(1, Div(6, 2)) === Add(1, Div(6, 2))),
    test('Div produces Numeric', () => producedOf(Div(6, 2)) === Numeric),
    test('Range(0, 100) is interned', () => Range(0, 100) === Range(0, 100)),
    test('different bounds, different ranges', () => Range(0, 100) !== Range(0, 1)),
    test('Range(0, Infinity) constructs', () => String(Range(0, Infinity)) === 'Range(0, Infinity)'),
    test('Range(5, 1) rejected by input validation', () => throws(() => Range(5, 1))),
    test('membership: 50 in Range(0, 100)', () => 50 instanceof Range(0, 100)),
    test('membership: 200 not in Range(0, 100)', () => !(200 instanceof Range(0, 100))),
    test('a Tuple is not in a Range (no coercion)', () => !(Tuple(50) instanceof Range(0, 100))),
  ]),

  suite('Raw literals, Union, LL - landed with the result-slot design', [
    test('Add(1, 2) with raw literals', () => String(Add(1, 2)) === 'Add(1, 2)'),
    test('Add(1, Mul(2, Sub(5, 3))) with raw literals', () =>
      Add(1, Mul(2, Sub(5, 3))) === Add(1, Mul(2, Sub(5, 3)))),
    test('Union(Numeric(1), Numeric(2)) - generics thread', () =>
      String(Union(Numeric(1), Numeric(2))) === 'Union(Numeric(1), Numeric(2))'),
    test('LL(Numeric(1)) - result-stage thread', () => String(LL(Numeric(1))) === 'LL(Numeric(1))'),
  ]),

]
