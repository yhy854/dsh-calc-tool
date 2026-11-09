import { evaluate } from '../lib/evaluate.js'

const numeric = [
  ['15+27*sqrt(9)', 96],
  ['1+2*3', 7],
  ['2**3**2', 512],
  ['(1+2)*3', 9],
  ['-5+3', -2],
  ['1280*0.85', 1088],
  ['17//5', 3],
  ['max(1,2,3)', 3],
  ['sin(30*PI/180)', 0.5],
  ['1.5e3+1', 1501],
  ['17 % 5', 2],
  ['hypot(3,4)', 5],
  ['log10(1000)', 3],
]

const attacks = [
  'constructor.constructor("return process")()',
  'process.exit(0)',
  'globalThis',
  '`x`',
  'a;b',
  '[]',
  '{}',
  '1;2',
  'require("fs")',
  '__proto__',
  '((((((((((((((((((((1))))))))))))))))))))',
]

let pass = 0
for (const [expr, want] of numeric) {
  const got = evaluate(expr)
  if (Math.abs(got - want) < 1e-12) pass += 1
  else console.log('FAIL', expr, '=>', got, 'want', want)
}
console.log(`numeric: ${pass}/${numeric.length}`)

let blocked = 0
for (const a of attacks) {
  try {
    const v = evaluate(a)
    console.log('NOT BLOCKED:', a, '=>', v)
  } catch {
    blocked += 1
  }
}
console.log(`blocked: ${blocked}/${attacks.length}`)

const divZero = (() => { try { evaluate('1/0'); return 'NOT BLOCKED' } catch (e) { return e.code } })()
console.log('1/0 =>', divZero)
console.log('0.1+0.2 =', evaluate('0.1+0.2'))
