// ==========================================
// Test Cases (environment-agnostic)
// ==========================================

// Each case states a design goal and returns true when it holds.
// Red rows are goals the design has not landed yet, not regressions:
// the pending suite documents exactly where the work stands.

import { Tuple, Record } from '../src/intern.mjs'
import { fulfills, isInstance, producedOf } from '../src/contract.mjs'
import {
  fact, learn, Resolve, Consumes, Produces, Transparent, Callable
} from '../src/facts.mjs'
import {
  Enum, createEnums, mapEnum, Pure, purityOf
} from '../src/enum.mjs'
import { match, matchDomain, Combine, _ } from '../src/match.mjs'
import { Canonical as CanonicalForm } from '../src/canonical.mjs'
import { Number, Indeterminate, ZeroDivision, ZeroMod } from '../src/numeric.mjs'
import {
  Add, Sub, Mul, Div, LL, Numeric, Union, Intersection, Difference, Equals, Range,
  Top as DomainTop, Bottom, Null, canonicalizeDomain, registerPure
} from '../src/domain.mjs'
import {
  CallArgument, Apply, Arm, Match, Function
} from '../src/function.mjs'
import {
  Expanded,
  Accepted,
  ResultContract,
  Canonical,
  Top,
  prepare,
} from './contextual-prepare.model.mjs'
import { parserLexerSuites } from './parser-lexer-cases.mjs'
import { parserGrammarSuites } from './parser-grammar-cases.mjs'
import { parserAstSuites } from './parser-ast-cases.mjs'

const suite = (title, cases) => ({ title, cases })
const test = (label, run) => ({ label, run })
const throws = (run) => { try { run(); return false } catch { return true } }
const isUnionOf = (candidate, left, right) =>
  isInstance(candidate, Union) && match(Tuple(...candidate))(
    ($, [a, b]) => Combine(a, b)((a, b) =>
      a === left && b === right || a === right && b === left)
  )
const armFor = (candidate, region) =>
  candidate[1].find(arm => arm[0] === region)

const {
  Twin, PureValue, ImpureValue, ImpureNumericValue, PurityPair
} = createEnums(() => class {
  Twin = Enum(($, [E]) => $(E, E)(E))
  PureValue = Enum($ => $()())
  ImpureValue = Enum($ => $()())
  ImpureNumericValue = Enum($ => $()(Numeric))
  PurityPair = Enum($ => $(_, _)())
})

registerPure(ImpureValue, () => false)
registerPure(ImpureNumericValue, () => false)

