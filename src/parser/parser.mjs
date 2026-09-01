import { CstParser, EOF, tokenMatcher } from 'chevrotain'
import { allTokens, tokens } from './tokens.mjs'

const {
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
  InterpolationRCurly,
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
} = tokens

const residentNames = new Set([
  'state',
  'mutable',
  'mutate',
  'effect',
  'computed',
  'reactive',
])

export class NextParser extends CstParser {
  constructor() {
    super(allTokens, {
      recoveryEnabled: false,
      nodeLocationTracking: 'full',
      maxLookahead: 2,
    })

    const $ = this

    $.RULE('program', () => {
      $.OPTION({
        GATE: () => $.isModuleHeaderAhead(),
        DEF: () => $.SUBRULE($.moduleHeader),
      })
      $.MANY({
        GATE: () => !$.is(EOF) && $.startsFollowingStatement(),
        DEF: () => $.SUBRULE($.statement),
      })
    })

    $.RULE('moduleHeader', () => {
      $.CONSUME(Module)
      $.SUBRULE($.dottedName)
    })

    $.RULE('dottedName', () => {
      $.CONSUME(Identifier, { LABEL: 'part' })
      $.MANY(() => {
        $.CONSUME(Dot)
        $.CONSUME2(Identifier, { LABEL: 'part' })
      })
    })

    $.RULE('statement', (allowBlockExit = false) => {
      $.OR([
        {
          GATE: () => $.isImportAhead(),
          ALT: () => $.SUBRULE($.importStatement),
        },
        {
          GATE: () => $.isExportAhead(),
          ALT: () => $.SUBRULE($.exportStatement),
        },
        {
          GATE: () => $.is(At) && $.isResident(2),
          ALT: () => $.SUBRULE($.atDeclaration),
        },
        {
          GATE: () => $.isWhereAhead(),
          ALT: () => $.SUBRULE($.whereClause),
        },
        {
          GATE: () => allowBlockExit &&
            $.isBlockExitAhead() &&
            $.startsOnLaterLine(),
          ALT: () => $.SUBRULE($.armStatement),
        },
        {
          GATE: () => $.isBindingAhead(),
          ALT: () => $.SUBRULE($.binding),
        },
        {
          GATE: () => $.isMutationAhead(),
          ALT: () => $.SUBRULE($.mutationStatement),
        },
        { ALT: () => $.SUBRULE($.expressionStatement) },
      ])
    })

    $.RULE('importStatement', () => {
      $.CONSUME(Import)
      $.OR([
        {
          GATE: () => $.is(LCurly),
          ALT: () => {
            $.CONSUME(LCurly)
            $.CONSUME(Identifier, { LABEL: 'imported' })
            $.MANY(() => {
              $.CONSUME(Comma)
              $.CONSUME2(Identifier, { LABEL: 'imported' })
            })
            $.OPTION(() => $.CONSUME2(Comma))
            $.CONSUME(RCurly)
            $.CONSUME(From)
            $.SUBRULE($.dottedName)
          },
        },
        { ALT: () => $.SUBRULE2($.dottedName) },
      ])
    })

    $.RULE('exportStatement', () => {
      $.CONSUME(Export)
      $.SUBRULE($.binding)
    })

    $.RULE('atDeclaration', () => {
      $.CONSUME(At)
      $.CONSUME(Identifier, { LABEL: 'resident' })
      $.OR([
        {
          GATE: () => $.LA(0).image === 'reactive' && $.isArrowAhead(),
          ALT: () => $.SUBRULE($.functionExpression, { ARGS: [true] }),
        },
        { ALT: () => $.SUBRULE($.atBinding) },
      ])
    })

    $.RULE('atBinding', () => {
      $.SUBRULE($.bindTarget)
      $.CONSUME(Assign)
      $.SUBRULE($.expression, { ARGS: [true], LABEL: 'value' })
    })

    $.RULE('whereClause', () => {
      $.CONSUME(Identifier, { LABEL: 'name' })
      $.CONSUME(Where)
      $.CONSUME(LParen)
      $.OPTION(() => $.SUBRULE($.contractList))
      $.CONSUME(RParen)
      $.CONSUME(Arrow)
      $.SUBRULE($.expression, { LABEL: 'result' })
    })

    $.RULE('contractList', () => {
      $.SUBRULE($.expression, { LABEL: 'contract' })
      $.MANY(() => {
        $.CONSUME(Comma)
        $.SUBRULE2($.expression, { LABEL: 'contract' })
      })
      $.OPTION(() => $.CONSUME2(Comma))
    })

    $.RULE('binding', () => {
      $.SUBRULE($.bindTarget)
      $.CONSUME(Assign)
      $.SUBRULE($.expression, { LABEL: 'value' })
    })

    $.RULE('bindTarget', () => {
      $.OR([
        { ALT: () => $.CONSUME(Identifier, { LABEL: 'name' }) },
        { ALT: () => $.SUBRULE($.tuplePattern) },
        { ALT: () => $.SUBRULE($.recordPattern) },
      ])
    })

    $.RULE('expressionStatement', () => {
      $.SUBRULE($.expression)
    })

    $.RULE('mutationStatement', () => {
      $.SUBRULE($.path)
      $.SUBRULE($.mutationOperator)
      $.SUBRULE($.expression, { LABEL: 'value' })
    })

    $.RULE('path', () => {
      $.CONSUME(Identifier, { LABEL: 'root' })
      $.MANY(() => {
        $.OR([
          {
            ALT: () => {
              $.CONSUME(Dot)
              $.CONSUME2(Identifier, { LABEL: 'field' })
            },
          },
          {
            ALT: () => {
              $.CONSUME(LBracket)
              $.SUBRULE($.indexOrSlice)
              $.CONSUME(RBracket)
            },
          },
        ])
      })
    })

    $.RULE('mutationOperator', () => {
      $.OR([
        { ALT: () => $.CONSUME(Mutate) },
        { ALT: () => $.CONSUME(PlusMutate) },
        { ALT: () => $.CONSUME(MinusMutate) },
        { ALT: () => $.CONSUME(StarMutate) },
        { ALT: () => $.CONSUME(SlashMutate) },
        { ALT: () => $.CONSUME(PercentMutate) },
        { ALT: () => $.CONSUME(PowerMutate) },
        { ALT: () => $.CONSUME(AndMutate) },
        { ALT: () => $.CONSUME(OrMutate) },
        { ALT: () => $.CONSUME(NullishMutate) },
      ])
    })

    $.RULE('armStatement', () => {
      $.OR([
        {
          GATE: () => $.is(When),
          ALT: () => {
            $.CONSUME(When)
            $.SUBRULE($.matchExpression, { LABEL: 'guard' })
            $.CONSUME(Arrow)
            $.SUBRULE($.expression, { LABEL: 'result' })
          },
        },
        {
          ALT: () => {
            $.OPTION(() => $.CONSUME(Wildcard))
            $.CONSUME2(Arrow)
            $.SUBRULE2($.expression, { LABEL: 'result' })
          },
        },
      ])
    })

    $.RULE('expression', (privilegedArrowBody = false) => {
      $.SUBRULE($.arrowExpression, { ARGS: [privilegedArrowBody] })
    })

    $.RULE('arrowExpression', (privilegedArrowBody = false) => {
      $.OR([
        {
          GATE: () => $.isArrowAhead(),
          ALT: () => $.SUBRULE($.functionExpression, {
            ARGS: [privilegedArrowBody],
          }),
        },
        { ALT: () => $.SUBRULE($.matchExpression) },
      ])
    })

    $.RULE('functionExpression', (privilegedArrowBody = false) => {
      $.SUBRULE($.parameters)
      $.CONSUME(Arrow)
      $.SUBRULE($.arrowBody, { ARGS: [privilegedArrowBody] })
    })

    $.RULE('parameters', () => {
      $.OR([
        { ALT: () => $.CONSUME(Identifier, { LABEL: 'single' }) },
        {
          ALT: () => {
            $.CONSUME(LParen)
            $.OPTION(() => $.SUBRULE($.parameterList))
            $.CONSUME(RParen)
          },
        },
      ])
    })

    $.RULE('parameterList', () => {
      $.OR([
        {
          GATE: () => $.is(Ellipsis),
          ALT: () => {
            $.SUBRULE($.restParameter)
            $.OPTION(() => $.CONSUME(Comma))
          },
        },
        {
          ALT: () => {
            $.SUBRULE($.parameter, { LABEL: 'parameter' })
            $.MANY({
              GATE: () => $.is(Comma) &&
                !$.is(RParen, 2) &&
                !$.is(Ellipsis, 2),
              DEF: () => {
                $.CONSUME2(Comma)
                $.SUBRULE2($.parameter, { LABEL: 'parameter' })
              },
            })
            $.OPTION2({
              GATE: () => $.is(Comma) && $.is(Ellipsis, 2),
              DEF: () => {
                $.CONSUME3(Comma)
                $.SUBRULE2($.restParameter)
              },
            })
            $.OPTION3(() => $.CONSUME4(Comma))
          },
        },
      ])
    })

    $.RULE('parameter', () => {
      $.OR([
        { ALT: () => $.CONSUME(Identifier, { LABEL: 'name' }) },
        { ALT: () => $.SUBRULE($.tuplePattern) },
        { ALT: () => $.SUBRULE($.recordPattern) },
      ])
    })

    $.RULE('restParameter', () => {
      $.CONSUME(Ellipsis)
      $.CONSUME(Identifier, { LABEL: 'name' })
    })

    $.RULE('arrowBody', (privilegedArrowBody = false) => {
      $.OR([
        {
          GATE: () => $.is(LCurly) &&
            (privilegedArrowBody || !$.isRecordBraceAhead()),
          ALT: () => $.SUBRULE($.block),
        },
        { ALT: () => $.SUBRULE($.expression) },
      ])
    })

    $.RULE('block', () => {
      $.CONSUME(LCurly)
      $.MANY({
        GATE: () => !$.is(RCurly) && $.startsFollowingBlockStatement(),
        DEF: () => $.SUBRULE($.statement, { ARGS: [true] }),
      })
      $.CONSUME(RCurly)
    })

    $.RULE('matchExpression', () => {
      $.SUBRULE($.pipeExpression, { LABEL: 'head' })
      $.MANY(() => $.SUBRULE($.matchSegment, { LABEL: 'segment' }))
    })

    $.RULE('matchSegment', () => {
      $.CONSUME(Match)
      $.SUBRULE($.armBlock)
      $.OPTION(() => $.SUBRULE($.pipeContinuation))
    })

    $.RULE('pipeExpression', () => {
      $.SUBRULE($.haskExpression, { LABEL: 'operand' })
      $.OPTION(() => $.SUBRULE($.pipeContinuation))
    })

    $.RULE('pipeContinuation', () => {
      $.OR([
        {
          GATE: () => $.is(PipeForward),
          ALT: () => $.AT_LEAST_ONE(() => {
            $.CONSUME(PipeForward, { LABEL: 'operator' })
            $.SUBRULE($.haskExpression, { LABEL: 'operand' })
          }),
        },
        {
          ALT: () => $.AT_LEAST_ONE2(() => {
            $.CONSUME(PipeBackward, { LABEL: 'operator' })
            $.SUBRULE2($.haskExpression, { LABEL: 'operand' })
          }),
        },
      ])
    })

    $.RULE('haskExpression', () => {
      $.OR([
        {
          ALT: () => {
            $.CONSUME(Hask)
            $.SUBRULE($.ternaryExpression, { LABEL: 'body' })
          },
        },
        { ALT: () => $.SUBRULE2($.ternaryExpression, { LABEL: 'value' }) },
      ])
    })

    $.RULE('ternaryExpression', () => {
      $.SUBRULE($.nullOrExpression, { LABEL: 'condition' })
      $.OPTION(() => {
        $.CONSUME(Question)
        $.SUBRULE($.ternaryExpression, { LABEL: 'then' })
        $.CONSUME(Colon)
        $.SUBRULE2($.ternaryExpression, { LABEL: 'else' })
      })
    })

    $.RULE('nullOrExpression', () => {
      $.SUBRULE($.andExpression, { LABEL: 'operand' })
      $.MANY(() => {
        $.OR([
          { ALT: () => $.CONSUME(Nullish, { LABEL: 'operator' }) },
          { ALT: () => $.CONSUME(Or, { LABEL: 'operator' }) },
        ])
        $.SUBRULE2($.andExpression, { LABEL: 'operand' })
      })
    })

    $.RULE('andExpression', () => {
      $.SUBRULE($.equalityExpression, { LABEL: 'operand' })
      $.MANY(() => {
        $.CONSUME(And, { LABEL: 'operator' })
        $.SUBRULE2($.equalityExpression, { LABEL: 'operand' })
      })
    })

    $.RULE('equalityExpression', () => {
      $.SUBRULE($.relationalExpression, { LABEL: 'operand' })
      $.MANY(() => {
        $.OR([
          { ALT: () => $.CONSUME(Equal, { LABEL: 'operator' }) },
          { ALT: () => $.CONSUME(NotEqual, { LABEL: 'operator' }) },
        ])
        $.SUBRULE2($.relationalExpression, { LABEL: 'operand' })
      })
    })

    $.RULE('relationalExpression', () => {
      $.SUBRULE($.additiveExpression, { LABEL: 'operand' })
      $.MANY(() => {
        $.OR([
          { ALT: () => $.CONSUME(Less, { LABEL: 'operator' }) },
          { ALT: () => $.CONSUME(LessEqual, { LABEL: 'operator' }) },
          { ALT: () => $.CONSUME(Greater, { LABEL: 'operator' }) },
          { ALT: () => $.CONSUME(GreaterEqual, { LABEL: 'operator' }) },
        ])
        $.SUBRULE2($.additiveExpression, { LABEL: 'operand' })
      })
    })

    $.RULE('additiveExpression', () => {
      $.SUBRULE($.multiplicativeExpression, { LABEL: 'operand' })
      $.MANY({
        GATE: () => !$.startsFollowingArm(),
        DEF: () => {
          $.OR([
            { ALT: () => $.CONSUME(Plus, { LABEL: 'operator' }) },
            { ALT: () => $.CONSUME(Minus, { LABEL: 'operator' }) },
            { ALT: () => $.CONSUME(Concat, { LABEL: 'operator' }) },
          ])
          $.SUBRULE2($.multiplicativeExpression, { LABEL: 'operand' })
        },
      })
    })

    $.RULE('multiplicativeExpression', () => {
      $.SUBRULE($.unaryExpression, { LABEL: 'operand' })
      $.MANY(() => {
        $.OR([
          { ALT: () => $.CONSUME(Star, { LABEL: 'operator' }) },
          { ALT: () => $.CONSUME(Slash, { LABEL: 'operator' }) },
          { ALT: () => $.CONSUME(Percent, { LABEL: 'operator' }) },
        ])
        $.SUBRULE2($.unaryExpression, { LABEL: 'operand' })
      })
    })

    $.RULE('unaryExpression', () => {
      $.OR([
        {
          GATE: () => $.is(Minus) || $.is(Bang) || $.is(Tilde),
          ALT: () => {
            $.OR2([
              { ALT: () => $.CONSUME(Minus, { LABEL: 'operator' }) },
              { ALT: () => $.CONSUME(Bang, { LABEL: 'operator' }) },
              { ALT: () => $.CONSUME(Tilde, { LABEL: 'operator' }) },
            ])
            $.SUBRULE($.unaryExpression, { LABEL: 'operand' })
          },
        },
        { ALT: () => $.SUBRULE($.powerExpression) },
      ])
    })

    $.RULE('powerExpression', () => {
      $.SUBRULE($.postfixExpression, { LABEL: 'left' })
      $.OPTION(() => {
        $.CONSUME(Power, { LABEL: 'operator' })
        $.SUBRULE($.unaryExpression, { LABEL: 'right' })
      })
    })

    $.RULE('postfixExpression', () => {
      $.SUBRULE($.primaryExpression, { LABEL: 'base' })
      $.MANY({
        GATE: () => $.continuesPostfixExpression(),
        DEF: () => $.SUBRULE($.postfixOperation, { LABEL: 'operation' }),
      })
    })

    $.RULE('postfixOperation', () => {
      $.OR([
        {
          ALT: () => {
            $.CONSUME(Dot)
            $.CONSUME(Identifier, { LABEL: 'field' })
          },
        },
        {
          GATE: () => $.is(OptionalDot) && $.is(LBracket, 2),
          ALT: () => {
            $.CONSUME(OptionalDot)
            $.CONSUME(LBracket)
            $.SUBRULE($.expression, { LABEL: 'index' })
            $.CONSUME(RBracket)
          },
        },
        {
          ALT: () => {
            $.CONSUME2(OptionalDot)
            $.CONSUME2(Identifier, { LABEL: 'field' })
          },
        },
        {
          ALT: () => {
            $.CONSUME2(LBracket)
            $.SUBRULE($.indexOrSlice)
            $.CONSUME2(RBracket)
          },
        },
        {
          ALT: () => {
            $.CONSUME(LParen)
            $.OPTION(() => $.SUBRULE($.argumentList))
            $.CONSUME(RParen)
          },
        },
      ])
    })

    $.RULE('indexOrSlice', () => {
      $.OR([
        {
          GATE: () => $.hasTopLevelEllipsisBeforeBracketClose(),
          ALT: () => {
            $.OPTION({
              GATE: () => !$.is(Ellipsis),
              DEF: () => $.SUBRULE($.expression, { LABEL: 'lower' }),
            })
            $.CONSUME(Ellipsis)
            $.OPTION2({
              GATE: () => !$.is(RBracket),
              DEF: () => $.SUBRULE2($.expression, { LABEL: 'upper' }),
            })
          },
        },
        { ALT: () => $.SUBRULE3($.expression, { LABEL: 'index' }) },
      ])
    })

    $.RULE('argumentList', () => {
      $.SUBRULE($.argument, { LABEL: 'argument' })
      $.MANY({
        GATE: () => $.is(Comma) && !$.is(RParen, 2),
        DEF: () => {
          $.CONSUME(Comma)
          $.SUBRULE2($.argument, { LABEL: 'argument' })
        },
      })
      $.OPTION(() => $.CONSUME2(Comma))
    })

    $.RULE('argument', () => {
      $.OR([
        {
          ALT: () => {
            $.CONSUME(Ellipsis)
            $.SUBRULE($.expression, { LABEL: 'value' })
          },
        },
        { ALT: () => $.SUBRULE2($.expression, { LABEL: 'value' }) },
      ])
    })

    $.RULE('primaryExpression', () => {
      $.OR([
        { ALT: () => $.CONSUME(NumberLiteral) },
        { ALT: () => $.CONSUME(StringLiteral) },
        { ALT: () => $.SUBRULE($.templateExpression) },
        { ALT: () => $.CONSUME(Identifier) },
        { ALT: () => $.CONSUME(Wildcard) },
        { ALT: () => $.CONSUME(IndexedHole) },
        { ALT: () => $.SUBRULE($.groupedExpression) },
        { ALT: () => $.SUBRULE($.tupleLiteral) },
        { ALT: () => $.SUBRULE($.recordLiteral) },
      ])
    })

    $.RULE('groupedExpression', () => {
      $.CONSUME(LParen)
      $.SUBRULE($.expression)
      $.CONSUME(RParen)
    })

    $.RULE('templateExpression', () => {
      $.CONSUME(TemplateStart)
      $.MANY(() => $.SUBRULE($.templatePart, { LABEL: 'part' }))
      $.CONSUME(TemplateEnd)
    })

    $.RULE('templatePart', () => {
      $.OR([
        { ALT: () => $.CONSUME(TemplateChunk) },
        {
          ALT: () => {
            $.CONSUME(InterpolationStart)
            $.SUBRULE($.expression)
            $.CONSUME(InterpolationRCurly)
          },
        },
      ])
    })

    $.RULE('tupleLiteral', () => {
      $.CONSUME(LBracket)
      $.OPTION(() => $.SUBRULE($.elementList))
      $.CONSUME(RBracket)
    })

    $.RULE('elementList', () => {
      $.SUBRULE($.element, { LABEL: 'element' })
      $.MANY({
        GATE: () => $.is(Comma) && !$.is(RBracket, 2),
        DEF: () => {
          $.CONSUME(Comma)
          $.SUBRULE2($.element, { LABEL: 'element' })
        },
      })
      $.OPTION(() => $.CONSUME2(Comma))
    })

    $.RULE('element', () => {
      $.OR([
        {
          ALT: () => {
            $.CONSUME(Ellipsis)
            $.SUBRULE($.expression, { LABEL: 'value' })
          },
        },
        { ALT: () => $.SUBRULE2($.expression, { LABEL: 'value' }) },
      ])
    })

    $.RULE('recordLiteral', () => {
      $.CONSUME(LCurly)
      $.OPTION(() => $.SUBRULE($.fieldList))
      $.CONSUME(RCurly)
    })

    $.RULE('fieldList', () => {
      $.SUBRULE($.field, { LABEL: 'field' })
      $.MANY({
        GATE: () => $.is(Comma) && !$.is(RCurly, 2),
        DEF: () => {
          $.CONSUME(Comma)
          $.SUBRULE2($.field, { LABEL: 'field' })
        },
      })
      $.OPTION(() => $.CONSUME2(Comma))
    })

    $.RULE('field', () => {
      $.OR([
        {
          ALT: () => {
            $.CONSUME(Ellipsis)
            $.SUBRULE($.expression, { LABEL: 'spread' })
          },
        },
        {
          ALT: () => {
            $.CONSUME(LBracket)
            $.SUBRULE2($.expression, { LABEL: 'key' })
            $.CONSUME(RBracket)
            $.CONSUME(Colon)
            $.SUBRULE3($.expression, { LABEL: 'value' })
          },
        },
        {
          ALT: () => {
            $.CONSUME(Identifier, { LABEL: 'name' })
            $.OPTION(() => {
              $.CONSUME2(Colon)
              $.SUBRULE4($.expression, { LABEL: 'value' })
            })
          },
        },
      ])
    })

    $.RULE('armBlock', () => {
      $.CONSUME(LCurly)
      $.AT_LEAST_ONE({
        GATE: () => $.startsOnLaterLine(),
        DEF: () => $.SUBRULE($.arm, { LABEL: 'arm' }),
      })
      $.CONSUME(RCurly)
    })

    $.RULE('arm', () => {
      $.OPTION({
        GATE: () => !$.is(Arrow) &&
          !$.isGuardOnlyArmAhead(),
        DEF: () => $.SUBRULE($.pattern),
      })
      $.OPTION2(() => {
        $.CONSUME(When)
        $.SUBRULE($.matchExpression, { LABEL: 'guard' })
      })
      $.CONSUME(Arrow)
      $.SUBRULE($.expression, { LABEL: 'result' })
    })

    $.RULE('pattern', () => {
      $.SUBRULE($.sequencePattern, { LABEL: 'alternative' })
      $.MANY(() => {
        $.CONSUME(Alternative)
        $.SUBRULE2($.sequencePattern, { LABEL: 'alternative' })
      })
    })

    $.RULE('sequencePattern', () => {
      $.OR([
        {
          GATE: () => $.is(Minus) && $.is(NumberLiteral, 2),
          ALT: () => {
            $.CONSUME(Minus)
            $.CONSUME(NumberLiteral)
          },
        },
        { ALT: () => $.CONSUME2(NumberLiteral) },
        { ALT: () => $.CONSUME(StringLiteral) },
        {
          ALT: () => {
            $.CONSUME(Caret)
            $.OR2([
              { ALT: () => $.CONSUME(Identifier) },
              { ALT: () => $.CONSUME(Wildcard) },
              { ALT: () => $.CONSUME(IndexedHole) },
            ])
          },
        },
        { ALT: () => $.CONSUME2(Wildcard) },
        { ALT: () => $.SUBRULE($.tuplePattern) },
        { ALT: () => $.SUBRULE($.recordPattern) },
        { ALT: () => $.CONSUME2(Identifier) },
      ])
    })

    $.RULE('tuplePattern', () => {
      $.CONSUME(LBracket)
      $.OPTION(() => $.SUBRULE($.patternElementList))
      $.CONSUME(RBracket)
    })

    $.RULE('patternElementList', () => {
      $.SUBRULE($.patternElement, { LABEL: 'element' })
      $.MANY({
        GATE: () => $.is(Comma) && !$.is(RBracket, 2),
        DEF: () => {
          $.CONSUME(Comma)
          $.SUBRULE2($.patternElement, { LABEL: 'element' })
        },
      })
      $.OPTION(() => $.CONSUME2(Comma))
    })

    $.RULE('patternElement', () => {
      $.OR([
        { ALT: () => $.SUBRULE($.restPattern) },
        { ALT: () => $.SUBRULE($.pattern) },
      ])
    })

    $.RULE('recordPattern', () => {
      $.CONSUME(LCurly)
      $.OPTION(() => $.SUBRULE($.patternFieldList))
      $.CONSUME(RCurly)
    })

    $.RULE('patternFieldList', () => {
      $.SUBRULE($.patternField, { LABEL: 'field' })
      $.MANY({
        GATE: () => $.is(Comma) && !$.is(RCurly, 2),
        DEF: () => {
          $.CONSUME(Comma)
          $.SUBRULE2($.patternField, { LABEL: 'field' })
        },
      })
      $.OPTION(() => $.CONSUME2(Comma))
    })

    $.RULE('patternField', () => {
      $.OR([
        { ALT: () => $.SUBRULE($.restPattern) },
        {
          ALT: () => {
            $.CONSUME(Identifier, { LABEL: 'name' })
            $.OPTION(() => {
              $.CONSUME(Colon)
              $.SUBRULE($.pattern)
            })
          },
        },
      ])
    })

    $.RULE('restPattern', () => {
      $.CONSUME(Ellipsis)
      $.OR([
        { ALT: () => $.CONSUME(Wildcard) },
        { ALT: () => $.CONSUME(Identifier) },
      ])
    })

    this.performSelfAnalysis()
  }

