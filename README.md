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
  validate.mjs             ← 格式与依赖校验
  build-index.mjs          ← 由 workflows/ 生成 index.json
  known-node-types.json    ← 应用已注册的节点类型白名单（由维护者更新）
workflows/
  <workflow-id>/
    workflow.json          ← 工作流本体（元数据 + plan）
    cover.png              ← 卡片封面（800×450，≤300KB）
    README.md              ← 可选：给人看的说明
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

应用侧可切换数据源（`workflowMarket.source`）。Gitee 的 raw 根地址是：

```
https://gitee.com/beijing_blue_whale_era_zhangjian/ai-art-engine-workflow/raw/main
```

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
