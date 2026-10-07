# 端口与参数速查（anim2d-gif）

字段名与端口 id 取自应用源码，可直接写进 `graph_edit` 的 `params`。**参数名拼错会被当作"未声明参数"丢弃**，并在物化的 warnings 里列出 —— 先看 warnings。

## asset.image（动作序列图，上游）

| 端口 | 方向 | 类型 | 说明 |
|---|---|---|---|
| `in-text` | in | `text`（multiple） | 上游正文/提示词 |
| `in-image` | in | `image`（multiple） | 参考图（角色一致性、画风参考） |
| `out` | out | `image` | 当前选中图 |
| `out-all` | out | `images` | 全部历史（复数类型，接 `image.select` 一族） |

相关参数：

| 参数 | 说明 |
|---|---|
| `generateInstruction` | 生图指令。工作流预设已写「1 行 4 列分格、帧序从左到右、格子无缝拼接、无边框与分隔线、各格外观一致」 |
| `generateAspectRatio` / `generateResolution` / `generateQuality` | 宽高比 / 分辨率 / 质量 |
| `generateCount` | 一次生成几张 |
| `generateModel` / `generateProviderInstanceId` | 指定模型 / 自建提供商实例 |
| `styleImages` / `styleImagesUseGlobal` / `styleReferenceSubject` | 风格参考图；`styleReferenceSubject` 只能是 `default` / `ui` |
| `characterRefs` | 角色引用，**每条必须带 `imageUrl`**（只写角色名解析不出参考图） |
| `mediaOutputDir` | 落盘目录 |

行为要点：无 `@` 引用语法时，上游 `in-text` 的文本会**追加**在 `generateInstruction` 之后一起送去生图。

## anim.2d（2D帧动画，核心）

| 端口 | 方向 | 类型 | 说明 |
|---|---|---|---|
| `in` | in | `image`（`multiple: false`） | 序列图，**只接一条**；取第一项 |
| `out` | out | `image` | 当前帧 |
| `out-all` | out | `images` | 全部帧 |
| `out-gif` | out | `image` | 运行后合成的 GIF（`animGifFps > 0` 时产出），并落盘为工程资产 |

参数（`defaultParams()` 声明，物化时不会被丢弃）：

| 参数 | 取值 / 默认 | 说明 |
|---|---|---|
| `animRows` | 1~6，默认 `1` | 切格行数；超出范围会被 clamp |
| `animCols` | 1~6，默认 `4`（预设 `4`） | 切格列数 |
| `animPresetId` | `idle` / `walk` / `run` / `jump` / `attack` / `hurt` / `skill`，默认 `walk` | 生成侧动作预设 id |
| `animInstruction` | 字符串，默认 `''` | 生成侧动作描述（为空时回退 preset 的 prompt） |
| `animGifFps` | `0`（关闭）~ `24`，节点默认 `0` | **>0 才合成 GIF**；预设为 `12`；非数字 / ≤0 → 关闭 |
| `animKeyColor` | `''` / `'black'` / `'white'`，默认 `''` | 纯色背景键控透明；生成侧与切帧侧同时生效 |
| `animAssetId` | 资产 id，默认 `''` | 内图资产 id；`in` 端口无输入时**回退**从它软解析序列图与行列 |
| `animGraphVersion` | 数字 | 内图结构版本（结构变更时递增） |
| `text` | 字符串 | 备注文本 |
| `mediaOutputDir` | 字符串 | 帧 / GIF 的落盘目录 |

运行时写回节点参数的产物字段（不要手工伪造）：`animGridImage`、`animGifRelativePath`、`animGifFps`、`animGifFrameCount`、`animGifWidth`、`animGifHeight`。

行为要点：

- 行列的**权威来源**是内图里的「生成帧动画序列图」节点（`frame.animGen`）；存在内图时，其 `animRows` / `animCols` / `animKeyColor` 会**覆盖**外层同名参数（`readAnim2dFromNode` 只在没有内图状态时生效）。
- 每次 cook **只保留本次切分结果**，不累积历史。
- 切格使用整数切分 + `edgeInset: 'auto'` 内缩；`animKeyColor` 非空时同时做 chroma key。

## note.text（出图说明）

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
| `GRAPH_PROCESS_NO_INPUT` | `anim.2d` 的 `in` 没接到图，且 `animAssetId` 也没有可软解析的序列图；先跑上游 |
| GIF 没产出，只有帧 PNG | `animGifFps = 0`（默认就是关闭）／帧数不足 2／执行环境没有帧合成能力 |
| 切出来的帧错位、每帧带着邻居的边 | `animRows` × `animCols` 与图上真实格数不一致，或序列图有可见格线 / 留白 |
| 背景变透明但主体也被啃掉 | `animKeyColor` 设成了 `black`/`white`，而画面主体本来就有大片纯黑/纯白 |
| 参数写了但没生效 | 参数名拼错，或写了外层 `animRows`/`animCols` 而节点上有内图（内图值优先） |
