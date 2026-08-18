// ==========================================
// Unified Structural Interning Engine
// ==========================================

const isReferential = (value) => value !== null && (typeof value === 'object' || typeof value === 'function');

const createNode = () => ({
  primitives: new Map(),
  objects: new WeakMap(),
  ref: null
});

const arrayRoot = createNode();
const objectRoot = new WeakMap();

const finalizer = new FinalizationRegistry((leaf) => {
  leaf.ref = null;
});

const internArray = (elements) => {
  let current = arrayRoot;
  for (let i = 0; i < elements.length; i++) {
    const item = elements[i];
    const map = isReferential(item) ? current.objects : current.primitives;

    let next = map.get(item);
    if (!next) {
      next = createNode();
      map.set(item, next);
    }
    current = next;
  }

  if (current.ref) {
    const cached = current.ref.deref();
    if (cached) return cached;
  }

  Object.freeze(elements);
  current.ref = new WeakRef(elements);
  finalizer.register(elements, current);

  return elements;
};

const internObject = (obj) => {
  const keys = Object.keys(obj).sort();
  const values = keys.map(k => intern(obj[k]));

  const shapeRef = internArray(keys);
  const valuesRef = internArray(values);

  let shapeMap = objectRoot.get(shapeRef);
  if (!shapeMap) {
    shapeMap = new WeakMap();
    objectRoot.set(shapeRef, shapeMap);
  }

  let leaf = shapeMap.get(valuesRef);
  if (leaf && leaf.ref) {
    const cached = leaf.ref.deref();
    if (cached) return cached;
  }

  if (!leaf) {
    leaf = { ref: null };
    shapeMap.set(valuesRef, leaf);
  }

  const internedObj = {};
  for (let i = 0; i < shapeRef.length; i++) {
    internedObj[shapeRef[i]] = valuesRef[i];
  }
  Object.freeze(internedObj);

  leaf.ref = new WeakRef(internedObj);
  finalizer.register(internedObj, leaf);

  return internedObj;
};

export const internEnum = (constructor, elements) => {
  const internedElements = elements.map(intern);

  // Prepend constructor as the first discriminator node in the path
  const path = [constructor, ...internedElements];

  let current = arrayRoot;
  for (const item of path) {
    const map = isReferential(item) ? current.objects : current.primitives;
    let next = map.get(item);
    if (!next) {
      next = createNode();
      map.set(item, next);
    }
    current = next;
  }

  if (current.ref) {
    const cached = current.ref.deref();
    if (cached) return cached;
  }

  const instance = constructor.from(internedElements);
  Object.freeze(instance);

  current.ref = new WeakRef(instance);
  finalizer.register(instance, current);

  return instance;
};

export const intern = (value) => {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return internArray(value.map(intern));
  return internObject(value);
};
