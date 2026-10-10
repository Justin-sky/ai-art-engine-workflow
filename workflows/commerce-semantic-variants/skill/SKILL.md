---
name: wf-commerce-semantic-variants
description: 用「带货语义拆解与变体」工作流把口播/卖货实拍视频拆成语义时间线，并规划换品、换话术、换语言变体。当用户要复刻带货视频、局部修复、批量变体时加载本技能。
workflow: commerce-semantic-variants
workflow-version: 1.0.0
---

# 带货语义拆解与变体（commerce-semantic-variants）

## 这条工作流产出什么

`口播卖货视频 → 语义时间线（镜头/事件/节拍/意图）→ 导演编译命令 + 修复/变体计划`

- **语义分析**（`video.semanticAnalyze`）：切镜、话语、实体与启发式事件/节拍。
- **语义时间线**（`semantic.timeline`）：只读承载分析结果 JSON。
- **导演编译**（`semantic.compile`）：按规则包把意图编成数字运镜/调色等命令。
- **修复计划**（`video.repair`）：按 edits 给出保留/替换/重算与费用估算。
- **变体矩阵**（`video.variant`）：按 `semanticPacks` 里的配方展开（换品 / 开场话术 / 多语言）。

随包 `semanticPacks/`（纯 JSON，无可执行代码）：

| 文件 | 用途 |
|---|---|
| `commerce-vocabulary.json` | 带货节拍词表 `commerce.v1` |
| `commerce-director-rules.json` | 抖音快节奏导演规则 |
| `commerce-director-persona.json` | 带货导演人格提示 |
| `variant-replace-product.json` | 换品变体（L1） |
| `variant-rewrite-hook.json` | A/B 开场话术（L3） |
| `variant-revoice-lang.json` | 多语言出海（L1） |

## 什么时候用 / 什么时候别用

用：30–90 秒**实拍口播/卖货**，要「拆解 → 局部修 → 批量变体」。

别用：

| 用户其实想要 | 该用 |
|---|---|
| 从零生成电商主视觉+变体图 | `ecom-ad-deep` |
| 产品主图+短视频广告（无实拍拆解） | `product-ad` |
| 叙事短剧整镜重生成 | 后续 L2 能力，不在本包 |

## 上游输入怎么给

**必填**：一段可分析的视频资产，接到「语义分析」的视频入端口。

**建议**：先在设置里装好本地 YOLO（实体）与 ASR（词级转写）；没有时会启发式降级，但仍可出骨架时间线。

## Agent 操作要点

1. 用 MCP `semantic_analyze_video` 或跑通图上「语义分析」节点。
2. 用 `semantic_timeline_read` 核对事件是否带证据；无证据事件会被丢弃。
3. 变体前先 `semantic_plan` 看失效计划，确认后再 `semantic_build`。
4. 人格与规则来自本包 JSON；不要在市场包里塞可执行节点代码。
