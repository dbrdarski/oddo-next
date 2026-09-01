import { nextParser } from './parser.mjs'

const BaseCstVisitor = nextParser.getBaseCstVisitorConstructor()

const locationOf = value => value?.span ?? value?.location ?? value

const spanFrom = (first, last = first) => {
  const start = locationOf(first)
  const end = locationOf(last)
  const endIsAlreadyExclusive = last?.span != null

  return {
    startOffset: start.startOffset,
    endOffset: end.endOffset + (endIsAlreadyExclusive ? 0 : 1),
    startLine: start.startLine,
    startColumn: start.startColumn,
    endLine: end.endLine,
    endColumn: end.endColumn + (endIsAlreadyExclusive ? 0 : 1),
  }
}

const sourceSpan = source => {
  let line = 1
  let column = 1

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (character === '\r') {
      if (source[index + 1] === '\n') index += 1
      line += 1
      column = 1
    } else if (character === '\n' || character === '\u2028' || character === '\u2029') {
      line += 1
      column = 1
    } else {
      column += 1
    }
  }

  return {
    startOffset: 0,
    endOffset: source.length,
    startLine: 1,
    startColumn: 1,
    endLine: line,
    endColumn: column,
  }
}

const syntaxError = (message, node) => {
  const error = new SyntaxError(
    `${message} at ${node.span.startLine}:${node.span.startColumn}`
  )
  error.span = node.span
  throw error
}

const decodeEscapes = text => {
  let value = ''

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (character !== '\\') {
      value += character
      continue
    }

    const escape = text[index += 1]
    const simple = {
      n: '\n',
      t: '\t',
      r: '\r',
      0: '\0',
      b: '\b',
      f: '\f',
      v: '\v',
      '\\': '\\',
      '"': '"',
      "'": "'",
      '`': '`',
      '$': '$',
    }

    if (escape in simple) {
      value += simple[escape]
    } else if (escape === 'x') {
      value += String.fromCodePoint(Number.parseInt(text.slice(index + 1, index + 3), 16))
      index += 2
    } else if (escape === 'u' && text[index + 1] === '{') {
      const close = text.indexOf('}', index + 2)
      value += String.fromCodePoint(Number.parseInt(text.slice(index + 2, close), 16))
      index = close
    } else if (escape === 'u') {
      value += String.fromCodePoint(Number.parseInt(text.slice(index + 1, index + 5), 16))
      index += 4
    }
  }

  return value
}

const bindingNames = pattern => {
  if (pattern == null) return []

  switch (pattern.type) {
    case 'BindingPattern':
      return [pattern.name.name]
    case 'TuplePattern':
      return pattern.elements.flatMap(bindingNames)
    case 'RecordPattern':
      return pattern.fields.flatMap(field => bindingNames(field.pattern ?? field))
    case 'RestPattern':
      return bindingNames(pattern.argument)
    default:
      return []
  }
}

const containsBinding = pattern => bindingNames(pattern).length > 0

const assertPatternContext = (pattern, allowPins) => {
  if (pattern == null) return

  switch (pattern.type) {
    case 'PinPattern':
      if (!allowPins) syntaxError('Pins are allowed only in arm patterns', pattern)
      return
    case 'AlternativePattern':
      pattern.alternatives.forEach(alternative =>
        assertPatternContext(alternative, allowPins))
      return
    case 'TuplePattern':
      pattern.elements.forEach(element => assertPatternContext(element, allowPins))
      return
    case 'RecordPattern':
      pattern.fields.forEach(field =>
        assertPatternContext(field.pattern ?? field, allowPins))
      return
    case 'RestPattern':
      assertPatternContext(pattern.argument, allowPins)
      return
  }
}

const assertFreshParameters = parameters => {
  const names = new Set()

  for (const parameter of parameters) {
    for (const name of bindingNames(parameter)) {
      if (names.has(name)) syntaxError(`Duplicate parameter name ${name}`, parameter)
      names.add(name)
    }
  }
}

const isNestedParameterPatternShape = expression => {
  if (expression?.type === 'NumberLiteral' ||
    expression?.type === 'StringLiteral' ||
    expression?.type === 'Identifier' ||
    expression?.type === 'HoleExpression') return true

  if (expression?.type === 'UnaryExpression') {
    return expression.operator === '-' && expression.argument.type === 'NumberLiteral'
  }

  switch (expression?.type) {
    case 'TupleExpression': {
      const rests = expression.elements.filter(element => element.type === 'SpreadElement')
      return rests.length <= 1 && expression.elements.every(element =>
        element.type === 'SpreadElement'
          ? element.argument.type === 'Identifier' ||
            element.argument.type === 'HoleExpression'
          : isNestedParameterPatternShape(element))
    }
    case 'RecordExpression': {
      const rests = expression.fields.filter(field => field.type === 'SpreadElement')
      return rests.length <= 1 && expression.fields.every(field => {
        if (field.type === 'SpreadElement') {
          return field.argument.type === 'Identifier' ||
            field.argument.type === 'HoleExpression'
        }
        return !field.computed &&
          (field.shorthand ||
            isNestedParameterPatternShape(field.value))
      })
    }
    default:
      return false
  }
}

