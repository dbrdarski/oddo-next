// ==========================================
// Facts Store
// ==========================================

// Everything the system derives about canonical references - declared
// results, solved forms, sub verdicts - lives here, keyed by the
// reference itself. Nothing is ever stored on a value or a class:
// a value is pure structure, indistinguishable fresh or analyzed.

const store = new WeakMap()

export const fact = (key, name) => store.get(key)?.[name]

export const learn = (key, name, value, facts = store.get(key)) => (
  facts ?? store.set(key, facts = Object.create(null)),
  facts[name] ??= value
)
