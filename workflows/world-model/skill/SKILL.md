---
name: wf-world-model
description: 用「世界模型」工作流把一张参考图或一段场景设定变成可继续编排的 3D 世界产物（Marble 空间世界 → 导出网格/泼溅 → 导演台）。当用户要做空间世界、沉浸式场景、或想从图片得到一个可进入的 3D 环境时加载本技能。
workflow: world-model
workflow-version: 1.0.0
---

# 世界模型（world-model）

## 这条工作流产出什么

`文本设定 → 空间世界生成 → 空间世界导出 → 3D 导演台`

产物是**世界**：带 `world_id`，内部包含网格（collider GLB）、高斯泼溅、360 全景三样。
它不是一个普通 3D 模型资产 —— 要变回可继续编排的模型，**必须先过「空间世界导出」**。

## 关键约束：世界**不能**直连导演台

端口类型是**严格同类型**的，这不是可以绕过的限制：

- `asset.spatialWorld` 的出口类型是 `spatialWorld`
- `asset.motion`（3D 导演台）的 `in-model` 只吃 `model`
- 唯一的转换点是 `spatialWorld.export`（出口才是 `model`）

所以正确连线是：

```
asset.spatialWorld:out → spatialWorld.export:in-world
spatialWorld.export:out → asset.motion:in-model
```

把世界直接连导演台会被拒绝 —— 不要试图"顺手"直连，也不要反复重试。

## 上游输入怎么给

世界生成节点有三类输入口，执行时按 **视频 > 参考图** 的优先级取一种：

- `in-text`：场景描述（走 Marble 的 `world_prompt` 文本分支）
- `in-image`：单图 / 多图同场景（图生世界）
- `in-video`：参考视频

只连一种。同时连文本和图时，文本仍然会被用作补充描述，但**决定分支的是图/视频的存在**。
用户只有一句话时用 `in-text`；用户给了一张图时优先用 `in-image` 并把描述写进 `in-text`。

## 导出模式怎么选

`s spatialWorld.export` 的 `spatialWorldExportMode`：

- `mesh`（默认，配 `spatialWorldExportVariant: textured`、`Resolution: full_res`）：
  出 HQ 网格 GLB 并**登记为模型资产** —— 想继续接 `model.*` 一族（贴图 / 绑骨 / 重拓扑 /
  动作）或接导演台，就用它。
- `splats`：出 PLY 泼溅，**落在世界产物同目录、不登记资产**（应用内没有 PLY 预览通道）。
  只有在用户明确要泼溅数据本身时才用。

用户说"我要能进去看 / 要能编辑这个世界"时选 `mesh`；说"我要泼溅点云"时选 `splats`。

## 常见追问怎么答

- **"能不能让人物在里面走？"** 目前不能。本应用的世界产物可以在**3D 导演台**里查看、
  打光、排镜头，但没有第一人称漫游运行时。不要承诺漫游。
- **"能改成游戏场景吗？"** 可以经 `mesh` 导出后接 `model.*` 或进导演台做成片；
  要可玩 HTML 游戏走应用的游戏链路（`gameplay_prepare_project` 等），不是这条工作流。
- **"要多久？"** 世界生成是远程长任务（数十秒到数分钟），不要在同一轮里反复重试。

## 操作建议

1. 先确认用户要的是**空间世界**（可进入的环境），而不是普通 3D 模型 —— 后者用
   `asset.model3d` / `generate_model3d` 更直接、更便宜。
2. 参考图优先用**场景全局照**（含地面与远景），不要用主体特写。
3. 生成后先让用户看导演台里的结果，再决定要不要接 `model.*` 继续加工。

更细的节点参数与端口见 `references/ports.md`。