const isSingleParameterShape = expression =>
  expression?.type === 'Identifier' ||
  expression?.type === 'TupleExpression' &&
    isNestedParameterPatternShape(expression) ||
  expression?.type === 'RecordExpression' &&
    isNestedParameterPatternShape(expression)

const isAmbiguousGuardParameterShape = expression =>
  expression.type === 'Identifier' ||
  expression.type === 'ParenthesizedExpression' &&
    isSingleParameterShape(expression.expression)

const assertUnambiguousGuard = (guard, result) => {
  if (isAmbiguousGuardParameterShape(guard) && result.type === 'ArrowFunctionExpression') {
    syntaxError(
      'Ambiguous guard/result arrows; parenthesize the intended arrow',
      { span: spanFrom(guard, result) }
    )
  }
}

const isContextualWhenAmbiguity = guard =>
  (guard.type === 'CallExpression' &&
    guard.callee.type === 'Identifier' &&
    guard.callee.name === 'when' &&
    guard.arguments.length === 1 &&
    guard.arguments[0].type !== 'SpreadElement' &&
    !guard.trailingComma) ||
  (guard.type === 'IndexExpression' &&
    !guard.optional &&
    guard.object.type === 'Identifier' &&
    guard.object.name === 'when') ||
  (guard.type === 'SliceExpression' &&
    guard.object.type === 'Identifier' &&
    guard.object.name === 'when' &&
    guard.start == null &&
    guard.end != null)

const childValues = node => Object.entries(node)
  .filter(([key]) => key !== 'type' && key !== 'span')
  .map(([, value]) => value)

const scanHaskScope = (value, holes) => {
  if (Array.isArray(value)) {
    value.forEach(item => scanHaskScope(item, holes))
    return
  }
  if (value == null || typeof value !== 'object' || value.type == null) return
  if (value.type === 'HaskExpression') return
  if (value.type === 'HoleExpression') holes.push({ node: value, rest: false })
  if (value.type === 'HaskEscapePattern') holes.push({ node: value, rest: false })
  if (value.type === 'SpreadElement' && value.argument?.type === 'HoleExpression') {
    holes.push({ node: value.argument, rest: true })
    return
  }
  childValues(value).forEach(child => scanHaskScope(child, holes))
}

const validateHask = hask => {
  const holes = []
  scanHaskScope(hask.body, holes)

  if (holes.length === 0) {
    syntaxError('A hask requires at least one hole', hask)
  }

  const fixed = new Set(
    holes.filter(hole => !hole.rest && hole.node.index != null)
      .map(hole => hole.node.index)
  )
  const plainCount = holes.filter(hole => !hole.rest && hole.node.index == null).length
  const restKeys = new Set(
    holes.filter(hole => hole.rest)
      .map(hole => hole.node.index == null ? '_' : String(hole.node.index))
  )

  if (restKeys.size > 1) {
    syntaxError('A hask may contain only one distinct rest suffix', hask)
  }

  const indexedRest = holes.find(hole => hole.rest && hole.node.index != null)?.node.index

  if (indexedRest != null && [...fixed].some(index => index >= indexedRest)) {
    syntaxError('A fixed hask hole cannot overlap its rest suffix', hask)
  }

  const occupied = new Set(fixed)
  let remainingPlain = plainCount
  const limit = indexedRest ?? (occupied.size === 0 ? 0 : Math.max(...occupied))

  for (let index = 1; index < (indexedRest ?? limit + 1); index += 1) {
    if (occupied.has(index)) continue
    if (remainingPlain === 0) {
      syntaxError('Indexed hask holes must be dense', hask)
    }
    occupied.add(index)
    remainingPlain -= 1
  }

  if (indexedRest != null && remainingPlain > 0) {
    syntaxError('A plain hask hole cannot overlap its rest suffix', hask)
  }
}

const validateHaskContexts = (value, haskDepth = 0, inArmPattern = false) => {
  if (Array.isArray(value)) {
    value.forEach(item => validateHaskContexts(item, haskDepth, inArmPattern))
    return
  }
  if (value == null || typeof value !== 'object' || value.type == null) return

  if (value.type === 'HaskExpression') {
    validateHask(value)
    validateHaskContexts(value.body, haskDepth + 1, false)
    return
  }
  if (value.type === 'HoleExpression' && haskDepth === 0) {
    syntaxError('Holes are allowed only within a hask', value)
  }
  if (value.type === 'HaskEscapePattern' && !(haskDepth > 0 && inArmPattern)) {
    syntaxError('Hask escapes are allowed only in an arm nested in a hask', value)
  }
  if (value.type === 'MatchArm') {
    validateHaskContexts(value.pattern, haskDepth, true)
    validateHaskContexts(value.guard, haskDepth, false)
    validateHaskContexts(value.result, haskDepth, false)
    return
  }

  childValues(value).forEach(child =>
    validateHaskContexts(child, haskDepth, inArmPattern))
}

