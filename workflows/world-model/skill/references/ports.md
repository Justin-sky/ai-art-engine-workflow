# 端口与参数速查（world-model）

以下字段名与端口 id 取自应用源码，可直接写进 `graph_edit` 的 `params`。

## asset.spatialWorld（世界生成）

输入：

| 端口 | 类型 | 说明 |
|---|---|---|
| `in-text` | `text` | 场景描述；走 Marble 的 `world_prompt` 文本分支 |
| `in-image` | `image` | 参考图（单图 / 多图同场景） |
| `in-video` | `video` | 参考视频；优先级高于参考图 |

输出：`out`（类型 `spatialWorld`，图库口，可扇出到多个下游）

相关参数（均在节点 `defaultParams()` 中声明，物化时不会被丢弃）：

| 参数 | 说明 |
|---|---|
| `spatialWorldSeed` | 随机种子，默认 `0`；**`0` 表示不传**，交给上游随机 |
| `spatialWorldPanoMode` | 单图参考的全景判定（官方 `is_pano`）：`auto`（默认，自动识别）/ `always`（强制）/ `never`（关闭） |
| `spatialWorldDisableRecaption` | `true` 时关闭上游 recaption，指令原文直送，默认 `false` |
| `generateModel` | 覆盖世界生成所用的模型 |
| `generateProviderInstanceId` | 提供商实例 id |

## spatialWorld.export（世界导出）

输入：`in-world`（类型 `spatialWorld`，严格同类型）

输出：`out` / `outAll`（类型 `model`）

| 参数 | 取值 | 说明 |
|---|---|---|
| `spatialWorldExportMode` | `mesh`（默认）/ `splats` | `mesh` 登记为模型资产；`splats` 只落 PLY |
| `spatialWorldExportVariant` | `textured`（默认）/ … | 仅 `mesh` 模式有意义 |
| `spatialWorldExportResolution` | `full_res`（默认）/ `500k` / `150k` / `100k` | 泼溅档位；`mesh` 一般用 `full_res` |
| `generateModel` | 模型 id | 覆盖导出所用的模型 |
| `generateProviderInstanceId` | 提供商实例 id | 自建提供商时需要 |

## asset.motion（3D 导演台）

输入：`in-model`（类型 `model`）—— **不接 `spatialWorld`**。

## 工作流里可用的通用参数

这些键在任何节点上都合法（应用 `ALLOWED_PARAM_KEYS`）：

`text`、`generateInstruction`、`generateSystemPrompt`、`skillId`、`generateModel`、
`generateProviderInstanceId`、`generateAspectRatio`、`generateResolution`、`generateQuality`、
`generateDuration`、`generateCount`、`generateStyle`、`generateSeed`、`generateSeedUseGlobal`、
`generateFrameMode`、`generateAudio`、`notes`、`label`、`mediaOutputDir`、
`styleImages`、`styleImagesUseGlobal`、`styleReferenceSubject`、`characterRefs`

## 常见错误

| 现象 | 原因 |
|---|---|
| 连线被拒 / 图看起来"接上了但不跑" | 世界直连导演台。必须过 `spatialWorld.export` |
| 导出报"需要上游世界产物路径" | `splats` 模式需要能定位到世界产物；先跑通世界生成 |
| 参数写了但没生效 | 参数名拼错会被当成"未声明参数"丢弃并在物化 warnings 里列出 —— 先看 warnings |
