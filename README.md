# dsh-calc-tool

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 用的计算器工具。

模型做算术不稳定，是 LLM 的通病。这个插件给 Agent 一个确定性的 `calc` 工具，
让它不再靠脑补算数——既不会算错，也不会在思维链里反复推演浪费 token。

## 安装

```bash
dsh plugin --profile <profile> add github:yhy854/dsh-calc-tool
```

桌面版：设置 → 插件 → 从其他来源安装，填 `github:yhy854/dsh-calc-tool`，
勾选「这是来自本地、Git 或其他外部来源的高级插件」，装完重启 DSH。

## 用法

装好后 Agent 自动获得 `calc` 工具：

```
calc { expression: "1280 * 0.85 + 42.5" }  →  1130.5
calc { expression: "15 + 27 * sqrt(9)" }   →  96
```

## 支持什么

| 类别 | 内容 |
|---|---|
| 算术 | `+` `-` `*` `/` `%` `//`（整除）`**`（幂，右结合） |
| 函数 | `abs` `ceil` `floor` `round` `trunc` `sign` `sqrt` `cbrt` `exp` `log` `log2` `log10` `sin` `cos` `tan` `asin` `acos` `atan` `pow` `hypot` `max` `min` |
| 常量 | `PI` `E` |
| 其他 | 括号、一元正负、科学计数法 `1.5e3` |

三角函数用弧度。要算角度写 `sin(30 * PI / 180)`。

优先级：`**`（右结合）> 一元 `±` > `* / % //` > `+ -`。

## 为什么安全

**没有 `eval`，没有 `new Function`。** 手写词法分析 + 递归下降解析，只求值白名单节点：

- 词法层只认数字、白名单标识符、运算符、括号、逗号
- 引号、分号、反引号、`{}` `[]` 一律报错，不做「清洗后继续」
- 标识符查表，表外即抛 `Unknown identifier`
- 结果必须是有限数字，`NaN` / `Infinity` 统一拒绝
- 表达式长度上限 4096 字符，括号嵌套上限 64 层，函数参数上限 32 个

`new Function` + 正则白名单是不安全的——`constructor.constructor("return process")()` 可以直达
`Function` 构造器执行任意代码。本实现不走任何代码求值捷径。

## 错误码

出错时返回结构化错误，方便模型自我修正而不是盲目重试：

| 错误码 | 含义 |
|---|---|
| `CALC_PARSE_ERROR` | 语法错误，附带出错位置 |
| `CALC_UNKNOWN_IDENTIFIER` | 标识符不在白名单 |
| `CALC_DIVIDE_BY_ZERO` | 除数为 0 |
| `CALC_NOT_FINITE` | 结果溢出或负数开方 |
| `CALC_LIMIT_EXCEEDED` | 超出长度/深度/参数上限 |
| `CALC_BAD_ARGUMENT` | 参数类型错误 |

## 已知限制

1. 使用 IEEE 754 双精度浮点，`0.1 + 0.2` 会得到 `0.30000000000000004`。需要精确小数请自行四舍五入。
2. 安全整数范围 ±9e15，超出有精度损失。
3. 不支持符号运算、矩阵、方程求解——那些请用专门的数学插件。

## 测试

```bash
node dsh-calc-tool/test/evaluate.test.mjs
```

覆盖数值用例与攻击载荷（`constructor.constructor` 链、`process.exit`、`globalThis`、模板字符串注入、超深嵌套）。

## 兼容性

| DSH 内核 | 状态 |
|---|---|
| `0.2.x` | 兼容（`peerDependencies` 写 `>=0.2.0-0`，覆盖 rc 预发布版） |

> ⚠️ peer 范围不要改成 `^0.2.0`。`^0.2.0` 在 semver 里展开成 `<0.3.0-0` 没问题，
> 但 `^0.1.x` 这类会展开成 `<0.2.0-0`，把 `0.2.0-rc.1` 全部排除，DSH 的 profile
> 预检会静默禁用整行插件。

## 许可

MIT
