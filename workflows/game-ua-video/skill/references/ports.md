# 端口与参数速查（game-ua-video）

字段名与端口 id 取自应用源码，可直接写进 `graph_edit` 的 `params`。**参数名拼错会被当作"未声明参数"丢弃**并在物化 warnings 里列出 —— 先看 warnings。

## play.script（卖点与旁白）

| 端口 | 方向 | 类型 | 说明 |
|---|---|---|---|
| `out` | out | `text`（multiple） | 正文；接下游生图节点的 `in-text` |

参数：`text`（正文本身；执行时把 `text` 原样输出）、`label`、`notes`。

- 注意：它是 `note` 分类里的**文本节点**，不是"剧本生成"节点 —— 执行时**不做任何模型调用**，只把你写进去的 `text` 送出去。
- 没有输入端口。要"让 AI 写文案"，那是另一条链路（`asset.screenplay` / `asset.gameSystem` 之类会调文本模型的节点），本工作流没有它们。

## asset.image（关键分镜图）

| 端口 | 方向 | 类型 | 说明 |
|---|---|---|---|
| `in-text` | in | `text`（multiple） | 上游正文（卖点文案走这里） |
| `in-image` | in | `image`（multiple） | 参考图（游戏截图 / 关键视觉） |
| `out` | out | `image` | 当前选中图；本工作流接给视频节点 |
| `out-all` | out | `images` | 全部历史（复数类型，接 select 一族） |

参数：`generateInstruction`（预设：「竖屏游戏买量关键帧，角色清晰，强视觉冲击」）、`generateAspectRatio`、`generateResolution`、`generateQuality`、`generateCount`、`generateModel`、`generateProviderInstanceId`、`generateSeed`、`generateSeedUseGlobal`、`styleImages`、`styleImagesUseGlobal`、`styleReferenceSubject`（只能是 `default` / `ui`）、`characterRefs`（每条须带 `imageUrl`）、`mediaOutputDir`。

行为要点：无 `@` 引用语法时，上游 `in-text` 的文本会**追加**在 `generateInstruction` 之后；有 `@` 时只按 `@n` 选中的上游值拼接。

## asset.video（买量视频）

| 端口 | 方向 | 类型 | 说明 |
|---|---|---|---|
| `in-text` | in | `text`（multiple） | 文本参考 |
| `in-image` | in | `image`（multiple） | 图片参考（普通参考，走 `image_url`） |
| `in-video` | in | `video`（multiple） | 视频参考 |
| `in-voice` | in | `voice`（multiple） | 音频参考 |
| `in-first-frame` | in | `image` | **首帧**专用口（仅在帧模式下生效） |
| `in-last-frame` | in | `image` | **尾帧**专用口（仅在 `first_last` 下生效） |
| `out` | out | `video` | 当前选中视频 |
| `out-all` | out | `videos` | 全部历史 |

参数：

| 参数 | 取值 / 默认 | 说明 |
|---|---|---|
| `generateInstruction` | 预设：「15 秒左右竖屏广告节奏，承接关键帧画面」 | 视频提示词 |
| `generateDuration` | 预设 `15`（秒）；节点默认 `durationSec: 5` | 时长**秒**；会被模型能力表 clamp；非法值（≤0 / 非数）忽略 |
| `generateAspectRatio` | 预设 `9:16` | 宽高比；会被能力表 clamp |
| `generateResolution` | 字符串 | 分辨率；会被能力表 clamp |
| `generateFrameMode` | `none`（默认）/ `first` / `first_last` | 帧模式；模型不支持时自动降级（`first_last` → `first` → `none`） |
| `generateAudio` | 布尔（缺省由模型决定） | 是否生成音频；模型声明支持时才有意义 |
| `generateSeed` / `generateSeedUseGlobal` | 数字 / 布尔（默认跟随全局） | 复现固定结果 |
| `generateModel` / `generateProviderInstanceId` | 字符串 | 指定模型 / 自建提供商实例 |
| `mediaOutputDir` | 字符串 | 落盘目录 |

行为要点：

- **首帧 / 首尾帧模式与图片参考互斥**：一旦首帧口拿到图，提交时会丢掉 `image_url` 类参考（部分模型不允许尾帧与参考图混用）。
- 参考图数量有上限（默认最多 14 张），风格图**优先占位**，端口参考图用剩下的额度。
- 视频是**异步长任务**：提交后靠任务状态轮询，不要阻塞等待。

## note.text（剪辑说明）

无端口，不参与生成。参数只有 `text`。

## 工作流里可用的通用参数

任何节点上都合法（应用 `ALLOWED_PARAM_KEYS`）：

`text`、`generateInstruction`、`generateSystemPrompt`、`skillId`、`generateModel`、
`generateProviderInstanceId`、`generateAspectRatio`、`generateResolution`、`generateQuality`、
`generateDuration`、`generateCount`、`generateStyle`、`generateSeed`、`generateSeedUseGlobal`、
`generateFrameMode`、`generateAudio`、`notes`、`label`、`mediaOutputDir`、
`styleImages`、`styleImagesUseGlobal`、`styleReferenceSubject`、`characterRefs`

## 常见错误

| 现象 | 原因 |
|---|---|
| `GRAPH_PROCESS_NO_INPUT` | 上游图没跑出来就跑了视频节点；或指令与上游文本都为空 |
| 视频时长 / 比例不是写的值 | 模型能力表 clamp；换支持该时长 / 比例的模型，而不是改同一个数反复重试 |
| 首帧不生效 | `generateFrameMode` 还是 `none`，或改用了 `in-image` 而非 `in-first-frame` |
| 写了参考图但 API 没收到 | `in-image` 没接线，或参考图数量被上限挤掉（风格图优先占位） |
| 参数写了但没生效 | 参数名拼错（看物化 warnings），或该参数在所选模型上不被支持 |