const applyPipe = (head, continuation) => {
  const { operators, operands } = continuation

  if (operators[0].image === '|>') {
    let expression = head
    for (let index = 0; index < operands.length; index += 1) {
      const right = operands[index]
      expression = {
        type: 'BinaryExpression',
        operator: operators[index].image,
        left: expression,
        right,
        span: spanFrom(expression, right),
      }
    }
    return expression
  }

  const values = [head, ...operands]
  let expression = values.at(-1)
  for (let index = values.length - 2; index >= 0; index -= 1) {
    expression = {
      type: 'BinaryExpression',
      operator: operators[index].image,
      left: values[index],
      right: expression,
      span: spanFrom(values[index], expression),
    }
  }
  return expression
}

export class SurfaceAstBuilder extends BaseCstVisitor {
  constructor(source = '') {
    super()
    this.source = source
    this.validateVisitor()
  }

  program(ctx) {
    const moduleHeader = ctx.moduleHeader
      ? this.visit(ctx.moduleHeader)
      : null
    const body = (ctx.statement ?? []).map(statement => this.visit(statement))

    if (body.some(statement => statement.type === 'ExportStatement') && moduleHeader == null) {
      syntaxError('A file with exports requires a module header', body.find(
        statement => statement.type === 'ExportStatement'
      ))
    }

    const program = {
      type: 'Program',
      moduleHeader,
      body,
      span: sourceSpan(this.source),
    }
    validateHaskContexts(program)
    return program
  }

  moduleHeader(ctx) {
    const name = this.visit(ctx.dottedName)
    return {
      type: 'ModuleHeader',
      name,
      span: spanFrom(ctx.Module[0], name),
    }
  }

  dottedName(ctx) {
    const parts = ctx.part.map(token => ({
      type: 'Identifier',
      name: token.image,
      span: spanFrom(token),
    }))
    return {
      type: 'DottedName',
      parts,
      span: spanFrom(parts[0], parts.at(-1)),
    }
  }

  statement(ctx) {
    if (ctx.importStatement) return this.visit(ctx.importStatement)
    if (ctx.exportStatement) return this.visit(ctx.exportStatement)
    if (ctx.atDeclaration) return this.visit(ctx.atDeclaration)
    if (ctx.whereClause) return this.visit(ctx.whereClause)
    if (ctx.armStatement) return this.visit(ctx.armStatement)
    if (ctx.binding) return this.visit(ctx.binding)
    if (ctx.mutationStatement) return this.visit(ctx.mutationStatement)
    return this.visit(ctx.expressionStatement)
  }

  importStatement(ctx) {
    const source = this.visit(ctx.dottedName)
    const names = (ctx.imported ?? []).map(token => ({
      type: 'Identifier',
      name: token.image,
      span: spanFrom(token),
    }))
    return {
      type: 'ImportStatement',
      form: ctx.LCurly ? 'selected' : 'module',
      names,
      source,
      span: spanFrom(ctx.Import[0], source),
    }
  }

  exportStatement(ctx) {
    const declaration = this.visit(ctx.binding)
    return {
      type: 'ExportStatement',
      declaration,
      span: spanFrom(ctx.Export[0], declaration),
    }
  }

  atDeclaration(ctx) {
    const resident = {
      type: 'Identifier',
      name: ctx.resident[0].image,
      span: spanFrom(ctx.resident[0]),
    }
    const declaration = ctx.functionExpression
      ? this.visit(ctx.functionExpression)
      : this.visit(ctx.atBinding)
    return {
      type: 'AtDeclaration',
      resident,
      declaration,
      span: spanFrom(ctx.At[0], declaration),
    }
  }

  atBinding(ctx) {
    const target = this.visit(ctx.bindTarget)
    const value = this.visit(ctx.value)
    assertPatternContext(target, false)
    return {
      type: 'BindingStatement',
      target,
      value,
      span: spanFrom(target, value),
    }
  }

  whereClause(ctx) {
    const name = {
      type: 'Identifier',
      name: ctx.name[0].image,
      span: spanFrom(ctx.name[0]),
    }
    const parameters = ctx.contractList
      ? this.visit(ctx.contractList)
      : []
    const result = this.visit(ctx.result)
    return {
      type: 'WhereStatement',
      name,
      parameters,
      result,
      span: spanFrom(name, result),
    }
  }

  contractList(ctx) {
    return ctx.contract.map(contract => this.visit(contract))
  }

