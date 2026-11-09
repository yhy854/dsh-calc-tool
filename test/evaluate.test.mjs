import { evaluate, CalcError } from '../lib/evaluate.js'

let pass = 0
let fail = 0

function ok(name, fn) {
  try {
    fn()
    pass += 1
  } catch (error) {
    fail += 1
    console.error(`FAIL ${name}: ${error.message}`)
  }
}

function eq(name, expr, want, tol = 1e-12) {
  ok(name, () => {
    const got = evaluate(expr)
    if (Math.abs(got - want) > tol) {
      throw new Error(`${expr} => ${got}, want ${want}`)
    }
  })
}

function throws(name, expr, code) {
  ok(name, () => {
    try {
      const value = evaluate(expr)
      throw new Error(`${expr} returned ${value}, expected ${code}`)
    } catch (error) {
      if (!(error instanceof CalcError)) throw error
      if (error.code !== code) throw new Error(`${expr} => ${error.code}, want ${code}`)
    }
  })
}

// ---- 数值正确性 ----
eq('加法', '1+2*3', 7)
eq('括号', '(1+2)*3', 9)
eq('幂右结合', '2**3**2', 512)
eq('空格式', '15 + 27 * sqrt(9)', 96)
eq('一元负号', '-5+3', -2)
eq('浮点乘法', '1280*0.85', 1088)
eq('整除', '17//5', 3)
eq('取模', '17 % 5', 2)
eq('多参 max', 'max(1,2,3)', 3)
eq('弧度三角', 'sin(30*PI/180)', 0.5)
eq('科学计数法', '1.5e3+1', 1501)
eq('hypot', 'hypot(3,4)', 5)
eq('log10', 'log10(1000)', 3)
eq('负指数', '2**-1', 0.5)
eq('长加法', Array.from({ length: 500 }, (_, i) => i).join('+'), 124750)

// ---- 安全：攻击载荷必须全部拦截 ----
throws('构造器链', 'constructor.constructor("return process")()', 'CALC_UNKNOWN_IDENTIFIER')
throws('process', 'process.exit(0)', 'CALC_UNKNOWN_IDENTIFIER')
throws('globalThis', 'globalThis', 'CALC_UNKNOWN_IDENTIFIER')
throws('require', 'require("fs")', 'CALC_UNKNOWN_IDENTIFIER')
throws('原型链', '__proto__', 'CALC_UNKNOWN_IDENTIFIER')
throws('模板字符串', '`x`', 'CALC_PARSE_ERROR')
throws('分号注入', '1;2', 'CALC_PARSE_ERROR')
throws('变量语句', 'a;b', 'CALC_UNKNOWN_IDENTIFIER')
throws('方括号', '[]', 'CALC_PARSE_ERROR')
throws('花括号', '{}', 'CALC_PARSE_ERROR')
throws('除零', '1/0', 'CALC_DIVIDE_BY_ZERO')
throws('取模零', '5%0', 'CALC_DIVIDE_BY_ZERO')
throws('负开方', 'sqrt(-1)', 'CALC_NOT_FINITE')
throws('溢出', '1e308*10', 'CALC_NOT_FINITE')
throws('函数当值用', 'sqrt', 'CALC_UNKNOWN_IDENTIFIER')

// ---- 原型污染专项（回归测试）----
throws('__proto__', '__proto__', 'CALC_UNKNOWN_IDENTIFIER')
throws('constructor 裸用', 'constructor', 'CALC_UNKNOWN_IDENTIFIER')
throws('toString', 'toString', 'CALC_UNKNOWN_IDENTIFIER')
throws('valueOf', 'valueOf', 'CALC_UNKNOWN_IDENTIFIER')
throws('hasOwnProperty', 'hasOwnProperty', 'CALC_UNKNOWN_IDENTIFIER')
throws('constructor 调用', 'constructor()', 'CALC_UNKNOWN_IDENTIFIER')
throws('toString 调用', 'toString(1)', 'CALC_UNKNOWN_IDENTIFIER')
ok('原型未被污染', () => {
  const probe = {}
  try { evaluate('__proto__.polluted = 1') } catch { /* 预期抛错 */ }
  if (probe.polluted !== undefined) throw new Error('Object.prototype 被污染')
  if ({}.polluted !== undefined) throw new Error('Object.prototype 被污染')
})

// ---- 安全：上限守卫 ----
ok('括号超深被拦截', () => {
  const deep = '('.repeat(200) + '1' + ')'.repeat(200)
  try {
    evaluate(deep)
    throw new Error('200 层括号未被拦截')
  } catch (error) {
    if (!(error instanceof CalcError) || error.code !== 'CALC_LIMIT_EXCEEDED') throw error
  }
})

ok('表达式超长被拦截', () => {
  try {
    evaluate('1+'.repeat(3000) + '1')
    throw new Error('超长表达式未被拦截')
  } catch (error) {
    if (!(error instanceof CalcError) || error.code !== 'CALC_LIMIT_EXCEEDED') throw error
  }
})

// ---- 参数校验 ----
throws('非字符串', 123, 'CALC_BAD_ARGUMENT')
ok('空字符串', () => {
  try {
    evaluate('   ')
    throw new Error('空字符串未被拦截')
  } catch (error) {
    if (!(error instanceof CalcError) || error.code !== 'CALC_BAD_ARGUMENT') throw error
  }
})

// ---- 已知限制的固化断言（不是 bug，是文档化行为）----
eq('浮点误差已知行为', '0.1+0.2', 0.30000000000000004, 0)

console.log(`\n通过 ${pass} / 失败 ${fail}`)
if (fail > 0) process.exit(1)
