# AI Art Engine 工作流市场

[AI Art Engine](https://github.com/Justin-sky/ai-art-engine) 的**开放工作流市场**。

这里存放可直接导入应用的**工作流**（一张连好线的节点图）。应用内的「插件市场 → 工作流」页签
读取本仓库的 `index.json`，把每条工作流展示成一张卡片，点一下就能落进你的工程。

> 工作流**不含可执行脚本**。它只能引用应用里已注册的节点类型，并给它们填参数 ——
> 这是与「技能市场」最大的区别，也是本市场风险面较小的原因。

---

## 目录结构

```
index.json                 ← 目录索引（由 CI 生成，请勿手改）
scripts/
  validate.mjs             ← 格式与依赖校验（含技能包）
  validate.test.mjs        ← 校验器单测（node --test）
  build-index.mjs          ← 由 workflows/ 生成 index.json
  known-node-types.json    ← 应用已注册的节点类型白名单（由维护者更新）
workflows/
  <workflow-id>/
    workflow.json          ← 工作流本体（元数据 + plan）
    cover.png              ← 卡片封面（800×450，≤300KB）
    README.md              ← 可选：给人看的说明
    skill/                 ← 可选：给 AI 对话 agent 的操作手册
      SKILL.md             ← 必需（有 skill/ 就必需）
      references/          ← 可选：字段速查、契约、示例
      scripts/             ← 可选：客户端本轮不安装（见 CONTRIBUTING）
      assets/              ← 可选：同上
```

**`<workflow-id>` 必须是 kebab-case**（小写字母 / 数字 / 连字符），且与 `workflow.json` 里的
`id` 一致 —— 它会变成目录名与 URL 片段。

---

## 怎么用（使用者）

在应用里打开**插件市场 → 工作流**，选一张卡片 → 安装 → 「使用」，工作流就会落到当前工程里。

不需要在本仓库做任何操作。

---

## 怎么贡献（作者）

1. 在 `workflows/<你的工作流-id>/` 下放 `workflow.json` 与 `cover.png`
2. 本地跑一次校验：

   ```bash
   node scripts/validate.mjs
   ```

3. 提交 PR。CI 会跑同样的校验，并在合并后自动重建 `index.json`。

**你不需要手改 `index.json`** —— 它是派生产物，由 `scripts/build-index.mjs` 生成。
手改它会被 CI 拒绝。

详细的字段说明与写作规范见 CONTRIBUTING.md。

### 可选：给工作流配一个技能

在 `workflows/<id>/skill/SKILL.md` 放一份**给 AI 对话 agent 的操作手册**，它就会随这条工作流
一起被安装 —— 用户装上工作流，agent 也就学会了怎么用它。

```
workflows/<id>/skill/
  SKILL.md          name: wf-<id> / description / workflow: <id>
  references/*.md   字段速查、契约、示例
```

适合写进技能的内容：这条工作流**为什么**这么连、端口有哪些硬约束、上游输入怎么给、
常见追问怎么答、参数去哪查。`plan` 表达不了的"先看结果再决定下一步"这类判断，正是
agent 的用武之地。

`SKILL.md` 必须写 `name: wf-<工作流 id>`（`wf-` 前缀用于避开内置技能），且文件清单会由
CI 从磁盘派生进 `index.json` —— 你同样不需要手改索引。规则与拒绝原因见 CONTRIBUTING.md。

---

## 审核底线

- `author`（署名）与 `license` 必填，缺一不可 —— 缺许可的内容有法律灰区，一律退回
- `requires.nodeTypes` 必须与 `plan` 实际用到的节点类型**完全一致**（由脚本派生，不允许手写）
- 封面必填：卡片没有封面就没有门面
- 每个 PR 由维护者人工审核；**不接受自动合并**

---

## 当前内容

首批内容由应用内置的 15 个创作预设导出（见 `workflows/seed-manifest.json`）。
它们的封面目前是**占位图**，欢迎按真实产物替换 —— 那是最容易上手的一种贡献。

---

## 镜像

本仓库同时托管在两个地方，内容**完全一致**（同一 commit、逐字节相同的文件）：

| 用途 | 地址 |
|---|---|
| 主库 | https://github.com/Justin-sky/ai-art-engine-workflow |
| 镜像 | https://gitee.com/beijing_blue_whale_era_zhangjian/ai-art-engine-workflow |

**为什么要镜像**：应用默认从 `raw.githubusercontent.com` 拉取索引，而该域在部分网络下不可达。
Gitee 的 raw 地址在同类网络下通常可用，因此作为备用数据源。

**应用会自动降级**：主源不通时自动改用镜像，不需要用户配置；界面会说明当前数据来自镜像
（用户有权知道内容从哪来）。两个源的 raw 根地址：

```
https://raw.githubusercontent.com/Justin-sky/ai-art-engine-workflow/main
https://gitee.com/beijing_blue_whale_era_zhangjian/ai-art-engine-workflow/raw/main
```

也可以在设置里把 `workflowMarket.source` 填成**一个或多个**地址（换行分隔），
按填写顺序依次尝试 —— 于是「自建主源 + 官方镜像」这种组合不需要额外机制。
显式配置时**只**用配置的地址，不会偷偷混入官方源。

### 维护者：如何保持两侧同步

```bash
git remote add gitee https://gitee.com/beijing_blue_whale_era_zhangjian/ai-art-engine-workflow
git push origin main
git push gitee main
```

两个远端的内容必须一致 —— 不一致时应用会依数据源不同而看到不同的市场内容，
这种「同一版本号、不同内容」的状态最难排查。

---

## 许可

本仓库的脚本与索引结构以 MIT 发布（见 LICENSE）。
**每条工作流的许可以它自己 `workflow.json` 里的 `license` 字段为准** —— 默认建议
`CC-BY-4.0`，但作者可以另选并在字段中写明。