  is(tokenType, offset = 1) {
    return tokenMatcher(this.LA(offset), tokenType)
  }

  isResident(offset) {
    return this.is(Identifier, offset) && residentNames.has(this.LA(offset).image)
  }

  startsOnLaterLine() {
    const previous = this.LA(0)
    const next = this.LA(1)
    return Number.isFinite(previous.endLine) &&
      Number.isFinite(next.startLine) &&
      next.startLine > previous.endLine
  }

  startsFollowingStatement() {
    return this.is(EOF, 0) || this.startsOnLaterLine()
  }

  startsFollowingBlockStatement() {
    return this.is(LCurly, 0) || this.startsOnLaterLine()
  }

  isModuleHeaderAhead() {
    return this.is(Module) && this.is(Identifier, 2)
  }

  isImportAhead() {
    return this.is(Import) &&
      (this.is(LCurly, 2) || this.is(Identifier, 2))
  }

  isExportAhead() {
    return this.is(Export) && this.isBindingAhead(2)
  }

  isWhereAhead() {
    return this.is(Identifier) && this.is(Where, 2) && this.is(LParen, 3)
  }

  isBlockExitAhead() {
    return this.is(Arrow) ||
      (this.is(Wildcard) && this.is(Arrow, 2)) ||
      this.isGuardOnlyArmAhead()
  }

