# 端口与参数速查（product-ad）

字段名与端口 id 取自应用源码，可直接写进 `graph_edit` 的 `params`。**参数名拼错会被当作"未声明参数"丢弃**并在物化 warnings 里列出 —— 先看 warnings。

## play.script（卖点文案）

| 端口 | 方向 | 类型 | 说明 |
|---|---|---|---|
| `out` | out | `text`（multiple） | 正文；扇出到两张图节点的 `in-text` |

参数：`text`（正文；执行时原样输出）、`label`、`notes`。

- 它是 `note` 分类里的**文本节点**，执行时**不调用任何模型**。
- 没有输入端口。要"让 AI 写卖点"，用会调文本模型的节点（如 `asset.screenplay` / `asset.gameSystem`），本工作流没有它们。

## asset.image（产品主视觉 / 使用场景图）

| 端口 | 方向 | 类型 | 说明 |
|---|---|---|---|
| `in-text` | in | `text`（multiple） | 上游正文（卖点文案走这里） |
| `in-image` | in | `image`（multiple） | 参考图（**产品实拍图**放这里） |
| `out` | out | `image` | 当前选中图；主视觉的 `out` 接给视频节点 |
| `out-all` | out | `images` | 全部历史（复数类型，接 select 一族） |

参数：

| 参数 | 预设值 | 说明 |
|---|---|---|
| `generateInstruction` | 主视觉：「产品英雄图，突出质感与卖点」；场景：「产品真实使用场景」 | 生图指令 |
| `generateAspectRatio` | 未设（预设为空） | 宽高比，如 `1:1` / `9:16` / `16:9`；空则由模型/默认决定 |
| `generateResolution` / `generateQuality` / `generateCount` | — | 分辨率 / 质量 / 一次几张 |
| `generateModel` / `generateProviderInstanceId` | `''` | 指定模型 / 自建提供商实例 |
| `generateSeed` / `generateSeedUseGlobal` | 跟随全局 | 复现固定结果 |
| `styleImages` / `styleImagesUseGlobal` / `styleReferenceSubject` | — | 风格参考图；`styleReferenceSubject` 只能是 `default` / `ui` |
| `characterRefs` | — | 角色引用，**每条必须带 `imageUrl`** |
| `mediaOutputDir` | — | 落盘目录 |

行为要点：无 `@` 引用语法时，上游 `in-text` 的文本会**追加**在 `generateInstruction` 之后一起送去生图；有 `@` 时只按 `@n` 选中的上游值拼接。

## asset.video（广告短视频）

| 端口 | 方向 | 类型 | 说明 |
|---|---|---|---|
| `in-text` | in | `text`（multiple） | 文本参考 |
| `in-image` | in | `image`（multiple） | 图片参考（走 `image_url`）；**场景图可以接这里** |
| `in-video` | in | `video`（multiple） | 视频参考 |
| `in-voice` | in | `voice`（multiple） | 音频参考 |
| `in-first-frame` | in | `image` | **首帧**专用口（仅在帧模式下生效） |
| `in-last-frame` | in | `image` | **尾帧**专用口（仅在 `first_last` 下生效） |
| `out` | out | `video` | 当前选中视频 |
| `out-all` | out | `videos` | 全部历史 |

参数：

| 参数 | 预设值 | 说明 |
|---|---|---|
| `generateInstruction` | 「产品特写与使用场景结合的短广告」 | 视频提示词 |
| `generateDuration` | `10`（秒）；节点默认 `durationSec: 5` | 时长**秒**；被模型能力表 clamp；≤0 / 非数忽略 |
| `generateAspectRatio` | 未设（预设为空） | 宽高比；**在意比例就显式写**，否则由能力表决定 |
| `generateResolution` | — | 分辨率；被能力表 clamp |
| `generateFrameMode` | `none`（默认） | `none` / `first` / `first_last`；模型不支持时自动降级 |
| `generateAudio` | 缺省由模型决定 | 是否生成音频 |
| `generateSeed` / `generateSeedUseGlobal` | 跟随全局 | 复现固定结果 |
| `generateModel` / `generateProviderInstanceId` | `''` | 指定模型 / 自建提供商实例 |
| `mediaOutputDir` | — | 落盘目录 |

行为要点：

- **首帧模式与图片参考互斥**：首帧口拿到图后，提交时会丢掉 `image_url` 类参考。
- 参考图数量有上限（默认最多 14 张），**风格图优先占位**。
- 视频是**异步长任务**：提交后轮询任务状态，不要阻塞等待。

## 工作流里可用的通用参数

任何节点上都合法（应用 `ALLOWED_PARAM_KEYS`）：

`text`、`generateInstruction`、`generateSystemPrompt`、`skillId`、`generateModel`、
`generateProviderInstanceId`、`generateAspectRatio`、`generateResolution`、`generateQuality`、
`generateDuration`、`generateCount`、`generateStyle`、`generateSeed`、`generateSeedUseGlobal`、
`generateFrameMode`、`generateAudio`、`notes`、`label`、`mediaOutputDir`、
`styleImages`、`styleImagesUseGlobal`、`styleReferenceSubject`、`characterRefs`

## 注意：本工作流没有 note.text

`product-ad` 的四个节点全部参与生成（`play.script` → 两张 `asset.image` → `asset.video`）。
如果要用纯说明性的便签，加 `note.text` 节点即可 —— 它不参与生成，删了也不影响产物。

## 常见错误

| 现象 | 原因 |
|---|---|
| `GRAPH_PROCESS_NO_INPUT` | 主视觉还没出图就跑了视频节点；或指令与上游文案都为空 |
| 成片比例 / 时长不是写的值 | 未显式指定比例（预设为空）／模型能力表 clamp；先确认模型支持再改参数 |
| 产品包装 / logo 与实拍不一致 | 只写了文字描述。把产品实拍图接到 `in-image` 能明显改善，但不能保证一致 |
| 视频里没有使用场景 | 场景图默认没连到视频节点；把它接到视频的 `in-image`，或在视频指令里写明 |
| 首帧不生效 | `generateFrameMode` 还是 `none`，或图接在 `in-image` 而不是 `in-first-frame` |
| 参数写了但没生效 | 参数名拼错（看物化 warnings），或该参数在所选模型上不被支持 |
