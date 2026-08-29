// ==========================================
// Facts Store
// ==========================================

// Current system-side facts are keyed by the relevant canonical reference.
// Nothing is attached as a property of a value or class: values remain pure
// structure, indistinguishable fresh or analyzed. Storage for future contextual
// preparation and solve associations is not prescribed here.

const store = new WeakMap()

export const Resolve = Symbol('Resolve')
export const Consumes = Symbol('Consumes')
export const Produces = Symbol('Produces')
export const Transparent = Symbol('Transparent')

export const fact = (subject, key) => store.get(subject)?.[key] ?? null

export const learn = (subject, key, value, facts = store.get(subject)) => (
  facts ?? store.set(subject, facts = Object.create(null)),
  facts[key] ??= value
)
