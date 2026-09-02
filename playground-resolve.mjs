// Playground-only Surface AST resolution experiment.

import { Record, Tuple } from './src/intern.mjs'
import { Add, Sub, Mul, Div } from './src/domain.mjs'

const resolvedValues = new WeakMap()

const resolveTuple = node => {
  const values = []

  for (const element of node.elements) {
    if (element.type === 'SpreadElement') return null
    const value = resolveNode(element)
    if (value == null) return null
    values.push(value)
  }

  return Tuple(...values)
}

const resolveRecord = node => {
  const entries = []

  for (const field of node.fields) {
    if (field.type !== 'RecordField' || field.computed || field.shorthand) {
      return null
    }

    const value = resolveNode(field.value)
    if (value == null) return null
    entries.push([field.key.name, value])
  }

  return Record(Object.fromEntries(entries))
}

const resolveBinary = node => {
  let operation
  switch (node.operator) {
    case '+': operation = Add; break
    case '-': operation = Sub; break
    case '*': operation = Mul; break
    case '/': operation = Div; break
    default: return null
  }

  const left = resolveNode(node.left)
  if (left == null) return null

  const right = resolveNode(node.right)
  if (right == null) return null
  return operation(left, right)
}

export const resolveNode = node => {
  if (resolvedValues.has(node)) return resolvedValues.get(node)

  let value
  try {
    switch (node.type) {
      case 'NumberLiteral':
      case 'StringLiteral':
        value = node.value
        break
      case 'ParenthesizedExpression':
        value = resolveNode(node.expression)
        break
      case 'TupleExpression':
        value = resolveTuple(node)
        break
      case 'RecordExpression':
        value = resolveRecord(node)
        break
      case 'BinaryExpression':
        value = resolveBinary(node)
        break
      default:
        return null
    }
  } catch (error) {
    if (error instanceof TypeError) return null
    throw error
  }

  if (value == null) return null
  resolvedValues.set(node, value)
  return value
}
