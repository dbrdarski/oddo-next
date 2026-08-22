// ==========================================
// Test Cases (environment-agnostic)
// ==========================================

// Each case states a design goal and returns true when it holds.
// Red rows are goals the design has not landed yet, not regressions:
// the pending suite documents exactly where the work stands.

import { Tuple, Record } from '../src/intern.mjs'
import { producedOf } from '../src/contract.mjs'
import { Enum, createEnums } from '../src/enum.mjs'
import { match, Combine, _ } from '../src/match.mjs'
import { Number, Indeterminate, ZeroDivision, ZeroMod } from '../src/numeric.mjs'
import { Add, Sub, Mul, Div, LL, Numeric, Union, Equals, Range } from '../src/domain.mjs'
import { OuterRef, CallArgument, MatchArgument, Apply, Arm, Match, Lambda, internFn, expand } from '../src/function.mjs'

const suite = (title, cases) => ({ title, cases })
const test = (label, run) => ({ label, run })
const throws = (run) => { try { run(); return false } catch { return true } }

const { Twin } = createEnums(() => class {
  Twin = Enum(($, [E]) => $(E, E)(E))
})

const loopForm = () => {
  const self = OuterRef(0)
  return Lambda(1, 0, Apply(self, Tuple()))
}

const countDownForm = () => {
  const self = OuterRef(0)
  const argument = CallArgument(0, self)
  return Lambda(1, 1, Match(argument, Tuple(
    Arm(Equals(0), 0),
    Arm(_, Apply(self, Tuple(Sub(argument, 2))))
  )))
}

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
    test('factory kind is the node constructor', () => Add.kind === Add(1, 2).constructor),
    test('different factories expose different kinds', () => Add.kind !== Mul.kind),
    test('a resolved factory does not stand at its result contract', () =>
      (Mul(1, 2), !(Mul instanceof Numeric))),
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

  suite('Generic binding', [
    test('a repeated seat matches the same value', () => String(Twin(7, 7)) === 'Twin(7, 7)'),
    test('a repeated seat rejects a different value', () => throws(() => Twin(7, 8))),
    test('null is a bindable value: Twin(null, null) constructs', () => String(Twin(null, null)) === 'Twin(null, null)'),
    test('null does not match 1: Twin(null, 1) rejected', () => throws(() => Twin(null, 1))),
    test('undefined does not match 5: Twin(undefined, 5) rejected', () => throws(() => Twin(undefined, 5))),
    test('a Twin makes what it holds: producedOf(Twin(2, 2)) is 2', () => producedOf(Twin(2, 2)) === 2),
    test('a Twin is not its element: Twin(1, Twin(2, 2)) rejected', () => throws(() => Twin(1, Twin(2, 2)))),
    test('the same twin twice: Twin(Twin(1,1), Twin(1,1)) constructs', () =>
      String(Twin(Twin(1, 1), Twin(1, 1))) === 'Twin(Twin(1, 1), Twin(1, 1))'),
    test('answers are node-anchored: churn cannot flip them', () => {
      const t = Twin(1, 1)
      Twin(9, 9)
      return producedOf(t) === 1
    }),
    test('binding a contract elsewhere cannot admit a twin', () => {
      const t = Twin(1, 1)
      Twin(Numeric, Numeric)
      return throws(() => Add(t, 2))
    }),
    test('different contract values still fail a repeated generic seat', () =>
      throws(() => Twin(Number, Numeric))),
  ]),

  suite('Div & Range', [
    test('Div nests at Numeric seats', () => Add(1, Div(6, 2)) === Add(1, Div(6, 2))),
    test('Div produces Numeric', () => producedOf(Div(6, 2)) === Numeric),
    test('Range(0, 100) is interned', () => Range(0, 100) === Range(0, 100)),
    test('different bounds, different ranges', () => Range(0, 100) !== Range(0, 1)),
    test('Range(0, Infinity) constructs', () => String(Range(0, Infinity)) === 'Range(0, Infinity)'),
    test('Range(5, 1) rejected by input validation', () => throws(() => Range(5, 1))),
    test('Range bounds must be Numbers, not contracts', () =>
      throws(() => Range(Equals(1), Equals(2)))),
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

  suite('Pattern matching', [
    test('an exact Enum shape captures its seats', () => {
      const result = match(Add(1, 2))(
        ($, [a, b]) => $(Add(a, b))((a, b) => [a, b]),
        $ => $(_)(() => null)
      )
      return result[0] === 1 && result[1] === 2
    }),
    test('different Enum constructors do not structurally match', () =>
      match(Mul(1, 2))(
        ($, [a, b]) => $(Add(a, b))(() => false),
        $ => $(_)(() => true)
      )),
    test('nested Enum shapes capture in generic creation order', () => {
      const result = match(Add(1, Mul(2, 3)))(
        ($, [a, b, c]) => $(Add(a, Mul(b, c)))((a, b, c) => [a, b, c])
      )
      return result[0] === 1 && result[1] === 2 && result[2] === 3
    }),
    test('a repeated capture succeeds by identity', () =>
      match(Add(2, 2))(
        ($, [a]) => $(Add(a, a))(a => a === 2),
        $ => $(_)(() => false)
      )),
    test('a repeated capture mismatch falls through', () =>
      match(Add(2, 3))(
        ($, [a]) => $(Add(a, a))(() => false),
        $ => $(_)(() => true)
      )),
    test('undefined remains a bindable repeated capture', () =>
      match(Twin(undefined, undefined))(
        ($, [a]) => $(Twin(a, a))(a => a === undefined)
      )),
    test('Equals provides exact-value matching', () =>
      match(Add(1, 9))(
        ($, [b]) => $(Add(Equals(1), b))(b => b === 9),
        $ => $(_)(() => false)
      )),
    test('contract-valued Enum leaves use membership', () =>
      match(50)(
        $ => $(Range(0, 100))(value => value === 50),
        $ => $(_)(() => false)
      )),
    test('ordinary contract leaves reuse stands-at membership', () => {
      const value = Add(1, 2)
      return match(value)(
        $ => $(Numeric)(() => true),
        $ => $(_)(() => false)
      )
    }),
    test('a contract-only case receives its matched value', () =>
      match(3)(
        $ => $(Number)(value => value === 3)
      )),
    test('a nested wildcard captures nothing', () =>
      match(Add(1, 9))(
        ($, [b]) => $(Add(_, b))(b => b === 9)
      )),
    test('the first successful case wins', () =>
      match(3)(
        $ => $(Number)(() => 1),
        $ => $(Number)(() => 2)
      ) === 1),
    test('failed-case bindings do not leak', () =>
      match(Add(2, 3))(
        ($, [a]) => $(Add(a, a))(() => false),
        ($, [a, b]) => $(Add(a, b))((a, b) => a === 2 && b === 3)
      )),
    test('no successful case throws', () =>
      throws(() => match(Mul(1, 2))(
        ($, [a, b]) => $(Add(a, b))(() => false)
      ))),
    test('a structural node can hold a contract part', () => Add(Number, 2)[0] === Number),
    test('the same shape is legal as a pattern', () =>
      match(Add(1, 9))(
        ($, [b]) => $(Add(Number, b))(b => b === 9)
      )),
    test('case declarations can contain nested matches', () =>
      match(Add(1, 2))(
        ($, [a, b]) => {
          const inner = match(1)($ => $(Number)(value => value))
          return $(Add(a, b))((a, b) => inner === 1 && a === 1 && b === 2)
        }
      )),
  ]),

  suite('Combine matching', [
    test('source order is ignored and handler order follows the patterns', () => {
      const add = Add(1, 2)
      const run = values => match(values)(
        $ => Combine(Number, Numeric)((number, numeric) =>
          number === 3 && numeric === add),
        $ => $(_)(() => false)
      )
      return run(Tuple(add, 3)) && run(Tuple(3, add))
    }),
    test('cardinality must match exactly', () => {
      const run = values => match(values)(
        $ => Combine(Number, Number)(() => false),
        $ => $(_)(() => true)
      )
      return run(Tuple(1)) && run(Tuple(1, 2, 3))
    }),
    test('the occurrence pool must be a canonical Tuple', () => {
      const run = values => match(values)(
        $ => Combine(Number, Number)(() => false),
        $ => $(_)(() => true)
      )
      return run([1, 2]) && run(Object.freeze([1, 2]))
    }),
    test('ambiguous assignments use occurrence order', () => {
      const add = Add(1, 2)
      return match(Tuple(1, add))(
        $ => Combine(Numeric, Numeric)((first, second) =>
          first === 1 && second === add)
      )
    }),
    test('overlapping contracts backtrack instead of matching greedily', () => {
      const add = Add(1, 2)
      return match(Tuple(3, add))(
        $ => Combine(Numeric, Number)((numeric, number) =>
          numeric === add && number === 3)
      )
    }),
    test('duplicate occurrences remain distinct positions', () =>
      match(Tuple(2, 2))(
        $ => Combine(Equals(2), Equals(2))((first, second) =>
          first === 2 && second === 2)
      )),
    test('a failed branch restores its generic bindings', () =>
      match(Tuple(2, 3))(
        ($, [a]) => Combine(a, Equals(2))((other, two) =>
          other === 3 && two === 2)
      )),
    test('a partially failed structural fit restores its bindings', () => {
      const different = Add(1, 2)
      const same = Add(2, 2)
      return match(Tuple(different, same))(
        ($, [a]) => Combine(Add(a, a), Numeric)((matched, remaining) =>
          matched === same && remaining === different)
      )
    }),
    test('rollback preserves generic holes and earlier bindings', () =>
      match(Tuple(9, 2, 3))(
        ($, [a, b]) => Combine(b, a, Equals(2))((first, second, third) =>
          first === 9 && second === 3 && third === 2)
      )),
    test('repeated generics still compare occurrence identity', () => {
      const run = values => match(values)(
        ($, [a]) => Combine(a, a)((first, second) =>
          first === values[0] && second === values[1]),
        $ => $(_)(() => false)
      )
      return run(Tuple(2, 2)) && !run(Tuple(2, 3))
    }),
  ]),

  suite('Canonical functions & recursive expansion', [
    test('function forms are canonical Enum trees', () =>
      countDownForm() === countDownForm()),
    test('a form and its ordered references determine function identity', () => {
      const form = countDownForm()
      const fn = internFn(form, form)
      return fn === internFn(countDownForm(), countDownForm()) && Object.isFrozen(fn)
    }),
    test('one lowered form/self application has one canonical identity', () => {
      const [a, b, c, d] = Array.from(
        { length: 4 },
        () => internFn(loopForm(), loopForm())
      )
      return a === b && b === c && c === d
    }),
    test('different applied references keep the same form distinct', () => {
      const form = loopForm()
      const one = internFn(Lambda(0, 0, 1))
      const two = internFn(Lambda(0, 0, 2))
      return internFn(form, one) !== internFn(form, two)
    }),
    test('outer-reference order participates in function identity', () => {
      const form = Lambda(2, 0, Tuple(OuterRef(0), OuterRef(1)))
      return internFn(form, 1, 2) !== internFn(form, 2, 1)
    }),
    test('a nonrecursive function simply produces its formula', () => {
      const self = OuterRef(0)
      const form = Lambda(1, 1, Add(CallArgument(0, self), 1))
      const fn = internFn(form, form)
      return expand(fn) === Add(CallArgument(0, fn), 1)
    }),
    test('reaching self leaves the exact residual call', () => {
      const form = countDownForm()
      const fn = internFn(form, form)
      return expand(fn) === Apply(
        fn,
        Tuple(Sub(CallArgument(0, fn), 2))
      )
    }),
    test('every recursive call remains in the complete tree', () => {
      const self = OuterRef(0)
      const argument = CallArgument(0, self)
      const form = Lambda(1, 1, Add(
        Apply(self, Tuple(Sub(argument, 1))),
        Apply(self, Tuple(Sub(argument, 2)))
      ))
      const fn = internFn(form, form)
      const arrived = CallArgument(0, fn)
      return expand(fn) === Add(
        Apply(fn, Tuple(Sub(arrived, 1))),
        Apply(fn, Tuple(Sub(arrived, 2)))
      )
    }),
    test('a wrapper expands through a recursive callee', () => {
      const recursiveSelf = OuterRef(0)
      const recursiveForm = Lambda(1, 1, Apply(
        recursiveSelf,
        Tuple(Sub(CallArgument(0, recursiveSelf), 1))
      ))
      const recursive = internFn(recursiveForm, recursiveForm)

      const wrapperSelf = OuterRef(0)
      const wrapperForm = Lambda(2, 1, Apply(
        OuterRef(1),
        Tuple(Add(CallArgument(0, wrapperSelf), 2))
      ))
      const wrapper = internFn(wrapperForm, wrapperForm, recursive)
      return expand(wrapper) === Apply(
        recursive,
        Tuple(Sub(Add(CallArgument(0, wrapper), 2), 1))
      )
    }),
    test('different-form recursive cycles instantiate lazily', () => {
      const evenForm = Lambda(2, 1, Apply(
        OuterRef(1),
        Tuple(Sub(CallArgument(0, OuterRef(0)), 1))
      ))
      const oddForm = Lambda(2, 1, Apply(
        OuterRef(0),
        Tuple(Sub(CallArgument(0, OuterRef(1)), 1))
      ))
      const even = internFn(evenForm, evenForm, oddForm)
      const odd = internFn(oddForm, evenForm, oddForm)
      const argument = CallArgument(0, even)
      return odd === internFn(oddForm, evenForm, oddForm)
        && expand(even) === Apply(even, Tuple(Sub(Sub(argument, 1), 1)))
    }),
    test('mutual functions preserve their shared external bindings', () => {
      const evenForm = Lambda(4, 1, Apply(
        OuterRef(1),
        Tuple(Sub(CallArgument(0, OuterRef(0)), OuterRef(2)))
      ))
      const oddForm = Lambda(4, 1, Apply(
        OuterRef(0),
        Tuple(Add(CallArgument(0, OuterRef(1)), OuterRef(3)))
      ))
      const references = [evenForm, oddForm, 1, 2]
      const even = internFn(evenForm, ...references)
      const argument = CallArgument(0, even)
      return expand(even) === Apply(
        even,
        Tuple(Add(Sub(argument, 1), 2))
      ) && even !== internFn(evenForm, evenForm, oddForm, 1, 3)
    }),
    test('the stack keys recursion by function identity, not shared form', () => {
      const leafSelf = OuterRef(0)
      const leafForm = Lambda(1, 1, CallArgument(0, leafSelf))
      const leaf = internFn(leafForm, leafForm)

      const sharedForm = Lambda(2, 1, Apply(
        OuterRef(1),
        Tuple(CallArgument(0, OuterRef(0)))
      ))
      const inner = internFn(sharedForm, sharedForm, leaf)
      const outer = internFn(sharedForm, sharedForm, inner)
      return expand(outer) === CallArgument(0, outer)
    }),
    test('completed helper calls leave no stale stack entry', () => {
      const helperSelf = OuterRef(0)
      const helperForm = Lambda(1, 1, Add(CallArgument(0, helperSelf), 1))
      const helper = internFn(helperForm, helperForm)

      const rootSelf = OuterRef(0)
      const rootForm = Lambda(2, 1, Add(
        Apply(OuterRef(1), Tuple(CallArgument(0, rootSelf))),
        Apply(OuterRef(1), Tuple(CallArgument(0, rootSelf)))
      ))
      const root = internFn(rootForm, rootForm, helper)
      const argument = CallArgument(0, root)
      return expand(root) === Add(Add(argument, 1), Add(argument, 1))
    }),
    test('expansion rebuilds arbitrary existing Enum trees', () => {
      const self = OuterRef(0)
      const form = Lambda(1, 1, LL(CallArgument(0, self)))
      const fn = internFn(form, form)
      return expand(fn) === LL(CallArgument(0, fn))
    }),
    test('Match uses its ordinary generic binding order', () => {
      const first = MatchArgument(0)
      const second = MatchArgument(1)
      const form = Lambda(0, 0, Match(
        Add(1, 2),
        Tuple(
          Arm(Add(second, first), Add(first, second)),
          Arm(_, 0)
        )
      ))
      return expand(internFn(form)) === Add(2, 1)
    }),
    test('a nested Match extends the existing handler bindings', () => {
      const a = MatchArgument(0)
      const b = MatchArgument(1)
      const c = MatchArgument(2)
      const d = MatchArgument(3)
      const form = Lambda(0, 0, Match(
        Add(1, 2),
        Tuple(Arm(Add(a, b), Match(
          Add(3, 4),
          Tuple(Arm(Add(c, d), Tuple(a, b, c, d)))
        )))
      ))
      return expand(internFn(form)) === Tuple(1, 2, 3, 4)
    }),
    test('a contract-only Match forwards the matched value', () => {
      const form = Lambda(0, 0, Match(
        9,
        Tuple(Arm(Number, MatchArgument(0)))
      ))
      return expand(internFn(form)) === 9
    }),
    test('a nested contract value follows the existing bindings', () => {
      const a = MatchArgument(0)
      const b = MatchArgument(1)
      const value = MatchArgument(2)
      const form = Lambda(0, 0, Match(
        Add(1, 2),
        Tuple(Arm(Add(a, b), Match(
          9,
          Tuple(Arm(Number, Tuple(a, b, value)))
        )))
      ))
      return expand(internFn(form)) === Tuple(1, 2, 9)
    }),
    test('captured patterns are resolved before matching', () => {
      const form = Lambda(1, 0, Match(
        0,
        Tuple(
          Arm(OuterRef(0), MatchArgument(0)),
          Arm(_, -1)
        )
      ))
      return expand(internFn(form, Equals(0))) === 0
    }),
    test('closed function values remain atomic patterns', () => {
      const targetForm = loopForm()
      const target = internFn(targetForm, targetForm)
      const form = Lambda(1, 0, Match(
        target,
        Tuple(
          Arm(target, 1),
          Arm(_, 0)
        )
      ))
      return expand(internFn(form, 7)) === 1
    }),
    test('a pending call keeps its Match continuation in the tree', () => {
      const self = OuterRef(0)
      const argument = CallArgument(0, self)
      const form = Lambda(1, 1, Match(
        Apply(self, Tuple(Sub(argument, 1))),
        Tuple(Arm(_, Add(argument, 1)))
      ))
      const fn = internFn(form, form)
      const arrived = CallArgument(0, fn)
      return expand(fn) === Match(
        Apply(fn, Tuple(Sub(arrived, 1))),
        Tuple(Arm(_, Add(arrived, 1)))
      )
    }),
    test('function syntax rejects invalid references and host functions', () => {
      const form = loopForm()
      return throws(() => CallArgument(0))
        && throws(() => CallArgument(0, 7))
        && throws(() => Apply(OuterRef(0), Object.freeze([])))
        && throws(() => Lambda(1, 0, OuterRef(1)))
        && throws(() => Lambda(0, 0, () => undefined))
        && throws(() => internFn(form, () => undefined))
    }),
    test('CallArgument and Apply temporarily stand at Numeric seats', () => {
      const form = countDownForm()
      const fn = internFn(form, form)
      return producedOf(CallArgument(0, fn)) === Numeric
        && producedOf(Apply(fn, Tuple(CallArgument(0, fn)))) === Numeric
    }),
    test('call arity is checked before a call can residualize', () => {
      const self = OuterRef(0)
      const form = Lambda(1, 1, Apply(self, Tuple()))
      return throws(() => expand(internFn(form, form)))
    }),
  ]),

]