  binding(ctx) {
    const target = this.visit(ctx.bindTarget)
    const value = this.visit(ctx.value)
    assertPatternContext(target, false)
    return {
      type: 'BindingStatement',
      target,
      value,
      span: spanFrom(target, value),
    }
  }

  bindTarget(ctx) {
    if (ctx.name) {
      const name = {
        type: 'Identifier',
        name: ctx.name[0].image,
        span: spanFrom(ctx.name[0]),
      }
      return {
        type: 'BindingPattern',
        name,
        span: name.span,
      }
    }
    if (ctx.tuplePattern) return this.visit(ctx.tuplePattern)
    return this.visit(ctx.recordPattern)
  }

  expressionStatement(ctx) {
    const expression = this.visit(ctx.expression)
    return {
      type: 'ExpressionStatement',
      expression,
      span: expression.span,
    }
  }

  mutationStatement(ctx) {
    const target = this.visit(ctx.path)
    const operator = this.visit(ctx.mutationOperator)
    const value = this.visit(ctx.value)
    return {
      type: 'MutationStatement',
      target,
      operator,
      value,
      span: spanFrom(target, value),
    }
  }

  path(ctx) {
    let expression = {
      type: 'Identifier',
      name: ctx.root[0].image,
      span: spanFrom(ctx.root[0]),
    }
    const operations = []

    for (let index = 0; index < (ctx.field ?? []).length; index += 1) {
      operations.push({
        kind: 'member',
        startOffset: ctx.Dot[index].startOffset,
        field: ctx.field[index],
      })
    }
    for (let index = 0; index < (ctx.indexOrSlice ?? []).length; index += 1) {
      operations.push({
        kind: 'bracket',
        startOffset: ctx.LBracket[index].startOffset,
        operation: this.visit(ctx.indexOrSlice[index]),
        close: ctx.RBracket[index],
      })
    }
    operations.sort((left, right) => left.startOffset - right.startOffset)

    for (const operation of operations) {
      if (operation.kind === 'member') {
        const property = {
          type: 'Identifier',
          name: operation.field.image,
          span: spanFrom(operation.field),
        }
        expression = {
          type: 'MemberExpression',
          object: expression,
          property,
          optional: false,
          span: spanFrom(expression, property),
        }
      } else if (operation.operation.kind === 'index') {
        expression = {
          type: 'IndexExpression',
          object: expression,
          index: operation.operation.index,
          optional: false,
          span: spanFrom(expression, operation.close),
        }
      } else {
        expression = {
          type: 'SliceExpression',
          object: expression,
          start: operation.operation.lower,
          end: operation.operation.upper,
          span: spanFrom(expression, operation.close),
        }
      }
    }
    return expression
  }

  mutationOperator(ctx) {
    return Object.values(ctx).flat()[0].image
  }

  armStatement(ctx) {
    const guard = ctx.guard ? this.visit(ctx.guard) : null
    const result = this.visit(ctx.result)
    if (guard) assertUnambiguousGuard(guard, result)
    const first = ctx.When?.[0] ?? ctx.Wildcard?.[0] ?? ctx.Arrow[0]
    return {
      type: 'BlockExitStatement',
      guard,
      wildcard: ctx.Wildcard != null,
      result,
      span: spanFrom(first, result),
    }
  }

  expression(ctx) {
    return this.visit(ctx.arrowExpression)
  }

  arrowExpression(ctx) {
    if (ctx.functionExpression) return this.visit(ctx.functionExpression)
    return this.visit(ctx.matchExpression)
  }

  functionExpression(ctx) {
    const parameters = this.visit(ctx.parameters)
    const body = this.visit(ctx.arrowBody)
    const items = parameters.items
    items.forEach(parameter => assertPatternContext(parameter, false))
    assertFreshParameters(items)
    return {
      type: 'ArrowFunctionExpression',
      parameters: items,
      body,
      span: spanFrom(parameters, body),
    }
  }

  parameters(ctx) {
    if (ctx.single) {
      const name = {
        type: 'Identifier',
        name: ctx.single[0].image,
        span: spanFrom(ctx.single[0]),
      }
      const parameter = {
        type: 'BindingPattern',
        name,
        span: name.span,
      }
      return { items: [parameter], span: parameter.span }
    }
    return {
      items: ctx.parameterList ? this.visit(ctx.parameterList) : [],
      span: spanFrom(ctx.LParen[0], ctx.RParen[0]),
    }
  }

  parameterList(ctx) {
    const parameters = (ctx.parameter ?? []).map(parameter => this.visit(parameter))
    if (ctx.restParameter) parameters.push(this.visit(ctx.restParameter))
    return parameters
  }

  parameter(ctx) {
    if (ctx.name) {
      const name = {
        type: 'Identifier',
        name: ctx.name[0].image,
        span: spanFrom(ctx.name[0]),
      }
      return {
        type: 'BindingPattern',
        name,
        span: name.span,
      }
    }
    if (ctx.tuplePattern) return this.visit(ctx.tuplePattern)
    return this.visit(ctx.recordPattern)
  }

