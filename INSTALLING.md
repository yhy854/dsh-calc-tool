# 安装方式边界补充

本篇补充三种安装方式的**适用边界、已知报错和排查方法**，主 README 只写了「怎么装」，
这里写「什么情况下装不上、报错是什么意思、该怎么处理」。

本文所有结论都在 DeepSeek Harness Desktop `0.2.2-rc.1`（profile `desktop`）上实测过。

---

## 一、先确认你的 profile 是哪一个

两种 profile 的境遇完全不同，先分清：

| 场景 | profile 名 | 谁能装 |
|---|---|---|
| **DeepSeek Harness 桌面版**（Electron 客户端） | `desktop` | **只有图形界面能装** |
| `dsh web` / `dsh tui` / `dsh headless` 自行启动 | `web` / `tui` / `headless` / 自建 | 命令行和图形界面都能装 |

判断方法：如果你是从开始菜单/桌面图标打开的 DeepSeek Harness，那就是 `desktop`。
如果你的 profile 名是 `desktop`，**方式二和方式三的命令行安装会直接失败**，见下文。

---

## 二、方式一边界：图形界面安装

### 适用范围

- 所有 profile 都可用
- 桌面版唯一可行的安装方式

### 真实操作路径

```
侧边栏 → 插件 → 右上角「添加插件」→ 下拉菜单选「安装第三方插件」→ 弹窗输入 → 安装
```

### 边界与注意事项

**1. 输入格式取决于内容，不取决于有无勾选框**

对话框说明写的是「输入插件的包名、GitHub 仓库地址或本地目录路径」，三种都接受：

| 你想装的形式 | 输入框填什么 |
|---|---|
| GitHub 仓库 | `github:yhy854/zhong-wen-thinks` |
| GitHub 完整地址 | `https://github.com/yhy854/zhong-wen-thinks` |
| npm 包 | 包名本身，如 `dsh-plugin-whale-pet` |
| 本地目录 | 该目录的绝对路径 |

**2. 「高级插件」勾选框不是所有版本都有**

部分版本的桌面端会显示「这是来自本地、Git 或其他外部来源的高级插件」，**必须勾上**，
否则只会去 npm registry 找包名，填 `github:` 会报找不到包。

你这个版本（`0.2.2-rc.1`）的对话框里**没有这个勾选框**，直接填 `github:` 开头即可。
判断方法：点开对话框里的「插件安装引导和示例」，如果只展开「填入插件 npm 包名」一节、
没有其他来源选项，说明就是无勾选框的版本。

**3. 安装源会影响能否装上**

对话框右下角有「安装源」选择器，默认可能是 `中国大陆镜像源`。
如果安装卡住或报网络错误，试着切换安装源；如果是 GitHub 直装（`github:` 开头），
安装源设成哪个都一样，因为走的是 git 而不是 npm registry。

**4. 装完必须重启才生效**

宿主插件在启动时挂载。装完 DSH 不会热加载它，必须重启。
插件面板里会显示「立即重启」按钮，点它比手动杀进程干净。

---

## 三、方式二边界：命令行安装

### 适用范围

- `web` / `tui` / `headless` / 自建 profile
- **不适用于 `desktop` profile**

### desktop profile 会被明确拒绝

如果你的 profile 是 `desktop`，执行：

```bash
dsh plugin --profile desktop add github:yhy854/zhong-wen-thinks
```

会直接得到这个错误并退出：

```
error: profile "desktop" is managed exclusively by the Electron application
```

这不是权限问题、也不是环境问题，是设计如此——`desktop` profile 由 Electron 应用独占管理，
命令行工具不允许碰它。**遇到这个错误不要尝试绕开**（例如手动改 `package.json` 或
`cordis.patch.yml`），那会让应用的配置状态不一致。

**处理办法**：改用方式一，在图形界面里装。

### 其他 profile 的注意事项

**1. `dsh` 可能不在 PATH 里**

桌面版安装的 `dsh` 通常在：

```
<安装目录>\resources\runtime\cli\bin\dsh.cmd
```

如果命令行里 `dsh` 提示「不是内部或外部命令」，要么加进 PATH，要么用完整路径调用。

**2. `dsh plugin` 只是 pnpm 的转发器**

`dsh plugin --help` 的原话是「manage a profile's plugins by forwarding the remaining
arguments to pnpm in the profile directory」。所以它接受的是 pnpm 参数：

```bash
dsh plugin --profile web add <包名或地址>
dsh plugin --profile web remove <包名>
dsh plugin --profile web why <包名>
```

它**不会**帮你把插件加进 `dsh.profile.bundles` 之外的任何配置，行为完全取决于 pnpm
安装的结果。

**3. Windows 上路径含中文或空格的问题**

Windows 下如果路径含中文或空格，`dsh plugin ... add link:<路径>` 可能因为中间经过
`cmd.exe` 解析而把 spec 写错（`package.json` 里出现乱码路径）。遇到这种情况改用
图形界面安装。

---

## 四、方式三边界：本地目录安装

### 适用范围

- 自己改代码、调试场景
- **`desktop` profile 同样不行**（理由同上，`link:` 也是通过 `dsh plugin` 执行的）

