# 贡献指南

感谢你愿意贡献工作流。这份文档说明**格式要求**与**审核标准** —— 先照着自查一遍，
能省掉一轮来回。

> 客户端侧的完整契约（安装流程与同意流、索引派生规则、交付管线）见 `ai-art-engine`
> 仓库的 `docs/MARKETPLACE.md`（插件市场开发者文档）。本文只讲仓库侧的要求。

---

## 一、一个工作流长什么样

```
workflows/my-workflow/
  workflow.json    必填
  cover.png        必填（800×450，≤ 300KB）
  README.md        可选
  skill/           可选：给 AI 对话 agent 的操作手册
    SKILL.md       必需（有 skill/ 就必需）
    references/    可选：字段速查、契约、示例
    scripts/       可选：安装时逐次征求用户同意（见下）
    assets/        可选：随包一起安装
```

`workflow.json`：

```jsonc
{
  "schemaVersion": 1,
  "id": "my-workflow",                  // 必填，kebab-case，必须等于目录名
  "title": "我的工作流",                 // 必填（中文标题）
  "titleEn": "My workflow",             // 可选（英文标题，有就填）
  "summary": "一句话说清它产出什么",       // 必填，≤ 60 字
  "category": "film",                   // 必填：film / ad / game / character / comic / utility
  "tags": ["竖屏", "广告"],              // 可选
  "version": "1.0.0",                   // 必填，semver
  "author": { "name": "你的名字", "url": "https://github.com/you" },
  "license": "CC-BY-4.0",               // 必填
  "cover": "cover.png",
  "requires": {                         // 由脚本校验：必须与 plan 实际用到的一致
    "nodeTypes": ["asset.text", "asset.image"],
    "appMinVersion": "7.1.0"
  },
  "plan": {                             // ★ 工作流本体
    "title": "我的工作流",
    "nodes": [
      { "key": "script", "typeId": "asset.text",  "params": { "text": "…" } },
      { "key": "shot",   "typeId": "asset.image", "params": { "generateInstruction": "…" } }
    ],
    "edges": [{ "from": "script", "to": "shot" }]
  }
}
```

### `plan` 的规则

- `nodes[].key` 在**本工作流内唯一**，`edges` 用它引用节点
- `nodes[].typeId` 必须是**应用已注册的节点类型**（白名单见 `scripts/known-node-types.json`）
- `edges[].from` / `to` 必须指向存在的 key（悬空端点会被拒）
- `params` 只放该节点**声明过**的参数；未声明的参数会在物化时被丢弃并给出 warning
- 上限：200 个节点；单个文本参数 20000 字符

### 怎么知道有哪些节点类型与参数？

- 类型清单：`scripts/known-node-types.json`
- 每个类型的端口与参数：在应用里右键画布 →「添加节点」逐个看，或让应用内的 AI 对话
  用 `graph_node_types` 工具列出（含端口与默认参数）

> **第三方工作流的 `plan` 可以从画布直接导出**（应用 7.1.3 起）：在节点画布上右键 →
> **「导出为市场工作流」**，填好元数据并选一张封面（必填，`cover.png`），应用会把当前图写成
> `workflows/<id>/{workflow.json, cover.png}` —— 目录由你自己选，通常就是本仓库的根。
>
> 导出时的两条口径值得知道，因为它们决定了包能不能在别人机器上装出同一张图：
> - `requires.nodeTypes` 由 `plan` 派生（不用手填）；
> - **只导出节点类型声明过的参数**，运行时写回字段（`generatedImages` / `animGifRelativePath` /
>   `animGifFrameCount` / `animGridImage` 这类上次运行的产物）以及以 `AssetId` 结尾的本工程资产
>   引用一律不进包 —— 否则发出去的会带着你自己工程的产物与悬空引用。
>
> 导出后按应用里的提示在本仓库执行 `node scripts/build-index.mjs && node scripts/validate.mjs`，
> 全绿再提交。仍然手写 `plan` 也完全可以（老办法没变）；从已有工作流改写同样可行。
>
> **例外：官方那 15 条工作流**（`game-ua-video` … `anim2d-gif`）**不允许从画布导出** ——
> 它们的 id 被内置预设占用，导出会被拒绝。它们的 `plan` 与应用内置的一键工作流预设是同一张图，
> 由**应用侧脚本导出**：
>
> ```bash
> # 在 ai-art-engine 仓库里
> npm run export:market          # 由内置预设重新生成各 workflow.json 的 plan 与 requires.nodeTypes
> npm run check:market-plans     # 只校验；不一致则退出码 1（CI 就在跑这个）
> ```
>
> 也就是说这两份拷贝是「生成 + 校验」的关系，不是各自维护。改官方工作流的图请改**应用预设**
> （`src/shared/graph/aiWorkflowPresets.ts`），再导出到这里；直接改这边的 `plan` 会被 CI 判为
> 漂移。`npm run export:market` 约定市场仓库在 `../ai-art-engine-workflow`，可用
> `--dir <path>` 或 `AAE_WORKFLOW_MARKET_DIR` 指定。
>
> 导出只写 `plan` 与 `requires.nodeTypes` 两个字段，**不碰**元数据、封面与 `skill/`。
> 导出后在本仓库跑 `node scripts/build-index.mjs && node scripts/validate.mjs`。