  restParameter(ctx) {
    const name = {
      type: 'Identifier',
      name: ctx.name[0].image,
      span: spanFrom(ctx.name[0]),
    }
    const argument = {
      type: 'BindingPattern',
      name,
      span: name.span,
    }
    return {
      type: 'RestPattern',
      argument,
      span: spanFrom(ctx.Ellipsis[0], argument),
    }
  }

  arrowBody(ctx) {
    if (ctx.block) return this.visit(ctx.block)
    return this.visit(ctx.expression)
  }

  block(ctx) {
    const body = (ctx.statement ?? []).map(statement => this.visit(statement))
    return {
      type: 'BlockExpression',
      body,
      span: spanFrom(ctx.LCurly[0], ctx.RCurly[0]),
    }
  }

  matchExpression(ctx) {
    let expression = this.visit(ctx.head)
    for (const segmentCst of ctx.segment ?? []) {
      const segment = this.visit(segmentCst)
      expression = {
        type: 'MatchExpression',
        value: expression,
        arms: segment.block.arms,
        span: spanFrom(expression, segment.block),
      }
      if (segment.continuation) expression = applyPipe(expression, segment.continuation)
    }
    return expression
  }

  matchSegment(ctx) {
    return {
      block: this.visit(ctx.armBlock),
      continuation: ctx.pipeContinuation
        ? this.visit(ctx.pipeContinuation)
        : null,
      span: spanFrom(ctx.Match[0], ctx.pipeContinuation?.[0] ?? ctx.armBlock[0]),
    }
  }

  pipeExpression(ctx) {
    const head = this.visit(ctx.operand)
    return ctx.pipeContinuation
      ? applyPipe(head, this.visit(ctx.pipeContinuation))
      : head
  }

  pipeContinuation(ctx) {
    const operators = ctx.operator
    const operands = ctx.operand.map(operand => this.visit(operand))
    return {
      operators,
      operands,
      span: spanFrom(operators[0], operands.at(-1)),
    }
  }

  haskExpression(ctx) {
    if (ctx.body) {
      const body = this.visit(ctx.body)
      return {
        type: 'HaskExpression',
        body,
        span: spanFrom(ctx.Hask[0], body),
      }
    }
    return this.visit(ctx.value)
  }

  ternaryExpression(ctx) {
    const condition = this.visit(ctx.condition)
    if (!ctx.then) return condition
    const consequent = this.visit(ctx.then)
    const alternate = this.visit(ctx.else)
    return {
      type: 'ConditionalExpression',
      test: condition,
      consequent,
      alternate,
      span: spanFrom(condition, alternate),
    }
  }

  nullOrExpression(ctx) {
    const operands = ctx.operand.map(operand => this.visit(operand))
    let expression = operands[0]
    for (let index = 0; index < (ctx.operator ?? []).length; index += 1) {
      const right = operands[index + 1]
      expression = {
        type: 'BinaryExpression',
        operator: ctx.operator[index].image,
        left: expression,
        right,
        span: spanFrom(expression, right),
      }
    }
    return expression
  }

  andExpression(ctx) {
    const operands = ctx.operand.map(operand => this.visit(operand))
    let expression = operands[0]
    for (let index = 0; index < (ctx.operator ?? []).length; index += 1) {
      const right = operands[index + 1]
      expression = {
        type: 'BinaryExpression',
        operator: ctx.operator[index].image,
        left: expression,
        right,
        span: spanFrom(expression, right),
      }
    }
    return expression
  }

  equalityExpression(ctx) {
    const operands = ctx.operand.map(operand => this.visit(operand))
    let expression = operands[0]
    for (let index = 0; index < (ctx.operator ?? []).length; index += 1) {
      const right = operands[index + 1]
      expression = {
        type: 'BinaryExpression',
        operator: ctx.operator[index].image,
        left: expression,
        right,
        span: spanFrom(expression, right),
      }
    }
    return expression
  }

  relationalExpression(ctx) {
    const operands = ctx.operand.map(operand => this.visit(operand))
    let expression = operands[0]
    for (let index = 0; index < (ctx.operator ?? []).length; index += 1) {
      const right = operands[index + 1]
      expression = {
        type: 'BinaryExpression',
        operator: ctx.operator[index].image,
        left: expression,
        right,
        span: spanFrom(expression, right),
      }
    }
    return expression
  }

  additiveExpression(ctx) {
    const operands = ctx.operand.map(operand => this.visit(operand))
    let expression = operands[0]
    for (let index = 0; index < (ctx.operator ?? []).length; index += 1) {
      const right = operands[index + 1]
      expression = {
        type: 'BinaryExpression',
        operator: ctx.operator[index].image,
        left: expression,
        right,
        span: spanFrom(expression, right),
      }
    }
    return expression
  }

