// ==========================================
// Test Cases (environment-agnostic)
// ==========================================

// Each case states a design goal and returns true when it holds.
// Red rows are goals the design has not landed yet, not regressions:
// the pending suite documents exactly where the work stands.

import { Tuple, Record } from '../src/intern.mjs'
import { instanceOf, producedOf } from '../src/contract.mjs'
import { fact, learn, Resolve, Produces, Transparent } from '../src/facts.mjs'
import { Enum, createEnums, mapEnum } from '../src/enum.mjs'
import { match, matchDomain, Combine, _ } from '../src/match.mjs'
import { Number, Indeterminate, ZeroDivision, ZeroMod } from '../src/numeric.mjs'
import {
  Add, Sub, Mul, Div, LL, Numeric, Union, Intersection, Difference, Equals, Range,
  Top as DomainTop, Bottom, Null, canonicalizeDomain
} from '../src/domain.mjs'
import {
  OuterRef, CallArgument, MatchArgument, Apply, Arm, Match, Lambda,
  argumentCountOf, internFn, expand
} from '../src/function.mjs'
import { Preparation, prepare as prepareProduction } from '../src/prepare.mjs'
import {
  Expanded,
  Accepted,
  ResultContract,
  Canonical,
  Top,
  prepare,
} from './contextual-prepare.model.mjs'

const suite = (title, cases) => ({ title, cases })
const test = (label, run) => ({ label, run })
const throws = (run) => { try { run(); return false } catch { return true } }
const isUnionOf = (candidate, left, right) =>
  candidate instanceof Union && match(Tuple(...candidate))(
    ($, [a, b]) => Combine(a, b)((a, b) =>
      a === left && b === right || a === right && b === left)
  )
const armFor = (candidate, region) =>
  candidate[1].find(arm => arm[0] === region)

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

const expandedZeroMul = (zeroFirst = true) => {
  const self = OuterRef(0)
  const dependency = CallArgument(0, self)
  const body = zeroFirst ? Mul(0, dependency) : Mul(dependency, 0)
  const form = Lambda(1, 1, body)
  return expand(internFn(form, form))
}