export const suites = [

  suite('Interning engine', [
    test('Tuple(1, 2) === Tuple(1, 2)', () => Tuple(1, 2) === Tuple(1, 2)),
    test('tuples are nominal Tuple arrays', () => {
      const tuple = Tuple(1, 2)
      return isInstance(tuple, Tuple)
        && isInstance(tuple, Array)
        && tuple.constructor === Tuple
    }),
    test('a single Number remains a Tuple element', () =>
      Tuple(0).length === 1
        && Tuple(0)[0] === 0
        && Tuple(0) !== Tuple()
        && Tuple(2) !== Tuple(null, null)),
    test('Record key-order independence', () => Record({ a: 1, b: 2 }) === Record({ b: 2, a: 1 })),
    test('Record copies __proto__ as an own data property', () => {
      const props = Object.create(null)
      props.__proto__ = 1
      const record = Record(props)
      return isInstance(record, Record)
        && Object.getPrototypeOf(record) === Record.prototype
        && Object.hasOwn(record, '__proto__')
        && record.__proto__ === 1
    }),
    test('empty record is canonical', () => Record({}) === Record({})),
    test('children pass through untouched', () => { const t = Tuple(1, 2); return Record({ x: t }).x === t }),
    test('deep nesting is canonical', () => Record({ x: Tuple(1, Tuple(2, 3)) }) === Record({ x: Tuple(1, Tuple(2, 3)) })),
  ]),

  suite('Purity', [
    test('non-Enum data is pure by default', () =>
      purityOf(1)
        && purityOf(new ZeroDivision(1))
        && purityOf(Tuple(ImpureValue()))
        && purityOf(Record({ value: ImpureValue() }))),
    test('every Enum instance retains its derived purity', () => {
      const pure = PureValue()
      const impure = ImpureValue()
      return pure[Pure] === true
        && impure[Pure] === false
        && PurityPair(pure, impure)[Pure] === false
    }),
    test('purity rules live on the Enum kind', () =>
      typeof ImpureValue.kind[Pure] === 'function'),
  ]),

  suite('Facts store', [
    test('built-in fact keys are shared Symbols', () =>
      [Resolve, Consumes, Produces, Transparent, Callable]
        .every(key => typeof key === 'symbol')),
    test('equal Symbol descriptions remain distinct fact keys', () => {
      const subject = Tuple('fact subject')
      const first = Symbol('Fact')
      const second = Symbol('Fact')
      learn(subject, first, 1)
      learn(subject, second, 2)
      learn(subject, first, 3)
      return fact(subject, first) === 1 && fact(subject, second) === 2
    }),
    test('a missing fact is nullish', () =>
      fact(Tuple('missing fact'), Symbol('Missing')) == null),
    test('declared results are stored under the shared Produces key', () => {
      const node = Add(1, 2)
      return fact(node.constructor, Produces) === Numeric
    }),
    test('declared argument contracts are stored under Consumes', () => {
      const node = Mul(1, 2)
      const contracts = fact(node.constructor, Consumes)
      return contracts[0] === Numeric && contracts[1] === Numeric
    }),
  ]),

  suite('Contextual matcher shell', [
    test('the matcher-bound transformer receives context explicitly', () => {
      const prepare = matchDomain({ Add }, (matches, { Add }) => context => matches(
        ($, [left, right]) => $(Add(left, right))((left, right) =>
          Tuple(context, left, right)),
        ($, [value]) => $(value)(value => Tuple(context, value))
      ))
      const expanded = Add(41, 42)
      return prepare(expanded)('context') === Tuple('context', 41, 42)
    }),
    test('configured handlers remain independent for the same expanded value', () => {
      const expanded = Add(43, 44)
      const first = matchDomain({}, () => context => Tuple('first', context))
      const second = matchDomain({}, () => context => Tuple('second', context))
      return first(expanded)('context') === Tuple('first', 'context')
        && second(expanded)('context') === Tuple('second', 'context')
    }),
    test('primitive expanded values use the same matcher path', () => {
      const prepare = matchDomain({}, matches => context => matches(
        ($, [value]) => $(value)(value => Tuple(context, value))
      ))
      return prepare(7)('context') === Tuple('context', 7)
    }),
  ]),

  suite('Enum nodes', [
    test('Enum membership uses registered constructors', () =>
      isInstance(Add(1, 2), Enum)
        && isInstance(Null, Enum)
        && !isInstance(Tuple(1, 2), Enum)),
    test('mapEnum returns null for a non-Enum value', () =>
      mapEnum(Tuple(1, 2), value => value) === null),
    test('Numeric(1) === Numeric(1)', () => Numeric(1) === Numeric(1)),
    test('String(Numeric(1)) is "Numeric(1)"', () => String(Numeric(1)) === 'Numeric(1)'),
    test('Numeric(1) fulfils Numeric', () => fulfills(Numeric(1), Numeric)),
    test('Add and Mul of equal elements stay distinct', () =>
      Add(Numeric(1), Numeric(2)) !== Mul(Numeric(1), Numeric(2))),
    test('node is an instance of its own factory', () =>
      isInstance(Add(Numeric(1), Numeric(2)), Add)),
    test('factory kind is the node constructor', () => Add.kind === Add(1, 2).constructor),
    test('different factories expose different kinds', () => Add.kind !== Mul.kind),
    test('a resolved factory does not stand at its result contract', () =>
      (Mul(1, 2), !fulfills(Mul, Numeric))),
    test('enum node as record child keeps identity', () => { const n = Numeric(7); return Record({ n }).n === n }),
    test('Tuple(1) and Numeric(1) live in different namespaces', () => Tuple(1) !== Numeric(1)),
  ]),

  suite('Declared results - "stands at" membership', [
    test('Add(Numeric(1), Numeric(2)) constructs', () => String(Add(Numeric(1), Numeric(2))) === 'Add(Numeric(1), Numeric(2))'),
    test('the fact landed: producedOf(add node) === Numeric', () => producedOf(Add(Numeric(1), Numeric(2))) === Numeric),
    test('add node stands at Numeric seats', () =>
      fulfills(Add(Numeric(1), Numeric(2)), Numeric)),
    test('Add(Add(...)) nests and interns', () =>
      Add(Numeric(1), Add(Numeric(2), Numeric(3))) === Add(Numeric(1), Add(Numeric(2), Numeric(3)))),
    test('Numeric(1) is a Numeric', () => fulfills(Numeric(1), Numeric)),
    test('strict Number seats reject Numeric boxes (discharge discipline)', () =>
      !fulfills(Numeric(1), Number)),
    test('add node does NOT stand at strict Number seats', () =>
      !fulfills(Add(Numeric(1), Numeric(2)), Number)),
  ]),

  suite('Indeterminate forms', [
    test('interned: same operand, same instance', () => new ZeroDivision(1) === new ZeroDivision(1)),
    test('operand is in the identity: 1/0 differs from 2/0', () => new ZeroDivision(1) !== new ZeroDivision(2)),
    test('forms are distinct doors: 1/0 differs from 1%0', () => new ZeroDivision(1) !== new ZeroMod(1)),
    test('valueOf retains the complete Indeterminate form', () => {
      const value = new ZeroMod(2)
      return value.valueOf() === value
    }),
    test('a form is an Indeterminate', () =>
      fulfills(new ZeroDivision(1), Indeterminate)),
    test('a form is a Numeric (union branch)', () =>
      fulfills(new ZeroDivision(1), Numeric)),
    test('a form is NOT a Number', () =>
      !fulfills(new ZeroDivision(1), Number)),
    test('forms are childable: Add(1, 1/0) constructs and interns', () =>
      Add(1, new ZeroDivision(2)) === Add(1, new ZeroDivision(2))),
  ]),

  suite('Generic binding', [
    test('a repeated seat matches the same value', () => String(Twin(7, 7)) === 'Twin(7, 7)'),
    test('a repeated seat rejects a different value', () => throws(() => Twin(7, 8))),
    test('null is a bindable value: Twin(null, null) constructs', () => String(Twin(null, null)) === 'Twin(null, null)'),
    test('null does not match 1: Twin(null, 1) rejected', () => throws(() => Twin(null, 1))),
    test('null does not match 5: Twin(null, 5) rejected', () => throws(() => Twin(null, 5))),
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
    test('CallArgument placeholders defer repeated-value constraints', () => {
      const argument = CallArgument(0)
      const other = CallArgument(1)
      return Twin(argument, argument) === Twin(argument, argument)
        && Twin(argument, other) === Twin(argument, other)
    }),
  ]),

  suite('Div & Range', [
    test('Div nests at Numeric seats', () => Add(1, Div(6, 2)) === Add(1, Div(6, 2))),
    test('Div produces Numeric', () => producedOf(Div(6, 2)) === Numeric),
    test('Range(0, 100) is interned', () => Range(0, 100) === Range(0, 100)),
    test('different bounds, different ranges', () => Range(0, 100) !== Range(0, 1)),
    test('Range(0, Infinity) constructs', () => String(Range(0, Infinity)) === 'Range(0, Infinity)'),
    test('a reversed Range remains an empty representable form', () => {
      const range = Range(5, 1)
      return range === Range(5, 1)
        && !fulfills(1, range)
        && !fulfills(5, range)
    }),
    test('Equals forwards its value through Range Number seats', () =>
      Range(Equals(1), Equals(2)) === Range(Equals(1), Equals(2))),
    test('CallArgument passes Number seats symbolically', () => {
      const argument = CallArgument(0)
      return fulfills(argument, Number)
        && !isInstance(argument, Number)
        && Range(argument, 10) === Range(argument, 10)
    }),
    test('membership: 50 in Range(0, 100)', () =>
      fulfills(50, Range(0, 100))),
    test('membership: 200 not in Range(0, 100)', () =>
      !fulfills(200, Range(0, 100))),
    test('a Tuple is not in a Range (no coercion)', () =>
      !fulfills(Tuple(50), Range(0, 100))),
  ]),

  suite('Raw literals, Union, LL - landed with the result-slot design', [
    test('Add(1, 2) with raw literals', () => String(Add(1, 2)) === 'Add(1, 2)'),
    test('Add(1, Mul(2, Sub(5, 3))) with raw literals', () =>
      Add(1, Mul(2, Sub(5, 3))) === Add(1, Mul(2, Sub(5, 3)))),
    test('LL(Numeric(1), Null) - result-stage thread', () =>
      String(LL(Numeric(1), Null)) === 'LL(Numeric(1), Null())'),
  ]),

  suite('Top, Bottom, and Null', [
    test('Top Bottom and Null are canonical Enum values', () =>
      [DomainTop, Bottom, Null].every(value =>
        Array.isArray(value)
          && value.constructor !== Array
          && mapEnum(value, part => part) === value
      )
        && DomainTop.constructor !== Bottom.constructor
        && Bottom.constructor !== Null.constructor
        && String(DomainTop) === 'Top()'
        && String(Bottom) === 'Bottom()'
        && String(Null) === 'Null()'),
    test('Top admits language values', () =>
      fulfills(1, DomainTop) && fulfills(Null, DomainTop)),
    test('Top rejects raw host null', () => !fulfills(null, DomainTop)),
    test('Bottom admits no value', () =>
      !fulfills(1, Bottom) && !fulfills(Null, Bottom)),
    test('Null is its own value and contract', () => fulfills(Null, Null)),
    test('raw host null is not language Null', () => !fulfills(null, Null)),
    test('Union(Null, Number) replaces Optional membership', () =>
      fulfills(Null, Union(Null, Number)) &&
      fulfills(1, Union(Null, Number))),
    test('LL uses an explicit Null terminator', () =>
      LL(1, Null) === LL(1, Null)),
    test('LL nests through its recursive tail contract', () =>
      LL(1, LL(2, Null)) === LL(1, LL(2, Null))),
    test('LL rejects an omitted or raw host-nullish tail', () =>
      throws(() => LL(1)) &&
      throws(() => LL(1, null))),
  ]),

  suite('Region contract Enums', [
    test('Intersection is an interned contract value', () => {
      const region = Intersection(Number, Range(0, 10))
      return region === Intersection(Number, Range(0, 10))
        && fulfills(5, region)
        && !fulfills(20, region)
    }),
    test('Difference is an ordered interned contract value', () => {
      const region = Difference(Number, Equals(0))
      return region === Difference(Number, Equals(0))
        && region !== Difference(Equals(0), Number)
        && fulfills(1, region)
        && !fulfills(0, region)
    }),
  ]),

  suite('Domain canonicalization', [
    test('a repeated Union contract canonicalizes to that contract', () => {
      const written = Union(Number, Number)
      return written !== Number && canonicalizeDomain(written) === Number
    }),
    test('Union uses Bottom identity and Top absorption', () =>
      canonicalizeDomain(Union(Bottom, Number)) === Number
        && canonicalizeDomain(Union(Number, Bottom)) === Number
        && canonicalizeDomain(Union(DomainTop, Number)) === DomainTop
        && canonicalizeDomain(Union(Number, DomainTop)) === DomainTop),
    test('Intersection deduplicates and uses Top and Bottom', () =>
      canonicalizeDomain(Intersection(Number, Number)) === Number
        && canonicalizeDomain(Intersection(DomainTop, Number)) === Number
        && canonicalizeDomain(Intersection(Number, DomainTop)) === Number
        && canonicalizeDomain(Intersection(Bottom, Number)) === Bottom
        && canonicalizeDomain(Intersection(Number, Bottom)) === Bottom),
    test('Difference applies its ordered identity laws', () =>
      canonicalizeDomain(Difference(Number, Number)) === Bottom
        && canonicalizeDomain(Difference(Number, Bottom)) === Number
        && canonicalizeDomain(Difference(Bottom, Number)) === Bottom
        && canonicalizeDomain(Difference(Number, DomainTop)) === Bottom),
    test('unknown region relations remain residual', () => {
      const union = Union(Number, Indeterminate)
      const intersection = Intersection(Number, Range(0, 10))
      const difference = Difference(Number, Equals(0))
      return canonicalizeDomain(union) === union
        && canonicalizeDomain(intersection) === intersection
        && canonicalizeDomain(difference) === difference
    }),
    test('the local kernel does not recursively normalize children', () => {
      const child = Union(Bottom, Number)
      return canonicalizeDomain(Intersection(DomainTop, child)) === child
        && canonicalizeDomain(child) === Number
    }),
    test('reduced regions are idempotent', () => [
      Union(Bottom, Number),
      Union(DomainTop, Number),
      Intersection(DomainTop, Number),
      Intersection(Bottom, Number),
      Difference(Number, Number),
      Difference(Number, Bottom),
    ].every(region => {
      const canonical = canonicalizeDomain(region)
      return canonicalizeDomain(canonical) === canonical
    })),
    test('an unmatched Domain node remains itself', () => {
      const written = Add(1, 2)
      return canonicalizeDomain(written) === written
    }),
    test('a primitive remains itself', () => canonicalizeDomain(3) === 3),
  ]),

  suite('Enum form canonicalization', [
    test('Add owns its canonical rule', () =>
      typeof Add.kind[CanonicalForm] === 'function'),
    test('an Enum retains E and stores C', () => {
      const E = Add(1, 2)
      return isInstance(E, Add)
        && E[CanonicalForm] === Equals(3)
        && producedOf(E) === Numeric
    }),
    test('a node without a rule stores itself as C', () => {
      const E = Mul(2, 3)
      return E[CanonicalForm] === E
    }),
    test('a parent rule reads its child C', () => {
      const inner = Add(1, 2)
      const outer = Add(inner, 3)
      return inner[CanonicalForm] === Equals(3)
        && outer[0] === inner
        && outer[CanonicalForm] === Equals(6)
    }),
    test('Number.kind excludes symbolic contract admission', () => {
      const argument = CallArgument(0)
      return fulfills(argument, Number)
        && match(argument)(
          $ => $(Number.kind)(() => false),
          $ => $(_)(() => true)
        )
        && match(Equals(6))(
          $ => $(Number.kind)(value => value === Equals(6)),
          $ => $(_)(() => false)
        )
    }),
    test('a symbolic Add remains its own C', () => {
      const E = Add(CallArgument(0), 1)
      return E[CanonicalForm] === E
    }),
    test('an Indeterminate Add remains its own C', () => {
      const E = Add(new ZeroDivision(1), 1)
      return E[CanonicalForm] === E
    }),
    test('Range addition combines both endpoints', () =>
      Add(Range(1, 3), Range(10, 20))[CanonicalForm]
        === Range(11, 23)),
    test('Number addition shifts a Range in either order', () =>
      Add(Range(1, 3), 10)[CanonicalForm] === Range(11, 13)
        && Add(10, Range(1, 3))[CanonicalForm] === Range(11, 13)),
    test('Mul folds a pure known Number through zero', () =>
      Mul(0, 2)[CanonicalForm] === Equals(0)
        && Mul(2, 0)[CanonicalForm] === Equals(0)),
    test('Mul orders a residual zero without reordering it again', () => {
      const argument = CallArgument(0)
      const ordered = Mul(0, argument)
      return Mul(argument, 0)[CanonicalForm] === ordered
        && ordered[CanonicalForm] === ordered
    }),
    test('Mul retains zero products that cannot be erased', () => {
      const indeterminate = new ZeroDivision(1)
      const impure = ImpureNumericValue()
      const indeterminateMul = Mul(0, indeterminate)
      const impureMul = Mul(0, impure)
      return indeterminateMul[CanonicalForm] === indeterminateMul
        && impureMul[Pure] === false
        && impureMul[CanonicalForm] === impureMul
    }),
  ]),

  suite('Contextual preparation reference model', [
    test('one expanded expression can occupy two arm contexts', () => {
      const argument = CallArgument(0)
      const expanded = Mul(0, argument)
      const written = Match(argument, Tuple(
        Arm(Number, expanded),
        Arm(_, expanded)
      ))
      return written[1][0][1] === expanded && written[1][1][1] === expanded
    }),
    test('Number context produces zero without replacing the expanded form', () => {
      const expanded = Mul(0, CallArgument(0))
      const analysis = prepare(expanded)(Number)
      return analysis[Expanded] === expanded
        && analysis[Accepted] === Number
        && analysis[ResultContract] === Equals(0)
        && analysis[Canonical] === 0
    }),
    test('Indeterminate context preserves the unresolved expanded operation', () => {
      const expanded = Mul(0, CallArgument(0))
      const analysis = prepare(expanded)(Indeterminate)
      return analysis[Expanded] === expanded
        && analysis[Accepted] === Indeterminate
        && analysis[ResultContract] === Indeterminate
        && analysis[Canonical] === expanded
    }),
    test('a guarded arm retains Number while its body becomes zero', () => {
      const argument = CallArgument(0)
      const expanded = Mul(0, argument)
      const written = Match(argument, Tuple(Arm(Number, expanded)))
      const analysis = prepare(written)(Top)
      return analysis[Accepted] === Number
        && analysis[ResultContract] === Equals(0)
        && isInstance(analysis[Canonical], Match)
        && analysis[Canonical][1].length === 1
        && analysis[Canonical][1][0][0] === Number
        && analysis[Canonical][1][0][1] === 0
    }),
    test('an unguarded arm derives Numeric from its body', () => {
      const argument = CallArgument(0)
      const expanded = Mul(0, argument)
      const written = Match(argument, Tuple(Arm(_, expanded)))
      const analysis = prepare(written)(Top)
      const numberArm = armFor(analysis[Canonical], Number)
      const indeterminateArm = armFor(analysis[Canonical], Indeterminate)
      return analysis[Accepted] === Numeric
        && isUnionOf(analysis[ResultContract], Equals(0), Indeterminate)
        && isInstance(analysis[Canonical], Match)
        && analysis[Canonical][1].length === 2
        && numberArm?.[1] === 0
        && indeterminateArm?.[1] === expanded
    }),
    test('Match passes its exact remainder to the later arm', () => {
      const argument = CallArgument(0)
      const expanded = Mul(0, argument)
      const written = Match(argument, Tuple(
        Arm(Number, expanded),
        Arm(_, expanded)
      ))
      const analysis = prepare(written)(Top)
      const numberArm = armFor(analysis[Canonical], Number)
      const indeterminateArm = armFor(analysis[Canonical], Indeterminate)
      return analysis[Accepted] === Numeric
        && numberArm?.[1] === 0
        && indeterminateArm?.[1] === expanded
    }),
    test('a selected wildcard arm does not fall through when its body rejects', () => {
      const argument = CallArgument(0)
      const expanded = Mul(0, argument)
      const written = Match(argument, Tuple(
        Arm(_, expanded),
        Arm(_, 7)
      ))
      const analysis = prepare(written)(Top)
      return analysis[Accepted] === Numeric
        && analysis[Canonical][1].length === 2
        && analysis[Canonical][1].every(arm => arm[1] !== 7)
    }),
    test('a body-derived Numeric function remains distinct from constant zero', () => {
      const expanded = Mul(0, CallArgument(0))
      const multiplied = prepare(expanded)(Top)
      const constant = prepare(0)(Top)
      return multiplied[Accepted] === Numeric
        && constant[Accepted] === Top
        && constant[ResultContract] === Equals(0)
        && multiplied[Canonical] !== constant[Canonical]
    }),
    test('call erasure is rejected until obligations are represented', () => {
      const fn = Function(() => value => value)
      const call = Apply(fn, Tuple(CallArgument(0)))
      return throws(() => prepare(Mul(0, call))(Number))
    }),
    test('a call cannot disappear as an unanalyzed Match scrutinee', () => {
      const fn = Function(() => value => value)
      const call = Apply(fn, Tuple(CallArgument(0)))
      const written = Match(call, Tuple(Arm(_, 0)))
      return throws(() => prepare(written)(Top))
    }),
    test('a Match region cannot leak into a different argument dependency', () => {
      const matched = CallArgument(0)
      const other = CallArgument(1)
      const written = Match(matched, Tuple(Arm(Number, Mul(0, other))))
      return throws(() => prepare(written)(Top))
    }),
    test('the one-argument scaffold rejects wrapped and wildcard contexts', () => {
      const expanded = Mul(0, CallArgument(0))
      return throws(() => prepare(expanded)(Tuple(Top, Number)))
        && throws(() => prepare(expanded)(Tuple(Top)))
        && throws(() => prepare(expanded)(_))
    }),
    test('explicit disjoint arms and the direct expression reach one mapping', () => {
      const argument = CallArgument(0)
      const expanded = Mul(0, argument)
      const written = Match(argument, Tuple(
        Arm(Number, expanded),
        Arm(_, expanded)
      ))
      return prepare(written)(Top)[Canonical]
        === prepare(expanded)(Top)[Canonical]
    }),
    test('restricting the same expression agrees with its complete mapping', () => {
      const argument = CallArgument(0)
      const expanded = Mul(0, argument)
      const complete = prepare(expanded)(Top)
      const restricted = prepare(expanded)(Number)
      const numberArm = armFor(complete[Canonical], Number)
      return numberArm?.[1] === restricted[Canonical]
        && numberArm?.[0] === restricted[Accepted]
        && restricted[ResultContract] === Equals(0)
    }),
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
    test('Enum kind cases use nominal membership', () => {
      const argument = CallArgument(0)
      return match(argument)(
        $ => $(Apply.kind)(() => false),
        $ => $(CallArgument.kind)(value => value === argument)
      )
    }),
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
    test('null remains a bindable repeated capture', () =>
      match(Twin(null, null))(
        ($, [a]) => $(Twin(a, a))(a => a === null)
      )),
    test('Equals provides exact-value matching', () =>
      match(Add(1, 9))(
        ($, [b]) => $(Add(Equals(1), b))(b => b === 9),
        $ => $(_)(() => false)
      )),
    test('Equals forwards its value through contract fulfilment', () =>
      Equals(6).valueOf() === 6
        && !isInstance(Equals(6), Number)
        && fulfills(Equals(6), Number)
        && fulfills(Equals(6), Numeric)),
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
    test('no successful case returns the original value', () => {
      const value = Mul(1, 2)
      return match(value)(
        ($, [a, b]) => $(Add(a, b))(() => false)
      ) === value
    }),
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
    test('a non-Tuple occurrence pool is converted locally', () =>
      match([1, 2])(
        $ => Combine(1, 2)((first, second) =>
          first === 1 && second === 2)
      )),
    test('an Enum candidate supplies its seats directly', () =>
      match(Add(1, 2))(
        $ => Combine(Number.kind, Number.kind)((first, second) =>
          first === 1 && second === 2)
      )),
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

  suite('Function result declarations', [
    test('Arm forwards its result through its positional generic', () =>
      producedOf(Arm(_, 0)) === 0
        && producedOf(Arm(_, Add(1, 1))) === Add(1, 1)),
    test('Match derives the union of its Arm result contracts', () => {
      const result = producedOf(Match(0, Tuple(
        Arm(Equals(0), Add(1, 1)),
        Arm(_, 6)
      )))
      return isUnionOf(result, Numeric, Equals(6))
        && producedOf(Match(0, Tuple())) === Bottom
    }),
    test('Match reads a formed Apply result through its Arm generic', () => {
      const six = Function(() => () => 6)
      return producedOf(Match(0, Tuple(
        Arm(_, Apply(six, Tuple()))
      ))) === Equals(6)
    }),
  ]),

  suite('Function formation', [
    test('formed functions are canonical Enum values', () => {
      const fn = Function(() => x => x)
      return isInstance(fn, Enum)
        && isInstance(fn, Function)
        && fn.constructor === Function.kind
    }),
    test('the body factory produces E before a Function exists', () => {
      const argument = CallArgument(0)
      const bodyForm = () => x => Mul(x, 0)
      return bodyForm()(argument) === Mul(argument, 0)
    }),
    test('formation infers the complete ordered demand Tuple', () => {
      const fn = Function(() => (unused, n) => Mul(n, 0))
      return fn[2] === Tuple(DomainTop, Numeric)
    }),
    test('C orders multiplication without erasing a Numeric argument', () => {
      const fn = Function(() => x => Mul(x, 0))
      return fn[0] === Mul(0, CallArgument(0))
    }),
    test('equivalent operand order has one Function identity', () =>
      Function(() => x => Mul(0, x))
        === Function(() => x => Mul(x, 0))),
    test('a repeated symbolic argument is not mistaken for literal zero', () => {
      const fn = Function(() => x => Mul(x, x))
      return fn[0] === Mul(CallArgument(0), CallArgument(0))
    }),
    test('canonicalization reaches nested expressions', () =>
      Function(() => x => Add(1, Mul(0, x)))
        === Function(() => x => Add(1, Mul(x, 0)))),
    test('retained demand distinguishes multiplication from a constant', () => {
      const multiplied = Function(() => x => Mul(0, x))
      const constant = Function(() => x => 0)
      return multiplied !== constant
        && multiplied[2] === Tuple(Numeric)
        && constant[2] === Tuple(DomainTop)
    }),
    test('complete ordered outer references participate in identity', () => {
      const bodyForm = (first, second) => x => x
      return Function(bodyForm, 1, 2) !== Function(bodyForm, 2, 1)
    }),
    test('unused call parameters still participate through contract arity', () =>
      Function(() => () => 0) !== Function(() => x => 0)),
    test('the first equivalent callable remains attached', () => {
      const reference = Symbol('first callable test')
      const first = x => Mul(0, x)
      const second = x => Mul(x, 0)
      const a = Function(() => first, reference)
      const b = Function(() => second, reference)
      return a === b
        && fact(a, Callable) === first
        && fact(b, Callable) === first
    }),
    test('a formed Apply derives the widest result from E, not C', () => {
      const fn = Function(() => () => Add(1, 1))
      const application = Apply(fn, Tuple())
      return fn[0] === Equals(2)
        && fact(fn, Produces) === Numeric
        && producedOf(application) === Numeric
    }),
    test('a literal function result retains its exact contract', () => {
      const fn = Function(() => () => 6)
      return fact(fn, Produces) === Equals(6)
        && producedOf(Apply(fn, Tuple())) === Equals(6)
    }),
    test('a returned Function has the Function result contract', () => {
      const returned = Function(() => () => 6)
      const fn = Function(returned => () => returned, returned)
      return fact(fn, Produces) === Function
        && producedOf(Apply(fn, Tuple())) === Function
    }),
    test('Apply retains E and stores the concrete call result as C', () => {
      const increment = Function(() => x => Add(x, 1))
      const E = Apply(increment, Tuple(2))
      return E === Apply(increment, Tuple(2))
        && E[CanonicalForm] === Equals(3)
        && producedOf(E) === Numeric
    }),
    test('a literal call result is already its canonical value', () => {
      const six = Function(() => () => 6)
      return Apply(six, Tuple())[CanonicalForm] === 6
    }),
    test('a Function-valued call result remains that Function', () => {
      const returned = Function(() => () => 6)
      const fn = Function(returned => () => returned, returned)
      return Apply(fn, Tuple())[CanonicalForm] === returned
    }),
    test('concrete Apply canonicalizes nested argument values', () => {
      const increment = Function(() => x => Add(x, 1))
      return Apply(increment, Tuple(Add(1, 1)))[CanonicalForm]
        === Equals(3)
    }),
    test('concrete Apply passes actual captures to ordinary match', () => {
      const token = Symbol('concrete Apply match')
      const fn = Function(token => value => match(value)(
        ($, [left, right]) =>
          $(Add(left, right))((left, right) => Tuple(left, right))
      ), token)

      return Apply(fn, Tuple(Add(1, 2)))[CanonicalForm] === Tuple(1, 2)
    }),
    test('nested Apply remains in the canonical body', () => {
      const helper = Function(() => x => Add(x, 1))
      const wrapper = Function(
        helper => x => Apply(helper, Tuple(x)),
        helper
      )
      return wrapper[0] === Apply(helper, Tuple(CallArgument(0)))
        && wrapper[0][CanonicalForm] === wrapper[0]
        && wrapper[2] === Tuple(Numeric)
    }),
    test('a fully concrete call in a formed body contributes its C', () => {
      const helper = Function(() => () => Add(1, 1))
      const wrapper = Function(
        helper => () => Apply(helper, Tuple()),
        helper
      )
      return wrapper[0] === Equals(2)
    }),
    test('a symbolic Apply target demands Function', () => {
      const caller = Function(() => fn => Apply(fn, Tuple(1)))
      return caller[2] === Tuple(Function)
    }),
  ]),

  ...parserLexerSuites,
  ...parserGrammarSuites,
  ...parserAstSuites,
]