  multiplicativeExpression(ctx) {
    const operands = ctx.operand.map(operand => this.visit(operand))
    let expression = operands[0]
    for (let index = 0; index < (ctx.operator ?? []).length; index += 1) {
      const right = operands[index + 1]
      expression = {
        type: 'BinaryExpression',
        operator: ctx.operator[index].image,
        left: expression,
        right,
        span: spanFrom(expression, right),
      }
    }
    return expression
  }

  unaryExpression(ctx) {
    if (ctx.powerExpression) return this.visit(ctx.powerExpression)
    const argument = this.visit(ctx.operand)
    return {
      type: 'UnaryExpression',
      operator: ctx.operator[0].image,
      argument,
      span: spanFrom(ctx.operator[0], argument),
    }
  }

  powerExpression(ctx) {
    const left = this.visit(ctx.left)
    if (!ctx.right) return left
    const right = this.visit(ctx.right)
    return {
      type: 'BinaryExpression',
      operator: ctx.operator[0].image,
      left,
      right,
      span: spanFrom(left, right),
    }
  }

  postfixExpression(ctx) {
    let expression = this.visit(ctx.base)
    for (const operationCst of ctx.operation ?? []) {
      const operation = this.visit(operationCst)
      if (operation.kind === 'member') {
        expression = {
          type: 'MemberExpression',
          object: expression,
          property: operation.property,
          optional: operation.optional,
          span: spanFrom(expression, operation),
        }
      } else if (operation.kind === 'index') {
        expression = {
          type: 'IndexExpression',
          object: expression,
          index: operation.index,
          optional: operation.optional,
          span: spanFrom(expression, operation),
        }
      } else if (operation.kind === 'slice') {
        expression = {
          type: 'SliceExpression',
          object: expression,
          start: operation.lower,
          end: operation.upper,
          span: spanFrom(expression, operation),
        }
      } else {
        expression = {
          type: 'CallExpression',
          callee: expression,
          arguments: operation.arguments,
          trailingComma: operation.trailingComma,
          span: spanFrom(expression, operation),
        }
      }
    }
    return expression
  }

  postfixOperation(ctx) {
    if (ctx.field) {
      const property = {
        type: 'Identifier',
        name: ctx.field[0].image,
        span: spanFrom(ctx.field[0]),
      }
      return {
        kind: 'member',
        property,
        optional: ctx.OptionalDot != null,
        span: spanFrom(ctx.Dot?.[0] ?? ctx.OptionalDot[0], property),
      }
    }
    if (ctx.index) {
      const index = this.visit(ctx.index)
      return {
        kind: 'index',
        index,
        optional: true,
        span: spanFrom(ctx.OptionalDot[0], ctx.RBracket[0]),
      }
    }
    if (ctx.indexOrSlice) {
      const operation = this.visit(ctx.indexOrSlice)
      return {
        ...operation,
        optional: false,
        span: spanFrom(ctx.LBracket[0], ctx.RBracket[0]),
      }
    }
    const list = ctx.argumentList
      ? this.visit(ctx.argumentList)
      : { items: [], trailingComma: false }
    return {
      kind: 'call',
      arguments: list.items,
      trailingComma: list.trailingComma,
      span: spanFrom(ctx.LParen[0], ctx.RParen[0]),
    }
  }

  indexOrSlice(ctx) {
    if (ctx.index) {
      return { kind: 'index', index: this.visit(ctx.index) }
    }
    return {
      kind: 'slice',
      lower: ctx.lower ? this.visit(ctx.lower) : null,
      upper: ctx.upper ? this.visit(ctx.upper) : null,
    }
  }

  argumentList(ctx) {
    return {
      items: ctx.argument.map(argument => this.visit(argument)),
      trailingComma: (ctx.Comma?.length ?? 0) === ctx.argument.length,
    }
  }

  argument(ctx) {
    const value = this.visit(ctx.value)
    if (!ctx.Ellipsis) return value
    return {
      type: 'SpreadElement',
      argument: value,
      span: spanFrom(ctx.Ellipsis[0], value),
    }
  }

  primaryExpression(ctx) {
    if (ctx.NumberLiteral) {
      const token = ctx.NumberLiteral[0]
      return {
        type: 'NumberLiteral',
        raw: token.image,
        span: spanFrom(token),
      }
    }
    if (ctx.StringLiteral) {
      const token = ctx.StringLiteral[0]
      return {
        type: 'StringLiteral',
        raw: token.image,
        value: decodeEscapes(token.image.slice(1, -1)),
        span: spanFrom(token),
      }
    }
    if (ctx.Identifier) {
      const token = ctx.Identifier[0]
      return {
        type: 'Identifier',
        name: token.image,
        span: spanFrom(token),
      }
    }
    if (ctx.Wildcard || ctx.IndexedHole) {
      const token = ctx.Wildcard?.[0] ?? ctx.IndexedHole[0]
      return {
        type: 'HoleExpression',
        index: ctx.IndexedHole ? Number(token.image.slice(1)) : null,
        span: spanFrom(token),
      }
    }
    if (ctx.templateExpression) return this.visit(ctx.templateExpression)
    if (ctx.groupedExpression) return this.visit(ctx.groupedExpression)
    if (ctx.tupleLiteral) return this.visit(ctx.tupleLiteral)
    return this.visit(ctx.recordLiteral)
  }