export const suites = [

  suite('Interning engine', [
    test('Tuple(1, 2) === Tuple(1, 2)', () => Tuple(1, 2) === Tuple(1, 2)),
    test('tuples are frozen Tuple arrays', () => {
      const tuple = Tuple(1, 2)
      return Object.isFrozen(tuple)
        && tuple instanceof Tuple
        && tuple instanceof Array
        && tuple.constructor === Tuple
    }),
    test('a single Number remains a Tuple element', () =>
      Tuple(0).length === 1
        && Tuple(0)[0] === 0
        && Tuple(0) !== Tuple()
        && Tuple(2) !== Tuple(undefined, undefined)),
    test('Record key-order independence', () => Record({ a: 1, b: 2 }) === Record({ b: 2, a: 1 })),
    test('Record copies __proto__ as an own data property', () => {
      const props = Object.create(null)
      props.__proto__ = 1
      const record = Record(props)
      return record instanceof Record
        && Object.getPrototypeOf(record) === Record.prototype
        && Object.hasOwn(record, '__proto__')
        && record.__proto__ === 1
    }),
    test('empty record is canonical', () => Record({}) === Record({})),
    test('children pass through untouched', () => { const t = Tuple(1, 2); return Record({ x: t }).x === t }),
    test('deep nesting is canonical', () => Record({ x: Tuple(1, Tuple(2, 3)) }) === Record({ x: Tuple(1, Tuple(2, 3)) })),
    test('raw object child is rejected at the door', () => throws(() => Record({ x: { raw: 1 } }))),
    test('raw array child is rejected at the door', () => throws(() => Tuple([1, 2]))),
  ]),

  suite('Facts store', [
    test('built-in fact keys are shared Symbols', () =>
      [Resolve, Produces, Transparent].every(key => typeof key === 'symbol')),
    test('equal Symbol descriptions remain distinct fact keys', () => {
      const subject = Tuple('fact subject')
      const first = Symbol('Fact')
      const second = Symbol('Fact')
      learn(subject, first, 1)
      learn(subject, second, 2)
      learn(subject, first, 3)
      return fact(subject, first) === 1 && fact(subject, second) === 2
    }),
    test('declared results are stored under the shared Produces key', () => {
      const node = Add(1, 2)
      return fact(node.constructor, Produces) === Numeric
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

  suite('Preparation judgments', [
    test('Preparation retains its six ruled fields canonically', () => {
      const self = OuterRef(0)
      const expanded = Mul(0, CallArgument(0, self))
      const obligations = Tuple()
      const prepared = Preparation(
        expanded,
        Number,
        Number,
        Equals(0),
        obligations,
        0
      )
      return prepared === Preparation(
        expanded,
        Number,
        Number,
        Equals(0),
        obligations,
        0
      )
        && prepared instanceof Preparation
        && prepared[0] === expanded
        && prepared[1] === Number
        && prepared[2] === Number
        && prepared[3] === Equals(0)
        && prepared[4] === obligations
        && prepared[5] === 0
    }),
    test('Preparation uses the ordinary structural matcher', () => {
      const expanded = Mul(0, CallArgument(0, OuterRef(0)))
      const prepared = Preparation(
        expanded,
        Number,
        Number,
        Equals(0),
        Tuple(),
        0
      )
      return match(prepared)(
        ($, [E, context, accepted, result, obligations, C]) =>
          $(Preparation(E, context, accepted, result, obligations, C))(
            (matchedE, matchedContext, matchedAccepted, matchedResult, matchedObligations, matchedC) =>
              matchedE === expanded
                && matchedContext === Number
                && matchedAccepted === Number
                && matchedResult === Equals(0)
                && matchedObligations === Tuple()
                && matchedC === 0
          )
      )
    }),
    test('Preparation enforces its concrete field contracts and arity', () => {
      const expanded = Mul(0, CallArgument(0, OuterRef(0)))
      const valid = [expanded, Number, Number, Equals(0), Tuple(), 0]
      return throws(() => Preparation(...valid.slice(0, 5)))
        && throws(() => Preparation(...valid, 1))
        && throws(() => Preparation(expanded, 1, Number, Equals(0), Tuple(), 0))
        && throws(() => Preparation(expanded, Number, 1, Equals(0), Tuple(), 0))
        && throws(() => Preparation(expanded, Number, Number, 1, Tuple(), 0))
        && throws(() => Preparation(expanded, _, Number, Equals(0), Tuple(), 0))
        && throws(() => Preparation(expanded, Number, _, Equals(0), Tuple(), 0))
        && throws(() => Preparation(expanded, Number, Number, _, Tuple(), 0))
        && throws(() => Preparation(expanded, Number, Number, Equals(0), [], 0))
        && throws(() => Preparation(
          expanded,
          Number,
          Number,
          Equals(0),
          Object.freeze([]),
          0
        ))
    }),
  ]),

  suite('Contextual preparation', [
    test('Number preparation retains E and collapses C to zero', () => {
      const expanded = expandedZeroMul()
      const prepared = prepareProduction(expanded)(Number)
      return prepared === prepareProduction(expanded)(Number)
        && prepared[0] === expanded
        && prepared[1] === Number
        && prepared[2] === Number
        && prepared[3] === Equals(0)
        && prepared[4] === Tuple()
        && prepared[5] === 0
    }),
    test('a nonrecursive call expands into retained E before C is derived', () => {
      const helperSelf = OuterRef(0)
      const helperForm = Lambda(1, 1, CallArgument(0, helperSelf))
      const helper = internFn(helperForm, helperForm)

      const rootSelf = OuterRef(0)
      const rootForm = Lambda(1, 1, Mul(
        0,
        Apply(helper, Tuple(CallArgument(0, rootSelf)))
      ))
      const root = internFn(rootForm, rootForm)
      const E = expand(root)
      const prepared = prepareProduction(E)(Number)

      return E === Mul(0, CallArgument(0, root))
        && prepared === Preparation(
          E,
          Number,
          Number,
          Equals(0),
          Tuple(),
          0
        )
    }),
    test('zero multiplication uses Combine across operand order', () => {
      const zeroFirst = expandedZeroMul()
      const zeroLast = expandedZeroMul(false)
      const first = prepareProduction(zeroFirst)(Number)
      const last = prepareProduction(zeroLast)(Number)
      return first[0] === zeroFirst
        && last[0] === zeroLast
        && first[5] === 0
        && last[5] === 0
        && first !== last
    }),
    test('the non-Number remainder preserves the Indeterminate operation', () => {
      const expanded = expandedZeroMul()
      const context = Difference(DomainTop, Number)
      const prepared = prepareProduction(expanded)(context)
      return prepared[0] === expanded
        && prepared[1] === context
        && prepared[2] === Indeterminate
        && prepared[3] === Indeterminate
        && prepared[4] === Tuple()
        && prepared[5] === expanded
    }),
    test('the non-Number judgment admits only Indeterminate values', () => {
      const context = Difference(DomainTop, Number)
      const accepted = prepareProduction(expandedZeroMul())(context)[2]
      return new ZeroDivision(1) instanceof accepted
        && !(Numeric(1) instanceof accepted)
        && !(Add(1, 2) instanceof accepted)
    }),
    test('the first slice rejects contexts it has not ruled', () => {
      const expanded = expandedZeroMul()
      return throws(() => prepareProduction(expanded)(Tuple(Number)))
        && throws(() => prepareProduction(expanded)(_))
        && throws(() => prepareProduction(expanded)(Indeterminate))
        && throws(() => prepareProduction(expanded)(DomainTop))
    }),
    test('the first slice requires argument zero of a known unary owner', () => {
      const unary = internFn(Lambda(0, 1, 0))
      const binary = internFn(Lambda(0, 2, 0))
      return throws(() => prepareProduction(
        Mul(0, CallArgument(1, unary))
      )(Number))
        && throws(() => prepareProduction(
          Mul(0, CallArgument(0, binary))
        )(Number))
        && throws(() => prepareProduction(
          Mul(0, CallArgument(0, OuterRef(0)))
        )(Number))
    }),
    test('unsupported expressions do not acquire invented judgments', () => {
      const dependency = expandedZeroMul()[1]
      return throws(() => prepareProduction(Mul(0, 0))(Number))
        && throws(() => prepareProduction(Add(0, dependency))(Number))
    }),
  ]),

  suite('Enum nodes', [
    test('Enum membership uses registered constructors', () =>
      Add(1, 2) instanceof Enum
        && Null instanceof Enum
        && !(Tuple(1, 2) instanceof Enum)),
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
    test('valueOf retains the complete Indeterminate form', () => {
      const value = new ZeroMod(2)
      return value.valueOf() === value
    }),
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
    test('Equals forwards its value through Range Number seats', () =>
      Range(Equals(1), Equals(2)) === Range(Equals(1), Equals(2))),
    test('membership: 50 in Range(0, 100)', () => 50 instanceof Range(0, 100)),
    test('membership: 200 not in Range(0, 100)', () => !(200 instanceof Range(0, 100))),
    test('a Tuple is not in a Range (no coercion)', () => !(Tuple(50) instanceof Range(0, 100))),
  ]),

  suite('Raw literals, Union, LL - landed with the result-slot design', [
    test('Add(1, 2) with raw literals', () => String(Add(1, 2)) === 'Add(1, 2)'),
    test('Add(1, Mul(2, Sub(5, 3))) with raw literals', () =>
      Add(1, Mul(2, Sub(5, 3))) === Add(1, Mul(2, Sub(5, 3)))),
    test('Union rejects values where it requires contract branches', () =>
      throws(() => Union(Numeric(1), Numeric(2)))),
    test('LL(Numeric(1), Null) - result-stage thread', () =>
      String(LL(Numeric(1), Null)) === 'LL(Numeric(1), Null())'),
  ]),

  suite('Top, Bottom, and Null', [
    test('Top Bottom and Null are canonical Enum values', () =>
      [DomainTop, Bottom, Null].every(value =>
        Array.isArray(value)
          && value.constructor !== Array
          && Object.isFrozen(value)
          && mapEnum(value, part => part) === value
      )
        && DomainTop.constructor !== Bottom.constructor
        && Bottom.constructor !== Null.constructor
        && String(DomainTop) === 'Top()'
        && String(Bottom) === 'Bottom()'
        && String(Null) === 'Null()'),
    test('Top admits language values', () =>
      1 instanceof DomainTop && Null instanceof DomainTop),
    test('Top rejects raw host nullish values', () =>
      !(null instanceof DomainTop) && !(undefined instanceof DomainTop)),
    test('Bottom admits no value', () =>
      !(1 instanceof Bottom) && !(Null instanceof Bottom)),
    test('Null is its own value and contract', () => Null instanceof Null),
    test('raw host nullish values are not language Null', () =>
      !(null instanceof Null) && !(undefined instanceof Null)),
    test('Union(Null, Number) replaces Optional membership', () =>
      Null instanceof Union(Null, Number) && 1 instanceof Union(Null, Number)),
    test('LL uses an explicit Null terminator', () =>
      LL(1, Null) === LL(1, Null)),
    test('LL nests through its recursive tail contract', () =>
      LL(1, LL(2, Null)) === LL(1, LL(2, Null))),
    test('LL rejects an omitted or raw host-nullish tail', () =>
      throws(() => LL(1)) &&
      throws(() => LL(1, null)) &&
      throws(() => LL(1, undefined))),
  ]),

  suite('Region contract Enums', [
    test('Intersection is an interned contract value', () => {
      const region = Intersection(Number, Range(0, 10))
      return region === Intersection(Number, Range(0, 10))
        && 5 instanceof region
        && !(20 instanceof region)
    }),
    test('Difference is an ordered interned contract value', () => {
      const region = Difference(Number, Equals(0))
      return region === Difference(Number, Equals(0))
        && region !== Difference(Equals(0), Number)
        && 1 instanceof region
        && !(0 instanceof region)
    }),
    test('binary region Enums require exactly two contracts', () =>
      [Union, Intersection, Difference].every(factory =>
        throws(() => factory()) &&
        throws(() => factory(Number)) &&
        throws(() => factory(Number, Number, Number)) &&
        throws(() => factory(1, Number))
      )),
    test('wildcard syntax cannot become a stored region branch', () =>
      [Union, Intersection, Difference].every(factory =>
        throws(() => factory(_, Number)) && throws(() => factory(Number, _))
      )),
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

  suite('Contextual preparation reference model', [
    test('one expanded expression can occupy two arm contexts', () => {
      const self = OuterRef(0)
      const argument = CallArgument(0, self)
      const expanded = Mul(0, argument)
      const written = Match(argument, Tuple(
        Arm(Number, expanded),
        Arm(_, expanded)
      ))
      return written[1][0][1] === expanded && written[1][1][1] === expanded
    }),
    test('Number context produces zero without replacing the expanded form', () => {
      const self = OuterRef(0)
      const expanded = Mul(0, CallArgument(0, self))
      const analysis = prepare(expanded)(Number)
      return analysis[Expanded] === expanded
        && analysis[Accepted] === Number
        && analysis[ResultContract] === Equals(0)
        && analysis[Canonical] === 0
    }),
    test('Indeterminate context preserves the unresolved expanded operation', () => {
      const self = OuterRef(0)
      const expanded = Mul(0, CallArgument(0, self))
      const analysis = prepare(expanded)(Indeterminate)
      return analysis[Expanded] === expanded
        && analysis[Accepted] === Indeterminate
        && analysis[ResultContract] === Indeterminate
        && analysis[Canonical] === expanded
    }),
    test('a guarded arm retains Number while its body becomes zero', () => {
      const self = OuterRef(0)
      const argument = CallArgument(0, self)
      const expanded = Mul(0, argument)
      const written = Match(argument, Tuple(Arm(Number, expanded)))
      const analysis = prepare(written)(Top)
      return analysis[Accepted] === Number
        && analysis[ResultContract] === Equals(0)
        && analysis[Canonical] instanceof Match
        && analysis[Canonical][1].length === 1
        && analysis[Canonical][1][0][0] === Number
        && analysis[Canonical][1][0][1] === 0
    }),
    test('an unguarded arm derives Numeric from its body', () => {
      const self = OuterRef(0)
      const argument = CallArgument(0, self)
      const expanded = Mul(0, argument)
      const written = Match(argument, Tuple(Arm(_, expanded)))
      const analysis = prepare(written)(Top)
      const numberArm = armFor(analysis[Canonical], Number)
      const indeterminateArm = armFor(analysis[Canonical], Indeterminate)
      return analysis[Accepted] === Numeric
        && isUnionOf(analysis[ResultContract], Equals(0), Indeterminate)
        && analysis[Canonical] instanceof Match
        && analysis[Canonical][1].length === 2
        && numberArm?.[1] === 0
        && indeterminateArm?.[1] === expanded
    }),
    test('Match passes its exact remainder to the later arm', () => {
      const self = OuterRef(0)
      const argument = CallArgument(0, self)
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
      const self = OuterRef(0)
      const argument = CallArgument(0, self)
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
      const self = OuterRef(0)
      const expanded = Mul(0, CallArgument(0, self))
      const multiplied = prepare(expanded)(Top)
      const constant = prepare(0)(Top)
      return multiplied[Accepted] === Numeric
        && constant[Accepted] === Top
        && constant[ResultContract] === Equals(0)
        && multiplied[Canonical] !== constant[Canonical]
    }),
    test('call erasure is rejected until obligations are represented', () => {
      const self = OuterRef(0)
      const form = Lambda(1, 1, CallArgument(0, self))
      const fn = internFn(form, form)
      const call = Apply(fn, Tuple(CallArgument(0, fn)))
      return throws(() => prepare(Mul(0, call))(Number))
    }),
    test('a call cannot disappear as an unanalyzed Match scrutinee', () => {
      const self = OuterRef(0)
      const form = Lambda(1, 1, CallArgument(0, self))
      const fn = internFn(form, form)
      const call = Apply(fn, Tuple(CallArgument(0, fn)))
      const written = Match(call, Tuple(Arm(_, 0)))
      return throws(() => prepare(written)(Top))
    }),
    test('a Match region cannot leak into a different argument dependency', () => {
      const self = OuterRef(0)
      const matched = CallArgument(0, self)
      const other = CallArgument(1, self)
      const written = Match(matched, Tuple(Arm(Number, Mul(0, other))))
      return throws(() => prepare(written)(Top))
    }),
    test('the one-argument scaffold rejects wrapped and wildcard contexts', () => {
      const self = OuterRef(0)
      const expanded = Mul(0, CallArgument(0, self))
      return throws(() => prepare(expanded)(Tuple(Top, Number)))
        && throws(() => prepare(expanded)(Tuple(Top)))
        && throws(() => prepare(expanded)(_))
    }),
    test('explicit disjoint arms and the direct expression reach one mapping', () => {
      const self = OuterRef(0)
      const argument = CallArgument(0, self)
      const expanded = Mul(0, argument)
      const written = Match(argument, Tuple(
        Arm(Number, expanded),
        Arm(_, expanded)
      ))
      return prepare(written)(Top)[Canonical]
        === prepare(expanded)(Top)[Canonical]
    }),
    test('restricting the same expression agrees with its complete mapping', () => {
      const self = OuterRef(0)
      const argument = CallArgument(0, self)
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
    test('Equals forwards its value through semantic instanceof', () =>
      Equals(6).valueOf() === 6
        && instanceOf(Equals(6), Number)
        && instanceOf(Equals(6), Numeric)),
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
    test('known function owners expose their argument count', () => {
      const form = Lambda(0, 2, 0)
      const fn = internFn(form)
      return argumentCountOf(form) === 2
        && argumentCountOf(fn) === 2
        && argumentCountOf(OuterRef(0)) === undefined
    }),
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
      const form = Lambda(1, 1, LL(CallArgument(0, self), Null))
      const fn = internFn(form, form)
      return expand(fn) === LL(CallArgument(0, fn), Null)
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
