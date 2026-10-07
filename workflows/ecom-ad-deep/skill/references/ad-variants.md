# 端口与参数速查（ecom-ad-deep）

字段名与端口 id 取自应用源码，可直接写进 `graph_edit` 的 `params` / `fromPort` / `toPort`。
未声明过的参数键会在物化时被丢弃并记入 warnings —— 先看 warnings，再怀疑模型。

## 图里有什么

| 节点标题 | typeId | 端口（入 → 出） |
|---|---|---|
| 卖点文案 | `play.script` | 无入口 → `out`（`text`） |
| 产品主视觉 | `asset.image` | `in-text`(text，可多) / `in-image`(image，可多) → `out`（当前选中，`image`）、`out-all`（历史，`images`） |
| 使用场景图 | `asset.image` | 同上 |
| 广告变体矩阵 | `image.adVariants` | `in`(image，**单个**) → `out` / `out-all` |
| 图层分离 | `image.layerSplit` | `in`(image，**单个**) → `out` / `out-all` |
| 使用说明 | `note.text` | **无端口**，纯文本，不参与执行 |

连线（`edges` 里的 `fromPort` / `toPort`）：

```
卖点文案:out      → 产品主视觉:in-text
卖点文案:out      → 使用场景图:in-text
产品主视觉:out    → 广告变体矩阵:in
产品主视觉:out    → 图层分离:in
```

`out` 是「当前选中那一张」；`out-all` 是复数类型，只与 `image.select` 一类节点兼容，
**不要**把 `out-all` 接到 `adVariants.in` / `layerSplit.in`。

## `image.adVariants`（广告变体矩阵）

参数：

| 参数 | 说明 |
|---|---|
| `adVariantMatrix` | 矩阵本体，见下 |
| `generateModel` / `generateProviderInstanceId` | 覆盖本批生图所用模型 / 提供商实例 |
| `generateSystemPrompt` | 追加到每格提示词前面的系统向提示词（可选） |

> 变体节点**没有** `generateAspectRatio` 这类生成参数入口：每格的宽高比只取自
> `adVariantMatrix.aspectRatio`；质量固定按 `high` 请求，每格 `n=1`。
> 也就是说「统一宽高比」对主视觉/场景图生效，对变体那一批不生效 —— 要竖版就给矩阵写
> `aspectRatio`。

`adVariantMatrix` 结构：

```jsonc
{
  "product": "产品名 + 卖点（必填，是每格提示词的第一段）",
  "aspectRatio": "1:1",              // 可选；缺省则不传宽高比
  "dimensions": [                    // 无取值的维度会被忽略
    { "id": "d-angle", "label": "机位角度", "values": ["正面平视", "45°侧面"] }
  ],
  "cells": []                        // 留空：执行时按 dimensions 笛卡尔积展开并回填
}
```

单元格（`cells[]`）由执行器回填，字段为：

| 字段 | 说明 |
|---|---|
| `id` | `cell-<维度id>=<取值>\|<维度id>=<取值>`（按 `dimensions` 顺序拼） |
| `combo` | `{ 维度id: 取值 }` |
| `prompt` | `product` + 每个维度的「label：value」，逐行拼接 |
| `outputRefs` | 本格生成结果的相对路径，**重复运行会追加**而非覆盖 |
| `status` | 审核状态（应用内变体编辑器用） |
| `verdict` | `selected` / `rejected`，仅在应用内标记过才存在 |

行为要点（源码口径）：

- 每格一次图片 API 调用，**逐格串行**；任何一格的图都没回来就整节点失败。
- 上游参考图取合并后输入列表的**第一张**（plan 里只有主视觉 `out` 一条入边），
  作为所有单元格的 `inputReferences`（产品一致性）。
- 上游 `in` 完全没接图也能跑（纯文生图），只是产品一致性没有保障。

## `image.layerSplit`（图层分离）

参数：