  groupedExpression(ctx) {
    const expression = this.visit(ctx.expression)
    return {
      type: 'ParenthesizedExpression',
      expression,
      span: spanFrom(ctx.LParen[0], ctx.RParen[0]),
    }
  }

  templateExpression(ctx) {
    return {
      type: 'TemplateLiteral',
      parts: (ctx.part ?? []).map(part => this.visit(part)),
      span: spanFrom(ctx.TemplateStart[0], ctx.TemplateEnd[0]),
    }
  }

  templatePart(ctx) {
    if (ctx.TemplateChunk) {
      const token = ctx.TemplateChunk[0]
      return {
        type: 'TemplateElement',
        raw: token.image,
        value: decodeEscapes(token.image),
        span: spanFrom(token),
      }
    }
    return this.visit(ctx.expression)
  }

  tupleLiteral(ctx) {
    return {
      type: 'TupleExpression',
      elements: ctx.elementList ? this.visit(ctx.elementList) : [],
      span: spanFrom(ctx.LBracket[0], ctx.RBracket[0]),
    }
  }

  elementList(ctx) {
    return ctx.element.map(element => this.visit(element))
  }

  element(ctx) {
    const value = this.visit(ctx.value)
    if (!ctx.Ellipsis) return value
    return {
      type: 'SpreadElement',
      argument: value,
      span: spanFrom(ctx.Ellipsis[0], value),
    }
  }

  recordLiteral(ctx) {
    const fields = ctx.fieldList ? this.visit(ctx.fieldList) : []
    const names = new Set()
    for (const field of fields) {
      if (field.type !== 'RecordField' || field.computed) continue
      if (names.has(field.key.name)) {
        syntaxError(`Duplicate record field ${field.key.name}`, field)
      }
      names.add(field.key.name)
    }
    return {
      type: 'RecordExpression',
      fields,
      span: spanFrom(ctx.LCurly[0], ctx.RCurly[0]),
    }
  }

  fieldList(ctx) {
    return ctx.field.map(field => this.visit(field))
  }

  field(ctx) {
    if (ctx.spread) {
      const argument = this.visit(ctx.spread)
      return {
        type: 'SpreadElement',
        argument,
        span: spanFrom(ctx.Ellipsis[0], argument),
      }
    }
    if (ctx.key) {
      const key = this.visit(ctx.key)
      const value = this.visit(ctx.value)
      return {
        type: 'RecordField',
        key,
        value,
        computed: true,
        shorthand: false,
        span: spanFrom(ctx.LBracket[0], value),
      }
    }
    const key = {
      type: 'Identifier',
      name: ctx.name[0].image,
      span: spanFrom(ctx.name[0]),
    }
    const value = ctx.value ? this.visit(ctx.value) : null
    return {
      type: 'RecordField',
      key,
      value,
      computed: false,
      shorthand: value == null,
      span: spanFrom(key, value ?? key),
    }
  }

  armBlock(ctx) {
    const arms = ctx.arm.map(arm => this.visit(arm))
    return {
      arms,
      span: spanFrom(ctx.LCurly[0], ctx.RCurly[0]),
    }
  }

  arm(ctx) {
    const pattern = ctx.pattern ? this.visit(ctx.pattern) : null
    const guard = ctx.guard ? this.visit(ctx.guard) : null
    const result = this.visit(ctx.result)
    if (pattern) assertPatternContext(pattern, true)
    if (guard) assertUnambiguousGuard(guard, result)
    if (pattern == null && guard && isContextualWhenAmbiguity(guard)) {
      syntaxError(
        'Ambiguous contextual when arm; parenthesize the intended guard',
        guard
      )
    }
    const first = pattern ?? ctx.When?.[0] ?? ctx.Arrow[0]
    return {
      type: 'MatchArm',
      pattern,
      guard,
      result,
      span: spanFrom(first, result),
    }
  }

  pattern(ctx) {
    const alternatives = ctx.alternative.map(alternative => this.visit(alternative))
    if (alternatives.length === 1) return alternatives[0]
    const pattern = {
      type: 'AlternativePattern',
      alternatives,
      span: spanFrom(alternatives[0], alternatives.at(-1)),
    }
    if (alternatives.some(containsBinding)) {
      syntaxError('Pattern alternatives cannot introduce bindings', pattern)
    }
    return pattern
  }

