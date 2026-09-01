import { createToken, Lexer } from 'chevrotain'

export const WhiteSpace = createToken({
  name: 'WhiteSpace',
  pattern: /[^\S\r\n\u2028\u2029]+/u,
  group: Lexer.SKIPPED,
})

export const Newline = createToken({
  name: 'Newline',
  pattern: /\r\n|\r|\n|\u2028|\u2029/,
  group: Lexer.SKIPPED,
  line_breaks: true,
})

export const LineComment = createToken({
  name: 'LineComment',
  pattern: /\/\/[^\r\n\u2028\u2029]*/,
  group: Lexer.SKIPPED,
})

export const BlockComment = createToken({
  name: 'BlockComment',
  pattern: /\/\*(?:[^*]|\*(?!\/))*\*\//,
  group: Lexer.SKIPPED,
  line_breaks: true,
})

const identifierPattern = /\p{ID_Start}(?:(?![_$])\p{ID_Continue})*/uy

// Chevrotain's regexp analyzer does not preserve Unicode property escapes when
// it prepares its optimized matcher, so this one lexical rule uses the custom
// pattern hook while retaining the same anchored Unicode regexp.
const matchIdentifier = {
  exec(text, offset) {
    identifierPattern.lastIndex = offset
    return identifierPattern.exec(text)
  },
}

// Ordinary identifiers use Unicode identifier classes while reserving both
// underscore and dollar for NEXT's hole and interpolation syntax.
export const Identifier = createToken({
  name: 'Identifier',
  pattern: matchIdentifier,
  line_breaks: false,
})

// These words are contextual. The Identifier category lets the parser consume
// any of them in an ordinary identifier seat without changing their token kind.
export const Module = createToken({
  name: 'Module',
  pattern: /module/,
  longer_alt: Identifier,
  categories: [Identifier],
})

export const Import = createToken({
  name: 'Import',
  pattern: /import/,
  longer_alt: Identifier,
  categories: [Identifier],
})

export const Export = createToken({
  name: 'Export',
  pattern: /export/,
  longer_alt: Identifier,
  categories: [Identifier],
})

export const From = createToken({
  name: 'From',
  pattern: /from/,
  longer_alt: Identifier,
  categories: [Identifier],
})

export const When = createToken({
  name: 'When',
  pattern: /when/,
  longer_alt: Identifier,
  categories: [Identifier],
})

export const Where = createToken({
  name: 'Where',
  pattern: /where/,
  longer_alt: Identifier,
  categories: [Identifier],
})

export const NumberLiteral = createToken({
  name: 'NumberLiteral',
  pattern: /(?:0[xX][0-9a-fA-F](?:_?[0-9a-fA-F])*|0[oO][0-7](?:_?[0-7])*|0[bB][01](?:_?[01])*|(?:(?:0|[1-9](?:_?[0-9])*)(?:\.[0-9](?:_?[0-9])*)?|\.[0-9](?:_?[0-9])*)(?:[eE][+-]?[0-9](?:_?[0-9])*)?)/,
})