  isBindingAhead(offset = 1) {
    if (this.is(Identifier, offset)) return this.is(Assign, offset + 1)
    if (!this.is(LBracket, offset) && !this.is(LCurly, offset)) return false
    const close = this.matchingDelimiterOffset(offset)
    return close !== null && this.is(Assign, close + 1)
  }

  isMutationAhead() {
    if (!this.is(Identifier)) return false
    let offset = 2
    while (true) {
      if (this.is(Dot, offset) && this.is(Identifier, offset + 1)) {
        offset += 2
        continue
      }
      if (this.is(LBracket, offset)) {
        const close = this.matchingDelimiterOffset(offset)
        if (close === null) return false
        offset = close + 1
        continue
      }
      break
    }
    return [
      Mutate,
      PlusMutate,
      MinusMutate,
      StarMutate,
      SlashMutate,
      PercentMutate,
      PowerMutate,
      AndMutate,
      OrMutate,
      NullishMutate,
    ].some(tokenType => this.is(tokenType, offset))
  }

  isArrowAhead(offset = 1) {
    if (this.is(Identifier, offset)) {
      return this.is(Arrow, offset + 1) &&
        this.sameLine(offset, offset + 1)
    }
    if (!this.is(LParen, offset)) return false
    const close = this.matchingDelimiterOffset(offset)
    return close !== null &&
      this.is(Arrow, close + 1) &&
      this.sameLine(close, close + 1)
  }