---

## 一点五、可选：给工作流配一个技能（`skill/`）

**为什么需要**：`plan` 是静态图，表达不了循环、条件分支、以及"先看结果再决定下一步"
这类判断。应用的 AI 对话 agent 才是处理这些的出口。`skill/` 就是**给 agent 的操作手册**：
它绑定到这条工作流，告诉 agent 该工作流怎么用、有哪些坑、参数去哪查。

**只加文件就等于声明**：不需要在 `workflow.json` 里加任何字段。索引里的技能清单由
`build-index.mjs` 从磁盘派生 —— 因为 `raw.githubusercontent` 没有目录列表 API，客户端
必须先知道每个文件路径才能下载，而派生能保证清单永不与磁盘漂移。

装完之后：技能包出现在应用的**技能清单**里（来源标为「技能包」），AI 对话的 agent 会加载它；
工作流卡片上则显示 **「含技能」/「含技能 · 含脚本」** 标记 —— 用户在安装前就知道装完 agent
手里会多一份操作手册。

**技能包不是独立产物**：它跟着工作流同生共死 —— 卸载工作流时，随它装上的技能目录会被一并删除。
所以不要把技能包当成能脱离工作流单独分发、单独长期存在的东西。

### `skill/SKILL.md`

```markdown
---
name: wf-my-workflow          # 必须等于 wf-<工作流 id>
description: 一句话说清什么时候该加载它    # ≤ 500 字符
workflow: my-workflow         # 必须等于工作流 id
workflow-version: 1.0.0       # 可选；写了就必须与 workflow.json 的 version 一致
---

# 标题

正文：这条工作流产出什么、端口为什么这么连、上游输入怎么给、常见追问怎么答。
```

规则（校验器会逐条拦）：

| 规则 | 为什么 |
|---|---|
| `name` 必须是 `wf-<id>` | 内置技能是**扁平 `<kebab-id>.md`**，与市场技能包落在**同一个目录、同一个 rank**，不加前缀会重名冲突 |
| `name` 必须 kebab-case | dsh 的 `SKILL_NAME` 正则只认这个，不合法会被**静默忽略** |
| `description` ≤ 500 字符 | dsh 的技能目录会截断，摘要必须短 |
| 不得使用 `disableModelInvocation` / `modelInvocable` / `userInvocable` | dsh 对这些 camelCase 旧键**直接抛错**，请用 `disable-model-invocation` / `user-invocable` |
| 只允许 `references/` `scripts/` `assets/` 子目录 | 其它目录不会被客户端安装，写了等于没写 |
| 单文件 ≤ 128KB，整包 ≤ 512KB，文件数 ≤ 40 | 客户端逐个下载，不能没有天花板 |
| 不允许符号链接 | 避免技能包指向仓库外 |
| 正文里提到的节点类型必须真实存在 | 技能是写给 agent 的操作手册，它会照着里面的 `typeId` 去建图；编一个不存在的类型，agent 就会写出一张坏图，而且**运行时没有任何兜底会报出来** |

最后一条只检查「反引号包裹的 `x.y` 记号，且 `x` 是已知节点命名空间」——所以 `cover.png`、
`references/ports.md`、`SKILL.md` 这类写法不会被误判。允许用到的类型以
`scripts/known-node-types.json`（由维护者更新）+ 本工作流 `plan` 里实际出现的类型为准。

### 怎么写 `description`

`description` 是 agent 决定「要不要加载这份技能」之前**唯一**能看到的东西 —— 正文只有在
它决定加载之后才会被读进来。所以要写**什么时候该加载**，而不是功能清单：

- ✅「用户要做竖屏短剧分镜、要按镜头拆节奏时加载」
- ❌「本技能包含 12 个节点类型说明、端口表、参数速查与常见问题」

后者把「有什么」写完了，agent 却不知道「什么时候该用」—— 结果要么不加载，要么在该用别的
技能时加载了它。

### 什么时候值得写 `references/`

`SKILL.md` 应当是**短而可执行**的主线：这条工作流为什么这么连、端口有哪些硬约束、
上游输入怎么给、常见追问怎么答。下面这类内容拆进 `references/` 更合适：

- 端口 / 参数对照表（长表格会把主线淹没）
- 需要严格照抄的长契约（提示词模板、字段约定、示例 JSON）