  sequencePattern(ctx) {
    if (ctx.NumberLiteral) {
      const number = ctx.NumberLiteral[0]
      const first = ctx.Minus?.[0] ?? number
      const span = spanFrom(first, number)
      return {
        type: 'LiteralPattern',
        literalKind: 'number',
        raw: this.source.slice(span.startOffset, span.endOffset),
        value: null,
        span,
      }
    }
    if (ctx.StringLiteral) {
      const token = ctx.StringLiteral[0]
      return {
        type: 'LiteralPattern',
        literalKind: 'string',
        raw: token.image,
        value: decodeEscapes(token.image.slice(1, -1)),
        span: spanFrom(token),
      }
    }
    if (ctx.Caret) {
      if (ctx.Identifier) {
        const name = {
          type: 'Identifier',
          name: ctx.Identifier[0].image,
          span: spanFrom(ctx.Identifier[0]),
        }
        return {
          type: 'PinPattern',
          name,
          span: spanFrom(ctx.Caret[0], name),
        }
      }
      const token = ctx.Wildcard?.[0] ?? ctx.IndexedHole[0]
      return {
        type: 'HaskEscapePattern',
        index: ctx.IndexedHole ? Number(token.image.slice(1)) : null,
        span: spanFrom(ctx.Caret[0], token),
      }
    }
    if (ctx.Wildcard) {
      return {
        type: 'WildcardPattern',
        span: spanFrom(ctx.Wildcard[0]),
      }
    }
    if (ctx.tuplePattern) return this.visit(ctx.tuplePattern)
    if (ctx.recordPattern) return this.visit(ctx.recordPattern)

    const token = ctx.Identifier[0]
    if (token.image === 'true' || token.image === 'false' || token.image === 'null') {
      return {
        type: 'LiteralPattern',
        literalKind: 'prelude',
        raw: token.image,
        value: token.image,
        span: spanFrom(token),
      }
    }
    const name = {
      type: 'Identifier',
      name: token.image,
      span: spanFrom(token),
    }
    if (/^[\p{Lu}\p{Lt}]/u.test(token.image)) {
      return {
        type: 'ContractPattern',
        name,
        span: name.span,
      }
    }
    return {
      type: 'BindingPattern',
      name,
      span: name.span,
    }
  }

  tuplePattern(ctx) {
    const elements = ctx.patternElementList
      ? this.visit(ctx.patternElementList)
      : []
    const rests = elements.filter(element => element.type === 'RestPattern')
    if (rests.length > 1) syntaxError('A tuple pattern may contain only one rest', rests[1])
    return {
      type: 'TuplePattern',
      elements,
      span: spanFrom(ctx.LBracket[0], ctx.RBracket[0]),
    }
  }

  patternElementList(ctx) {
    return ctx.element.map(element => this.visit(element))
  }

  patternElement(ctx) {
    if (ctx.restPattern) return this.visit(ctx.restPattern)
    return this.visit(ctx.pattern)
  }

  recordPattern(ctx) {
    const fields = ctx.patternFieldList
      ? this.visit(ctx.patternFieldList)
      : []
    const rests = fields.filter(field => field.type === 'RestPattern')
    if (rests.length > 1) syntaxError('A record pattern may contain only one rest', rests[1])
    return {
      type: 'RecordPattern',
      fields,
      span: spanFrom(ctx.LCurly[0], ctx.RCurly[0]),
    }
  }

  patternFieldList(ctx) {
    return ctx.field.map(field => this.visit(field))
  }

  patternField(ctx) {
    if (ctx.restPattern) return this.visit(ctx.restPattern)
    const key = {
      type: 'Identifier',
      name: ctx.name[0].image,
      span: spanFrom(ctx.name[0]),
    }
    const pattern = ctx.pattern
      ? this.visit(ctx.pattern)
      : {
          type: 'BindingPattern',
          name: {
            type: 'Identifier',
            name: key.name,
            span: key.span,
          },
          span: key.span,
        }
    return {
      type: 'RecordPatternField',
      key,
      pattern,
      shorthand: ctx.pattern == null,
      span: spanFrom(key, pattern),
    }
  }

  restPattern(ctx) {
    const token = ctx.Wildcard?.[0] ?? ctx.Identifier[0]
    const argument = ctx.Wildcard
      ? {
          type: 'WildcardPattern',
          span: spanFrom(token),
        }
      : {
          type: 'BindingPattern',
          name: {
            type: 'Identifier',
            name: token.image,
            span: spanFrom(token),
          },
          span: spanFrom(token),
        }
    return {
      type: 'RestPattern',
      argument,
      span: spanFrom(ctx.Ellipsis[0], argument),
    }
  }
}

export const buildSurfaceAst = (cst, source) =>
  new SurfaceAstBuilder(source).visit(cst)
