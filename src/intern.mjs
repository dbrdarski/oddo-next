// ==========================================
// Unified Structural Interning Engine
// ==========================================

// The interner never creates a value it returns. It only decides which
// already-created reference is the canonical one: on a hit the given value
// is discarded, on a miss it is frozen and becomes canonical. Values enter
// one level at a time - children must already be interned (or primitive)
// before their container is constructed, so no walk ever recurses.

const isReferential = (value) => value !== null && (typeof value === 'object' || typeof value === 'function');

const createNode = () => ({
  primitives: new Map(),
  objects: new WeakMap(),
  ref: null
});

const root = createNode();

// A finalizer may fire late: its value died, but an equal construction may
// already occupy the slot. Clear only when the current ref is actually dead,
// so a stale finalizer can never evict a live canonical.
const finalizer = new FinalizationRegistry((leaf) => {
  leaf.ref?.deref() ?? (leaf.ref = null);
});

const step = (current, item) => {
  const map = isReferential(item) ? current.objects : current.primitives;
  let next = map.get(item);
  if (!next) {
    next = createNode();
    map.set(item, next);
  }
  return next;
};

export const canonical = (tag, parts, value) => {
  let current = step(root, tag);
  for (const part of parts) {
    // Every interned value is frozen, so an unfrozen object can never be a
    // legitimate child - it is a raw literal that skipped its constructor.
    if (part !== null && typeof part === 'object' && !Object.isFrozen(part))
      throw TypeError(`Not an interned value: ${part}`);
    current = step(current, part);
  }

  if (current.ref) {
    const cached = current.ref.deref();
    if (cached) return cached;
  }

  Object.freeze(value);
  current.ref = new WeakRef(value);
  finalizer.register(value, current);

  return value;
};

export const Tuple = (...elements) => canonical(Tuple, elements, elements);

export const Record = (obj, parts = []) => {
  for (const key of Object.keys(obj).sort()) parts.push(key, obj[key]);
  return canonical(Record, parts, obj);
};