  sameLine(leftOffset, rightOffset) {
    return this.LA(leftOffset).endLine === this.LA(rightOffset).startLine
  }

  matchingDelimiterOffset(offset) {
    const opening = this.LA(offset)
    const pairs = new Map([
      [LParen, RParen],
      [LBracket, RBracket],
      [LCurly, RCurly],
    ])
    let openingType = null
    for (const candidate of pairs.keys()) {
      if (tokenMatcher(opening, candidate)) openingType = candidate
    }
    if (openingType === null) return null
    const closingType = pairs.get(openingType)
    let depth = 0
    for (let cursor = offset; ; cursor += 1) {
      const token = this.LA(cursor)
      if (tokenMatcher(token, EOF)) return null
      if (tokenMatcher(token, openingType)) depth += 1
      if (tokenMatcher(token, closingType)) {
        depth -= 1
        if (depth === 0) return cursor
      }
    }
  }

  isGuardOnlyArmAhead() {
    return this.is(When) && this.BACKTRACK(this.armStatement).call(this)
  }

  startsFollowingArm() {
    return this.startsOnLaterLine() &&
      (this.is(Minus) || this.is(LBracket)) &&
      this.BACKTRACK(this.arm).call(this)
  }

  continuesPostfixExpression() {
    if (!this.startsOnLaterLine()) return true
    if (this.is(LParen) && this.isArrowAhead()) return false
    if (!this.is(LBracket)) return true
    if (this.startsFollowingArm() || this.isBindingAhead()) return false
    return this.BACKTRACK(this.postfixOperation).call(this)
  }

  isRecordBraceAhead() {
    if (!this.is(LCurly)) return false
    if (this.is(RCurly, 2) || this.is(Ellipsis, 2)) return true
    if (this.is(Identifier, 2)) {
      return this.is(Colon, 3) || this.is(Comma, 3) || this.is(RCurly, 3)
    }
    if (!this.is(LBracket, 2)) return false
    const close = this.matchingDelimiterOffset(2)
    return close !== null && this.is(Colon, close + 1)
  }

  hasTopLevelEllipsisBeforeBracketClose() {
    const stack = []
    for (let offset = 1; ; offset += 1) {
      const token = this.LA(offset)
      if (tokenMatcher(token, EOF)) return false
      if (stack.length === 0 && tokenMatcher(token, RBracket)) return false
      if (stack.length === 0 && tokenMatcher(token, Ellipsis)) return true
      if (tokenMatcher(token, LParen)) stack.push(RParen)
      else if (tokenMatcher(token, LBracket)) stack.push(RBracket)
      else if (tokenMatcher(token, LCurly)) stack.push(RCurly)
      else if (stack.length > 0 && tokenMatcher(token, stack.at(-1))) stack.pop()
    }
  }
}

export const nextParser = new NextParser()
