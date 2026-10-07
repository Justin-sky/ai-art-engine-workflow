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

## 二、提交前自查

```bash
node scripts/validate.mjs
```

它会检查：id 形态、必填字段、semver、分类枚举、`plan` 结构、`edges` 悬空、
`requires` 与 `plan` 一致性、未知节点类型、封面存在与体积。

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

---

## 五、许可约定

- 本仓库的**脚本与索引结构**以 MIT 发布
- **每条工作流**的许可以它自己的 `license` 字段为准，默认建议 `CC-BY-4.0`
- 提交即表示你有权以该许可分发这份工作流
