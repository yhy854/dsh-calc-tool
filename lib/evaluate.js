/**
 * 安全数学表达式求值器。
 * 无 eval / 无 new Function / 无 Proxy。手写词法 + 递归下降。
 * 白名单标识符查表，表外即抛错。
 */

export class CalcError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'CalcError'
    this.code = code
  }
}

const FUNCS = {
  abs: Math.abs,
  ceil: Math.ceil,
  floor: Math.floor,
  round: Math.round,
  trunc: Math.trunc,
  sign: Math.sign,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  exp: Math.exp,
  log: Math.log,
  log2: Math.log2,
  log10: Math.log10,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  pow: Math.pow,
  hypot: Math.hypot,
  max: Math.max,
  min: Math.min,
}

const CONSTS = { PI: Math.PI, E: Math.E }
const MULTI = ['**', '//']

const MAX_LENGTH = 4096
const MAX_DEPTH = 64
const MAX_ARGS = 32

function tokenize(src) {
  const tokens = []
  let i = 0
  let parenDepth = 0

  while (i < src.length) {
    const c = src[i]

    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i += 1
      continue
    }

    if (c >= '0' && c <= '9') {
      let j = i
      while (j < src.length && src[j] >= '0' && src[j] <= '9') j += 1
      if (src[j] === '.') {
        j += 1
        while (j < src.length && src[j] >= '0' && src[j] <= '9') j += 1
      }
      if (src[j] === 'e' || src[j] === 'E') {
        let k = j + 1
        if (src[k] === '+' || src[k] === '-') k += 1
        if (src[k] >= '0' && src[k] <= '9') {
          while (k < src.length && src[k] >= '0' && src[k] <= '9') k += 1
          j = k
        }
      }
      const text = src.slice(i, j)
      const value = Number(text)
      if (!Number.isFinite(value)) {
        throw new CalcError('CALC_PARSE_ERROR', `无法解析的数字: ${text}`)
      }
      tokens.push({ t: 'num', v: value })
      i = j
      continue
    }

    if (/[A-Za-z_]/.test(c)) {
      let j = i
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j += 1
      const text = src.slice(i, j)
      if (!(text in FUNCS) && !(text in CONSTS)) {
        throw new CalcError(
          'CALC_UNKNOWN_IDENTIFIER',
          `未知标识符: ${text}。可用函数: ${Object.keys(FUNCS).join(', ')}；可用常量: ${Object.keys(CONSTS).join(', ')}`,
        )
      }
      tokens.push({ t: 'id', v: text })
      i = j
      continue
    }

    const two = src.slice(i, i + 2)
    if (MULTI.includes(two)) {
      tokens.push({ t: 'op', v: two })
      i += 2
      continue
    }

    if ('+-*/%(),'.includes(c)) {
      if (c === '(') {
        parenDepth += 1
        if (parenDepth > MAX_DEPTH) {
          throw new CalcError('CALC_LIMIT_EXCEEDED', `括号嵌套超过 ${MAX_DEPTH} 层`)
        }
      } else if (c === ')') {
        parenDepth -= 1
      }
      tokens.push({ t: 'op', v: c })
      i += 1
      continue
    }

    throw new CalcError('CALC_PARSE_ERROR', `非法字符 "${c}"（位置 ${i}）`)
  }

  return tokens
}