### 边界与注意事项

**1. `link:` 是实时生效的，但只在重启后**

`link:` 会在 profile 的 `node_modules` 里建一个指向源码目录的链接，所以**改代码不用重装**。
但插件模块本身是在 DSH 启动时加载的，改完代码仍然要重启（或触发插件重载）才会用上新代码。

**2. 零依赖原则不是可选项**

这点很重要：插件从 `link:` 挂载到 profile 的 `node_modules` 之外时，Node 解析不到插件自己
`import` 的第三方包，会**导致整棵插件树加载失败**，不是这一个插件失效，是其他插件一起挂掉。

所以本仓库的两个插件都刻意做到**不 import 任何 npm 包**，只用 Cordis 注入的 `ctx` 服务：

- `zhong-wen-thinks` 只用 `ctx.systemPrompt`
- `dsh-calc-tool` 只用 `ctx.tools`

你自己二次开发时如果引入了第三方依赖（比如 `schemastery` 做配置 schema），
就必须改用「发布 npm / GitHub 直装」，不能再从本地目录挂载。

**3. 安装来源会影响以后升级**

| 安装来源 | 要联网 | DSH 迁移主目录时 |
|---|---|---|
| `github:用户/仓库` | 需要 GitHub | 能自动接回（写死 commit 更稳） |
| npm 包名 | 需要 registry | 能自动接回 |
| 本地目录 `link:` | 不需要 | **会掉线**，需要重装 |
| 本地 `.tgz` | 不需要 | **会掉线**，需要重装 |

如果你打算长期用，建议最终用 `github:` 或 npm 安装，`link:` 只当开发期临时方案。

---

## 五、装完怎么确认真的生效

光看「已安装」不够，那只能说明依赖装进 profile 了。**真正决定插件是否运行的是它有没有
进入 `dsh.profile.bundles` 并成功挂载。**

### 检查一：插件面板的开关状态

插件面板 →「已安装插件」区域，找到插件那一行：

| 你看到的 | 含义 | 该怎么办 |
|---|---|---|
| 开关是**开启**状态 | 已启用 | 正常，去验证功能 |
| 开关是**关闭**状态 | 装了但没启用 | 点一下开关打开，重启 |
| 提示「该插件已安装。如需升级，请卸载后重新安装」 | 依赖在，但没有作为 bundle 启用 | 卸载后按方式一重装 |

**第三种就是「半装状态」**：profile 的 `package.json` 里有 `link:` 或版本依赖，
但 `dsh.profile.bundles` 列表里没有它，结果就是磁盘上有文件、运行时不加载。

### 检查二：确认插件行是否进入运行时

如果你能用命令行，检查 profile 的组合结果：

```bash
dsh --profile <你的profile> --dump-config
```

在输出里搜插件名，能看到对应行就说明它进了组合树。

> 注意：`desktop` profile 执行这条会被拒绝（见方式二的边界），只能用图形界面看开关状态。

### 检查三：功能层面验证

**中文思维链插件**：新开一个会话，看思考块是不是中文。
必须是**新会话**——已在进行中的会话，其系统提示词在插件启用前就组装好了，不会变。

**计算器插件**：新开会话后让 Agent 算个数，比如「帮我算 1280 乘 0.85 加 42.5」。
启用后它应该调 `calc` 工具；没启用时它会自己心算。

---

## 六、常见报错对照

| 报错 / 现象 | 原因 | 处理 |
|---|---|---|
| `profile "desktop" is managed exclusively by the Electron application` | 对 desktop profile 用了命令行 | 改用图形界面安装 |
| 命令行提示 `dsh` 不是内部或外部命令 | dsh 不在 PATH | 用 `<安装目录>\resources\runtime\cli\bin\dsh.cmd` 完整路径 |
| 安装后功能没反应 | 没重启，或开关没打开 | 重启 DSH，检查插件面板开关 |
| 提示「该插件已安装。如需升级，请卸载后重新安装」 | 半装状态，没进 bundles | 卸载后重装 |
| 装了插件后**其他插件**也一起不好使了 | 插件 import 了无法解析的第三方包 | 改用 `github:` 或 npm 安装，不要用本地目录挂载带依赖的插件 |
| 中文思考插件在某个 preset 下不生效 | 该 preset 首轮会过滤提示词段（如两阶段锚定 preset） | 换标准 preset 验证；这是 preset 行为，不是插件故障 |
| `github:` 安装报找不到包 | 版本没有「高级插件」勾选项却填了非包名，或网络问题 | 确认输入格式，或切换安装源 |
| 安装中文路径下的本地目录后依赖记录变成乱码 | Windows 经 `cmd.exe` 解析导致 | 改用图形界面安装 |

---

## 七、一句话总结

- **桌面版**（profile `desktop`）：**只能用图形界面装**，命令行一定失败，这不是 bug。
- **自行启动的 profile**：三条路都行，`link:` 适合开发，`github:` 适合长期使用。
- 装完**一定要重启**，并且确认插件面板里的**开关是打开的**——「已安装」不等于「在运行」。