export const StringLiteral = createToken({
  name: 'StringLiteral',
  pattern: /"(?:[^"\\\r\n\u2028\u2029]|\\(?:[ntrbfv\\"']|0(?![0-9])|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|u\{0*(?:[0-9a-fA-F]{1,5}|10[0-9a-fA-F]{4})\}))*"/,
})

export const IndexedHole = createToken({
  name: 'IndexedHole',
  pattern: /_[1-9][0-9]*/,
})

export const Wildcard = createToken({
  name: 'Wildcard',
  pattern: /_/,
})

export const TemplateStart = createToken({
  name: 'TemplateStart',
  pattern: /`/,
  push_mode: 'template',
})

export const TemplateEnd = createToken({
  name: 'TemplateEnd',
  pattern: /`/,
  pop_mode: true,
})

export const InterpolationStart = createToken({
  name: 'InterpolationStart',
  pattern: /\$\{/,
  push_mode: 'interpolation',
})

export const TemplateChunk = createToken({
  name: 'TemplateChunk',
  pattern:
    /(?:[^\\`$]|\$(?!\{)|\\(?:[ntrbfv\\"'`]|0(?![0-9])|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|u\{0*(?:[0-9a-fA-F]{1,5}|10[0-9a-fA-F]{4})\}|\$\{))+/,
  line_breaks: true,
})

export const PowerMutate = createToken({ name: 'PowerMutate', pattern: /\*\*:=/ })
export const AndMutate = createToken({ name: 'AndMutate', pattern: /&&:=/ })
export const OrMutate = createToken({ name: 'OrMutate', pattern: /\|\|:=/ })
export const NullishMutate = createToken({ name: 'NullishMutate', pattern: /\?\?:=/ })
export const PlusMutate = createToken({ name: 'PlusMutate', pattern: /\+:=/ })
export const MinusMutate = createToken({ name: 'MinusMutate', pattern: /-:=/ })
export const StarMutate = createToken({ name: 'StarMutate', pattern: /\*:=/ })
export const SlashMutate = createToken({ name: 'SlashMutate', pattern: /\/:=/ })
export const PercentMutate = createToken({ name: 'PercentMutate', pattern: /%:=/ })

export const Ellipsis = createToken({ name: 'Ellipsis', pattern: /\.\.\./ })
export const Arrow = createToken({ name: 'Arrow', pattern: /=>/ })
export const Match = createToken({ name: 'Match', pattern: /::/ })
export const PipeForward = createToken({ name: 'PipeForward', pattern: /\|>/ })
export const PipeBackward = createToken({ name: 'PipeBackward', pattern: /<\|/ })
export const OptionalDot = createToken({ name: 'OptionalDot', pattern: /\?\.(?![0-9])/ })
export const Nullish = createToken({ name: 'Nullish', pattern: /\?\?/ })
export const Or = createToken({ name: 'Or', pattern: /\|\|/ })
export const And = createToken({ name: 'And', pattern: /&&/ })
export const Equal = createToken({ name: 'Equal', pattern: /==/ })
export const NotEqual = createToken({ name: 'NotEqual', pattern: /!=/ })
export const LessEqual = createToken({ name: 'LessEqual', pattern: /<=/ })
export const GreaterEqual = createToken({ name: 'GreaterEqual', pattern: />=/ })
export const Concat = createToken({ name: 'Concat', pattern: /\+\+/ })
export const Power = createToken({ name: 'Power', pattern: /\*\*/ })
export const Mutate = createToken({ name: 'Mutate', pattern: /:=/ })

export const Hask = createToken({ name: 'Hask', pattern: /#/ })
export const Question = createToken({ name: 'Question', pattern: /\?/ })
export const Colon = createToken({ name: 'Colon', pattern: /:/ })
export const Less = createToken({ name: 'Less', pattern: /</ })
export const Greater = createToken({ name: 'Greater', pattern: />/ })
export const Plus = createToken({ name: 'Plus', pattern: /\+/ })
export const Minus = createToken({ name: 'Minus', pattern: /-/ })
export const Star = createToken({ name: 'Star', pattern: /\*/ })
export const Slash = createToken({ name: 'Slash', pattern: /\// })
export const Percent = createToken({ name: 'Percent', pattern: /%/ })
export const Bang = createToken({ name: 'Bang', pattern: /!/ })
export const Tilde = createToken({ name: 'Tilde', pattern: /~/ })
export const Dot = createToken({ name: 'Dot', pattern: /\./ })
export const LBracket = createToken({ name: 'LBracket', pattern: /\[/ })
export const RBracket = createToken({ name: 'RBracket', pattern: /\]/ })
export const LParen = createToken({ name: 'LParen', pattern: /\(/ })
export const RParen = createToken({ name: 'RParen', pattern: /\)/ })
export const LCurly = createToken({ name: 'LCurly', pattern: /\{/ })
export const RCurly = createToken({ name: 'RCurly', pattern: /\}/ })
export const Comma = createToken({ name: 'Comma', pattern: /,/ })
export const Assign = createToken({ name: 'Assign', pattern: /=/ })
export const At = createToken({ name: 'At', pattern: /@/ })
export const Caret = createToken({ name: 'Caret', pattern: /\^/ })
export const Alternative = createToken({ name: 'Alternative', pattern: /\|/ })

// In interpolation mode, braces use the ordinary brace categories while the
// lexer mode stack itself records nested brace depth.
export const InterpolationLCurly = createToken({
  name: 'InterpolationLCurly',
  pattern: /\{/,
  categories: [LCurly],
  push_mode: 'interpolation',
})

export const InterpolationRCurly = createToken({
  name: 'InterpolationRCurly',
  pattern: /\}/,
  categories: [RCurly],
  pop_mode: true,
})

export const identifierTokenTypes = [
  Identifier,
  Module,
  Import,
  Export,
  From,
  When,
  Where,
]

export const tokens = {
  WhiteSpace,
  Newline,
  LineComment,
  BlockComment,
  Identifier,
  Module,
  Import,
  Export,
  From,
  When,
  Where,
  NumberLiteral,
  StringLiteral,
  IndexedHole,
  Wildcard,
  TemplateStart,
  TemplateEnd,
  InterpolationStart,
  TemplateChunk,
  PowerMutate,
  AndMutate,
  OrMutate,
  NullishMutate,
  PlusMutate,
  MinusMutate,
  StarMutate,
  SlashMutate,
  PercentMutate,
  Ellipsis,
  Arrow,
  Match,
  PipeForward,
  PipeBackward,
  OptionalDot,
  Nullish,
  Or,
  And,
  Equal,
  NotEqual,
  LessEqual,
  GreaterEqual,
  Concat,
  Power,
  Mutate,
  Hask,
  Question,
  Colon,
  Less,
  Greater,
  Plus,
  Minus,
  Star,
  Slash,
  Percent,
  Bang,
  Tilde,
  Dot,
  LBracket,
  RBracket,
  LParen,
  RParen,
  LCurly,
  RCurly,
  Comma,
  Assign,
  At,
  Caret,
  Alternative,
  InterpolationLCurly,
  InterpolationRCurly,
}

const defaultMode = [
  WhiteSpace,
  Newline,
  LineComment,
  BlockComment,
  Module,
  Import,
  Export,
  From,
  When,
  Where,
  Identifier,
  NumberLiteral,
  StringLiteral,
  IndexedHole,
  Wildcard,
  TemplateStart,
  PowerMutate,
  AndMutate,
  OrMutate,
  NullishMutate,
  PlusMutate,
  MinusMutate,
  StarMutate,
  SlashMutate,
  PercentMutate,
  Ellipsis,
  Arrow,
  Match,
  PipeForward,
  PipeBackward,
  OptionalDot,
  Nullish,
  Or,
  And,
  Equal,
  NotEqual,
  LessEqual,
  GreaterEqual,
  Concat,
  Power,
  Mutate,
  Hask,
  Question,
  Colon,
  Less,
  Greater,
  Plus,
  Minus,
  Star,
  Slash,
  Percent,
  Bang,
  Tilde,
  Dot,
  LBracket,
  RBracket,
  LParen,
  RParen,
  LCurly,
  RCurly,
  Comma,
  Assign,
  At,
  Caret,
  Alternative,
]

const interpolationMode = [
  WhiteSpace,
  Newline,
  LineComment,
  BlockComment,
  Module,
  Import,
  Export,
  From,
  When,
  Where,
  Identifier,
  NumberLiteral,
  StringLiteral,
  IndexedHole,
  Wildcard,
  TemplateStart,
  PowerMutate,
  AndMutate,
  OrMutate,
  NullishMutate,
  PlusMutate,
  MinusMutate,
  StarMutate,
  SlashMutate,
  PercentMutate,
  Ellipsis,
  Arrow,
  Match,
  PipeForward,
  PipeBackward,
  OptionalDot,
  Nullish,
  Or,
  And,
  Equal,
  NotEqual,
  LessEqual,
  GreaterEqual,
  Concat,
  Power,
  Mutate,
  Hask,
  Question,
  Colon,
  Less,
  Greater,
  Plus,
  Minus,
  Star,
  Slash,
  Percent,
  Bang,
  Tilde,
  Dot,
  LBracket,
  RBracket,
  LParen,
  RParen,
  InterpolationLCurly,
  InterpolationRCurly,
  Comma,
  Assign,
  At,
  Caret,
  Alternative,
]

export const lexerDefinition = {
  modes: {
    default_mode: defaultMode,
    template: [
      TemplateEnd,
      InterpolationStart,
      TemplateChunk,
    ],
    interpolation: interpolationMode,
  },
  defaultMode: 'default_mode',
}

export const allTokens = Object.values(tokens)

export const NextLexer = new Lexer(lexerDefinition, {
  positionTracking: 'full',
  lineTerminatorsPattern: /\r\n|[\n\r\u2028\u2029]/g,
  lineTerminatorCharacters: ['\n', '\r', '\u2028', '\u2029'],
})
