# 贡献指南

感谢你愿意贡献工作流。这份文档说明**格式要求**与**审核标准** —— 先照着自查一遍，
能省掉一轮来回。

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
    scripts/       可选：客户端本轮不安装（见下）
    assets/        可选：同上
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

> **当前没有「把画布导出成工作流」的一键功能**，所以 `plan` 需要手写（或从
> `workflows/` 下已有的工作流改写）。这是已知的贡献门槛，已在计划中。

---

## 一点五、可选：给工作流配一个技能（`skill/`）

**为什么需要**：`plan` 是静态图，表达不了循环、条件分支、以及"先看结果再决定下一步"
这类判断。应用的 AI 对话 agent 才是处理这些的出口。`skill/` 就是**给 agent 的操作手册**：
它绑定到这条工作流，告诉 agent 该工作流怎么用、有哪些坑、参数去哪查。

**只加文件就等于声明**：不需要在 `workflow.json` 里加任何字段。索引里的技能清单由
`build-index.mjs` 从磁盘派生 —— 因为 `raw.githubusercontent` 没有目录列表 API，客户端
必须先知道每个文件路径才能下载，而派生能保证清单永不与磁盘漂移。

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

### `scripts/` 现在会怎样

**仓库接受提交，但客户端本轮只安装 `SKILL.md` 与 `references/`**，并在界面上标出「含脚本」。

原因：dsh 的技能层**没有脚本沙箱、也没有同意流**（技能只是一个"返回正文"的工具），
脚本能不能跑完全取决于通用 shell；而应用还没实现审批应答，默认策略下会**失败即关闭**。
所以"先让文档进去、代码等同意流做好再放"是刻意的分期，不是遗漏。

另外：**agent 本来就能自己写并运行脚本**，所以 `scripts/` 主要是"钉版本、免手写"的便利，
不是获得计算能力的唯一途径。写技能时可以直接指示 agent 在需要时自己写脚本。

---

## 二、提交前自查

```bash
node scripts/validate.mjs     # 格式 / 依赖 / 索引一致性
node --test                   # 校验器自身的单测
```

它会检查：id 形态、必填字段、semver、分类枚举、`plan` 结构、`edges` 悬空、
`requires` 与 `plan` 一致性、未知节点类型、封面存在与体积，以及**技能包**的
frontmatter、`wf-` 前缀、子目录白名单、体积上限、`workflow` 绑定，与正文里提到的
节点类型是否真实存在。

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

---

## 五、许可约定

- 本仓库的**脚本与索引结构**以 MIT 发布
- **每条工作流**的许可以它自己的 `license` 字段为准，默认建议 `CC-BY-4.0`
- 提交即表示你有权以该许可分发这份工作流