function parse(tokens) {
  let pos = 0
  let depth = 0

  const peek = () => tokens[pos]
  const isOp = (v) => peek() !== undefined && peek().t === 'op' && peek().v === v

  function expect(v) {
    if (!isOp(v)) {
      const got = peek() === undefined ? '表达式结束' : `"${peek().v}"`
      throw new CalcError('CALC_PARSE_ERROR', `期望 "${v}"，实际是 ${got}`)
    }
    pos += 1
  }

  function enter() {
    depth += 1
    if (depth > MAX_DEPTH) {
      throw new CalcError('CALC_LIMIT_EXCEEDED', `表达式嵌套超过 ${MAX_DEPTH} 层`)
    }
  }

  function additive() {
    enter()
    let left = multiplicative()
    while (isOp('+') || isOp('-')) {
      const op = tokens[pos].v
      pos += 1
      left = { t: 'bin', op, l: left, r: multiplicative() }
    }
    depth -= 1
    return left
  }

  function multiplicative() {
    let left = unary()
    while (isOp('*') || isOp('/') || isOp('%') || isOp('//')) {
      const op = tokens[pos].v
      pos += 1
      left = { t: 'bin', op, l: left, r: unary() }
    }
    return left
  }

  function unary() {
    if (isOp('-') || isOp('+')) {
      const op = tokens[pos].v
      pos += 1
      return { t: 'un', op, e: unary() }
    }
    return power()
  }

  function power() {
    const base = primary()
    if (isOp('**')) {
      pos += 1
      return { t: 'bin', op: '**', l: base, r: unary() }
    }
    return base
  }

  function primary() {
    const tk = peek()
    if (tk === undefined) {
      throw new CalcError('CALC_PARSE_ERROR', '表达式意外结束')
    }

    if (tk.t === 'num') {
      pos += 1
      return { t: 'num', v: tk.v }
    }

    if (tk.t === 'id') {
      pos += 1
      if (isOp('(')) {
        if (!(tk.v in FUNCS)) {
          throw new CalcError('CALC_UNKNOWN_IDENTIFIER', `${tk.v} 不是函数`)
        }
        pos += 1
        const args = []
        if (!isOp(')')) {
          args.push(additive())
          while (isOp(',')) {
            pos += 1
            if (args.length >= MAX_ARGS) {
              throw new CalcError('CALC_LIMIT_EXCEEDED', `参数超过 ${MAX_ARGS} 个`)
            }
            args.push(additive())
          }
        }
        expect(')')
        return { t: 'call', name: tk.v, args }
      }
      if (!(tk.v in CONSTS)) {
        throw new CalcError('CALC_UNKNOWN_IDENTIFIER', `${tk.v} 是函数，需要写成 ${tk.v}(...)`)
      }
      return { t: 'num', v: CONSTS[tk.v] }
    }

    if (tk.t === 'op' && tk.v === '(') {
      pos += 1
      const inner = additive()
      expect(')')
      depth -= 1
      return inner
    }

    throw new CalcError('CALC_PARSE_ERROR', `意外的 "${tk.v}"`)
  }

  if (tokens.length === 0) {
    throw new CalcError('CALC_PARSE_ERROR', '表达式为空')
  }

  const ast = additive()
  if (pos !== tokens.length) {
    throw new CalcError('CALC_PARSE_ERROR', `"${tokens[pos].v}" 之后存在多余内容`)
  }
  return ast
}

function evalNode(node) {
  switch (node.t) {
    case 'num':
      return node.v

    case 'un':
      return node.op === '-' ? -evalNode(node.e) : evalNode(node.e)

    case 'bin': {
      const a = evalNode(node.l)
      const b = evalNode(node.r)
      switch (node.op) {
        case '+': return a + b
        case '-': return a - b
        case '*': return a * b
        case '/':
          if (b === 0) throw new CalcError('CALC_DIVIDE_BY_ZERO', '除数为 0')
          return a / b
        case '//':
          if (b === 0) throw new CalcError('CALC_DIVIDE_BY_ZERO', '除数为 0')
          return Math.floor(a / b)
        case '%':
          if (b === 0) throw new CalcError('CALC_DIVIDE_BY_ZERO', '取模的除数为 0')
          return a % b
        case '**': return a ** b
        default:
          throw new CalcError('CALC_PARSE_ERROR', `未知运算符 ${node.op}`)
      }
    }

    case 'call': {
      const fn = FUNCS[node.name]
      const args = node.args.map(evalNode)
      return fn(...args)
    }

    default:
      throw new CalcError('CALC_PARSE_ERROR', `未知节点 ${node.t}`)
  }
}

/** 求值入口：接收 unknown，返回有限数字，非法输入抛 CalcError。 */
export function evaluate(expression) {
  if (typeof expression !== 'string') {
    throw new CalcError('CALC_BAD_ARGUMENT', 'expression 必须是字符串')
  }
  const src = expression.trim()
  if (src.length === 0) {
    throw new CalcError('CALC_BAD_ARGUMENT', 'expression 不能为空')
  }
  if (src.length > MAX_LENGTH) {
    throw new CalcError('CALC_LIMIT_EXCEEDED', `表达式长度超过 ${MAX_LENGTH} 字符`)
  }

  const value = evalNode(parse(tokenize(src)))

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new CalcError('CALC_NOT_FINITE', `结果不是有限数字（${String(value)}）`)
  }

  return value
}
