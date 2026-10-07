# 端口与参数速查（game3d-asset）

以下端口 id / 参数名取自应用源码
（`src/shared/graph/builtins.ts` 的 `ASSET_META`、`motionProcessingPorts()`、`model3dProcessingPorts()`、
`galleryOutPorts()`、`image.select` 类型定义，以及 `src/shared/graph/graphPlan.ts` 的 `ALLOWED_PARAM_KEYS`），
可直接写进 `graph_edit` 的 `ops[].params` / `fromPort` / `toPort`。

## 节点与端口

### `asset.model3d`（3D 模型生成，图中两处：主角 / 道具）

| 端口 | 方向 | 类型 | 复数 |
|---|---|---|---|
| `in-text` | in | `text` | 是 |
| `in-image` | in | `image` | 是（图生 3D） |
| `out` | out | `model` | 否（当前选中单条，默认连线走它） |
| `out-all` | out | `models` | 是（全部历史，仅 `image.select` 之类复数口能接） |

已声明的私有参数（`defaultParams()`，物化不会被丢）：
`generateModel`、`generateProviderInstanceId`、`generateStyle`、`weight`、`volume`、`muted`、`loop`。

执行期注意：提示词 = `generateInstruction`（展开 `@n` 后）**或**上游文本，二者取其一 ——
指令非空时**上游剧本正文不参与**。见 `src/shared/graph/execute/generateModel3d.ts`。

### `asset.motion`（3D 导演台 / 舞台）

| 端口 | 方向 | 类型 | 复数 | 说明 |
|---|---|---|---|---|
| `in-panorama` | in | `image` | 否 | 全景背景图 |
| `in-model` | in | `model` | 否 | **3D 模型入口，支持挂多条线** |
| `out-shots` | out | `images` | 是 | 站位图（用户在舞台里截图产出，最多留最近 24 张） |
| `out-actions` | out | `videos` | 是 | 动作视频 |

`in-model` 的多线语义（`src/renderer/src/features/director/pickDirectorIncomingModel.ts`）：
按 `assetId` 去重，每一份资产只留"加工最深"的一条，排序为
`动画 > 姿势 > 蒙皮/重拓扑/转换/贴图 > 3D 生成节点`。
可选来源资产类型只认 `model` 与 `model3d`；**动画 / 姿势资产不能放到舞台上**。

**没有 MCP 工具能操作舞台**（摆机位、加几何体、截站位图都只能在界面里做）。

### `image.select`（选站位图）

| 端口 | 方向 | 类型 | 复数 |
|---|---|---|---|
| `in` | in | `images` | 是 |
| `out` | out | `image` | 是 |

- 选中项由 `params.selectedImageId` 决定；没设过就取第一张。
- 没有候选项时 `out` 输出空图（不报错）。
- **只吃复数口**：上游必须是 `out-all` / `out-shots` 这类复数出口；接单数 `out` 会被拒。

### `asset.video`（资产展示视频）

| 端口 | 方向 | 类型 | 复数 |
|---|---|---|---|
| `in-text` | in | `text` | 是 |
| `in-image` | in | `image` | 是（参考图） |
| `in-video` | in | `video` | 是 |
| `in-voice` | in | `voice` | 是 |
| `in-first-frame` | in | `image` | 否（`generateFrameMode` 为 `first` / `first_last` 时注入） |
| `in-last-frame` | in | `image` | 否（仅 `first_last` 时注入） |
| `out` | out | `video` | 否 |
| `out-all` | out | `videos` | 是 |

帧模式（`generateFrameMode`：`none`（默认）/ `first` / `first_last`）：
`first` / `first_last` 时 `in-image` 口**被隐藏**，只留首 / 尾帧口；
模型不支持首帧时会被**回落成 `none`**，此时首帧图不生效。
另：模型声明某类媒体入参上限为 0 时，对应的 `in-image` / `in-video` / `in-voice` 口会被隐藏。

### `play.script` 与 `note.text`

| 类型 | 端口 | 参数 |
|---|---|---|
| `play.script` | `out`（`text`，复数） | `text` |
| `note.text` | 无端口 | `text` |

`note.text` 不参与生成，只是画布上的说明位 —— 不要把用户输入写进去。

## 计划已连的边（可直接对照）

```
script.out      → modelMain.in-text
script.out      → modelProp.in-text
modelMain.out   → motion.in-model
motion.out-shots→ select.in
select.out      → video.in-image
```

`modelProp` **没有出边**，需要时按 SKILL.md 第 4 条自行 `edge_connect`。

## 通用可写参数（`ALLOWED_PARAM_KEYS`）

这些键在任何节点上都合法，写错别的键会被丢弃并记进 `warnings`：

`text`、`generateInstruction`、`generateSystemPrompt`、`skillId`、`generateModel`、
`generateProviderInstanceId`、`generateAspectRatio`、`generateResolution`、`generateQuality`、
`generateDuration`、`generateCount`、`generateStyle`、`generateSeed`、`generateSeedUseGlobal`、
`generateFrameMode`、`generateAudio`、`notes`、`label`、`mediaOutputDir`、
`styleImages`、`styleImagesUseGlobal`、`styleReferenceSubject`、`characterRefs`。

参考图类参数会被额外校验（`sanitizeReferenceParams`）：`characterRefs` 每项必须带 `imageUrl`；
`styleImages` 条目必须带 `libraryId` 或 `data:` 开头的 `dataUrl`；
`styleReferenceSubject` 只能是 `default` / `ui`。不可解析的值会被丢弃并记 warning。

## 常见错误

| 现象 | 原因 |
|---|---|
| 舞台空的 / 双击进去什么都没有 | 上游没跑出模型；或资产不在库且拿不到文件路径；或候选是动画 / 姿势资产（不能当网格放） |
| `out-shots` 没内容 | 用户还没在舞台里截取站位图 |
| 视频节点报无输入 | `select` 上游为空（没截图），或 `select.out` 没接到 `video.in-image` |
| 连线被拒 | `out-shots`（复数）接单数口；或帧模式下还想连 `in-image` |
| 剧本写了但模型没按设定出 | `asset.model3d` 不自动拼上游正文，需把设定写进 `generateInstruction` 或用 `@1` |
| 参数写了但没生效 | 参数名拼错被当"未声明参数"丢弃 —— 先看物化 / `graph_edit` 返回的 `warnings` |