| 参数 | 说明 |
|---|---|
| `imageLayerSplit.prompt` | 拆层提示词；**参与源图指纹** |
| `imageLayerSplit.resolution` | 默认 `2K`；可选档位见源码 `LAYER_SPLIT_RESOLUTIONS`（`auto` / `1K` / `1.5K` / `2K`）。**参与源图指纹** |
| `imageLayerSplit.selectedId` / `layers` / `groups` / `canvasWidth` / `canvasHeight` / `sourceFingerprint` | 图层编辑状态，执行器回写；手写无意义 |
| `generateModel` / `generateProviderInstanceId` | 覆盖拆层所用模型 |

行为要点：

- 源图 + `prompt` + `resolution` 三者任一变化 → 重新调一次拆层 API；三者都没变则只按当前
  图层状态**本地重新合成**（省一次调用）。这就是「只调层级/位置不重新拆层」的原因。
- 上游模型必须支持图层分解（`layer_decomposition`，应用内由火山方舟 / Seedream 系列实现）。
- 执行产物 = 各图层 PNG + 一张「Composite」合成图，都进图库。
- **PSD 与分层 PNG 的落盘导出在图层编辑器里**（双击节点打开），走本机保存对话框；
  没有对应的 MCP 工具。

## `asset.image`（产品主视觉 / 使用场景图）

| 参数 | 说明 |
|---|---|
| `generateInstruction` | 本节点的生成指令。plan 已预设好侧重，改它即可换风格 |
| `in-text` | 上游文本会**自动追加**到 `generateInstruction` 之后；指令里出现 `@n` 时不再自动追加 |
| `in-image` | 参考图（可多张） |
| `styleImages` / `styleImagesUseGlobal` / `styleReferenceSubject` | 风格参考图族；`styleReferenceSubject` 取 `default` / `ui` |
| `characterRefs` | 角色参考；条目须带 `imageUrl`，只写名字解析不出图 |
| `generateModel` / `generateProviderInstanceId` / `generateAspectRatio` / `generateResolution` / `generateQuality` / `generateSeed` | 通用生成参数 |

> 参考图参数会被 `graph_edit` 校验：`styleImages` 条目须带 `libraryId` 或 `data:` 开头的
> `dataUrl`；`styleImagesUseGlobal: false` 时必须同时给 `styleImages`。
> 这次写不进去的值会被丢弃并记 warnings。

## 通用参数键（任何节点都放行）

以下键写在任何节点上都不会被当成「未声明参数」丢掉（是否真被该节点使用，取决于节点实现）：

`text`、`generateInstruction`、`generateSystemPrompt`、`skillId`、`generateModel`、
`generateProviderInstanceId`、`generateAspectRatio`、`generateResolution`、`generateQuality`、
`generateDuration`、`generateCount`、`generateStyle`、`generateSeed`、`generateSeedUseGlobal`、
`generateFrameMode`、`generateAudio`、`notes`、`label`、`mediaOutputDir`、
`styleImages`、`styleImagesUseGlobal`、`styleReferenceSubject`、`characterRefs`

节点自己 `defaultParams()` 里声明的私有键（如 `adVariantMatrix`、`imageLayerSplit`、
`iconPack`）同样放行 —— 两组取并集。

## 常见错误

| 现象 | 原因 |
|---|---|
| warnings 里出现「未声明参数 X，已忽略并回落默认值」 | 参数名拼错（是 `adVariantMatrix`，不是 `adVariants` / `variantMatrix`） |
| 变体节点报「无输入」 | 主视觉还没产物，或 `out-all`（复数口）被接到了单个 `in` |
| 变体只出了一张图 | `dimensions` 为空或所有 `values` 为空 —— 没有维度就没有笛卡尔积 |
| 拆层没变化 / 结果还是旧的 | `prompt` 与 `resolution` 都没改，指纹一致 → 走本地合成复用 |
| 图层分离报能力/图层缺失 | 当前图片模型不支持图层分解 |
| 提示词里的卖点出现两遍 | 同一段文案既写在卖点文案节点的 `text` 里，又抄进了 `generateInstruction` |
