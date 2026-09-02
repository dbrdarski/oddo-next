import { NextLexer } from './tokens.mjs'
import { nextParser } from './parser.mjs'
import { buildSurfaceAst } from './ast-builder.mjs'

export const parseCst = source => {
  const lexed = NextLexer.tokenize(source)
  nextParser.input = lexed.tokens
  const cst = nextParser.program()

  return {
    tokens: lexed.tokens,
    cst,
    lexerErrors: [...lexed.errors],
    parserErrors: [...nextParser.errors],
  }
}

export const parse = source => {
  const result = parseCst(source)
  const error = result.lexerErrors[0] ?? result.parserErrors[0]
  if (error) throw error

  const { ast, metadata } = buildSurfaceAst(result.cst, source)

  return {
    ...result,
    ast,
    metadata,
  }
}

export { NextLexer, tokens } from './tokens.mjs'
export { NextParser, nextParser } from './parser.mjs'
export { SurfaceAstBuilder, buildSurfaceAst } from './ast-builder.mjs'
