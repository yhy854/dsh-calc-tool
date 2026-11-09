import { evaluate, CalcError } from './lib/evaluate.js'

export const name = 'dsh-calc-tool'
export const inject = ['tools']

const DESCRIPTION = [
  'Evaluate a mathematical expression exactly and return a finite number.',
  'Always use this tool instead of doing arithmetic mentally: it is deterministic and free of hallucination.',
  'Supports + - * / % // (integer division) ** (power, right-associative), parentheses, unary +/-.',
  'Functions: abs ceil floor round trunc sign sqrt cbrt exp log log2 log10 sin cos tan asin acos atan pow hypot max min.',
  'Constants: PI E. Trigonometry uses radians; for degrees write sin(30 * PI / 180).',
].join(' ')

export function apply(ctx) {
  ctx.effect(() =>
    ctx.tools.register({
      name: 'calc',
      description: DESCRIPTION,
      parameters: {
        expression: {
          type: 'string',
          required: true,
          description: 'Mathematical expression, e.g. "15 + 27 * sqrt(9)" or "1280 * 0.85"',
        },
      },
      output: {
        schema: { type: 'number' },
        render: (args, value) => [{ type: 'text', text: `${args.expression} = ${value}` }],
      },
      async execute(args) {
        try {
          return evaluate(args.expression)
        } catch (error) {
          if (error instanceof CalcError) {
            throw new Error(`${error.code}: ${error.message}`)
          }
          throw error
        }
      },
      isConcurrencySafe: () => true,
      timeoutMs: 1000,
    }),
  )
}