文件清单由 `build-index.mjs` **从磁盘派生**进 `index.json`，客户端据此逐个下载 ——
贡献者不需要（也无法）手写这份清单：加了文件就等于加进了清单。

### `scripts/` 现在会怎样

**仓库接受提交，客户端只在用户明确同意后才安装。** 这类技能包在索引里标 `hasScripts: true`，
卡片上显示「含技能 · 含脚本」—— 用户在点安装之前就知道这个包里带代码。

安装时的校验与说明书完全一致：客户端只接受白名单路径（`SKILL.md`，或 `references`
`scripts` `assets` 下一层的文件；不得穿越、不得绝对路径、不得含反斜杠），单文件 ≤ 128KB、
整包 ≤ 512KB、文件数 ≤ 40；仓库校验器另拦住子目录越界与符号链接。

安装时**每次**都会弹一次确认框，框里**逐条列出每个脚本路径**，并说明这些是 AI agent 可以
在这台机器上跑起来的代码。点「确定」才写入脚本；点「取消」则只装 `SKILL.md` 与
`references/`（脚本不落盘，工作流照常可用）。同意**不会被记住**，也没有「总是允许」——
重新安装、升级都会重新问一次。

运行时：agent 通过普通 shell 执行这些脚本，受 harness 沙箱约束；需要越过沙箱边界的调用会在
对话里弹出一张一次性审批卡（**允许一次 / 拒绝**，同样没有「总是允许」）；没有应答者时请求
**失败即关闭**（拒绝，绝不静默放行）。

**因此请把 `scripts/` 当可选项来写**：说明书本身要能让 agent 在「用户拒绝了脚本」的情况下
照样完成任务（常见做法：指示 agent 在需要时自己写一段临时脚本）。脚本的价值是**钉版本、
免手写、可复现**，而不是获得计算能力的唯一途径 —— agent 本来就能自己写并运行脚本。

---

## 二、提交前自查

```bash
node scripts/validate.mjs     # 格式 / 依赖 / 索引一致性
node --test                   # 校验器自身的单测
```

它会检查：id 形态、必填字段、semver、分类枚举、`plan` 结构、`edges` 悬空、
`requires` 与 `plan` 一致性、未知节点类型、封面存在与体积，以及**技能包**的
frontmatter（含 `name` / `description` / dsh 拒绝的旧键）、`wf-` 前缀、子目录白名单、
单文件与整包体积、文件数上限、符号链接、`workflow` 绑定，与正文里提到的节点类型
是否真实存在。

`index.json` **不要手改** —— CI 会在合并后自动重建。

---

## 三、审核标准

| 项 | 要求 |
|---|---|
| 署名与许可 | `author` 与 `license` 必填。**缺许可一律退回** |
| 简介 | `summary` 说清「产出什么」，不要写「很好用」这类空话 |
| 封面 | 必填。**建议放真实产物截图** —— 卡片没有封面就没有门面 |
| 依赖 | `requires.nodeTypes` 必须真实；引用不存在的类型会被 CI 拒 |
| 可跑通 | PR 描述里请贴一次真实跑通的截图或产物路径 |
| 版本 | 同一 `version` 的内容不得再改；改了内容请升版本 |
| 命名 | id 用 kebab-case，且能看出用途（不要 `test1`、`abc`） |
| 技能说明 | 有 `skill/` 时：`description` 要写「什么时候加载」，不是功能清单 |
| 脚本可缺省 | 含 `scripts/` 时：用户拒绝脚本后说明书仍要能独立完成任务 |

审核人只做两件事：**读你的工作流**，并在本地跑一次确认可用。因此请让 `summary`、
`title` 与封面对得上实际产物 —— 审核速度取决于这一点。

---

## 四、常见退回原因

1. `id` 与目录名不一致
2. `requires.nodeTypes` 手写漏了 / 多了（应由 plan 派生）
3. `edges` 指向了不存在的 `key`
4. 没有封面，或封面超过 300KB
5. `license` 空着
6. `summary` 超过 60 字（卡片只有一行，会被截断）
7. 引用了 `known-node-types.json` 里没有的节点类型（应用会拒绝使用）
8. 技能包的 `name` 忘了 `wf-` 前缀，或 `workflow`/`workflow-version` 没和工作流对上
9. 技能包里出现了 `references/` `scripts/` `assets/` 之外的目录
10. 技能包里用了符号链接，或超限（单文件 > 128KB / 整包 > 512KB / 文件数 > 40）
11. 技能包的 `description` 写成了功能清单 —— 校验器拦不住，但审核会退回（agent 无法据此判断何时加载）

---

## 五、许可约定

- 本仓库的**脚本与索引结构**以 MIT 发布
- **每条工作流**的许可以它自己的 `license` 字段为准，默认建议 `CC-BY-4.0`
- 提交即表示你有权以该许可分发这份工作流
