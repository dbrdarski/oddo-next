export const Canonical = Symbol('Canonical')

export let isCanonicalCtx = false

export const canonicalContext = operation => {
  const previous = isCanonicalCtx
  isCanonicalCtx = true

  try { return operation() }
  finally { isCanonicalCtx = previous }
}
