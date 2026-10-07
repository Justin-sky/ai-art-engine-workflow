# 端口与参数速查（director-previz）

字段名与端口 id 均取自应用源码，可直接写进 `graph_edit` 的 `params`。
节点 id 是随机生成的（`node-<uuid>`），改参数前先用 `graph_read`（`includeParams: true`）拿到真实 id。

## 图上的六个节点

| key | typeId | 标题 | 说明 |
|---|---|---|---|
| `brief` | `play.script` | 分镜与场景需求 | 文本源，扇出到全景图与预演成片 |
| `pano` | `asset.image` | 全景氛围参考 | 出全景图，接 `motion:in-panorama` |
| `motion` | `asset.motion` | 导演台预演 | 3D 舞台；出口是站位图与动作视频 |
| `select` | `image.select` | 选站位图 | 多图 → 单图 |
| `video` | `asset.video` | 预演成片 | 站位图 + 文本 → 视频 |
| `note` | `note.text` | 使用说明 | 纯备注，**没有端口**，不参与生成 |

连线（模板固化）：

```
brief:out        → pano:in-text          （无 fromPort/toPort，按类型自动选口）
pano:out         → motion:in-panorama
motion:out-shots → select:in
select:out       → video:in-image
brief:out        → video:in-text
```

## asset.motion（导演台 / Director Deck）

`typeId` 是 `asset.motion`（由 `assetType: 'motion'` 派生）。加工节点的端口：

| 端口 | 类型 | 单/多 | 说明 |
|---|---|---|---|
| `in-panorama` | `image` | **单选** | 全景背景图 → 贴到舞台球内壁 |
| `in-model` | `model` | **单选** | 3D 模型 → 舞台上实例化；**本工作流没连** |
| `out-shots` | `images` | 多 | 站位截图列表 |
| `out-actions` | `videos` | 多 | 动作视频列表 |

节点参数：`viewer`（默认视角 `{ position, rotation, scale, target, fov: 50 }`）。舞台与站位截图存在
`params.cameraShots` / `params.cameraVideos` / `params.previewDataUrl` / `params.previewRelativePath`
（这些由舞台写回，不是生成参数）。

执行行为（`executeCamera3dNode`）：

- `out-shots` = `cameraShots`（过滤掉既无 `dataUrl` 又无 `relativePath` 的项）；
  **列表为空时回退** `previewDataUrl`，再回退 `previewRelativePath`。
- `out-actions` = `cameraVideos`。
- 画布上拖入的**导演台资产引用**走另一条执行分支（从资产的 `stagesByNodeId` 读站位/动作），
  本工作流用的是加工节点这一支。

### 舞台能力（用户在 UI 里操作）

- 全景背景：有 `in-panorama` 上游时**自动加载**为背景球；没有则用默认天空色。背景球半径有上限
  （默认 500，可调），有背景时相机不能拉到球外。
- 基础几何体（`STAGE_PRIMITIVE_VALUES`，落盘白名单与之同源）：
  `arch` `box` `capsule` `cone` `cross` `cylinder` `disc` `hemisphere` `icosphere` `octahedron`
  `plane` `pointedArch` `prism` `pyramid` `quad` `ring` `sphere` `tetrahedron` `torus` `tube` `wedge`
- 变换工具：`translate` / `rotate` / `scale`。
- 画幅比例：`DIRECTOR_ASPECT_RATIOS`（舞台内的截图比例，独立于生成节点的 `generateAspectRatio`）。
- 站位截图：按 **720 宽**渲染（高度按画幅比例算），`toDataURL('image/jpeg', 0.72)`；
  列表上限 **24** 张（`slice(-24)`，超出丢最旧）。截完会打开「站位 / 动作」面板。
- 每个导演台节点在 `genParams.stagesByNodeId` 里有独立舞台场景；节点被删/重置时对应场景会被清理。

## image.select（选站位图）

| 端口 | 类型 | 单/多 | 说明 |
|---|---|---|---|
| `in` | `images` | 多 | 站位图列表（`motion:out-shots` 接这里） |
| `out` | `image` | 多 | 选中的一张 |

行为（`executeSelectImageNode`）：

- 用 `params.selectedImageId` 在列表里找；找不到或为空时**回退 `items[0]` —— 最早截的那张**。
- 也认 `index:<n>` 形式的 id。
- 执行后把 `selectedImageId` / `previewDataUrl` / `previewRelativePath` 写回节点。
- 列表为空时输出空图 `{ kind: 'image', dataUrl: '' }`，**不报错**。

## asset.video（预演成片）

| 端口 | 类型 | 单/多 | 说明 |
|---|---|---|---|
| `in-text` | `text` | 多 | 分镜与场景需求 |
| `in-image` | `image` | 多 | 站位图（帧模式为 `none` 时当**参考图**用） |
| `in-video` | `video` | 多 | 可选视频参考 |
| `in-voice` | `voice` | 多 | 可选音频参考 |
| `out` / `out-all` | `video` / `videos` | 单 / 多 | 成片 |

参数：`generateInstruction`、`generateDuration`（模板给 8）、`generateAspectRatio`、
`generateResolution`、`generateAudio`、`generateFrameMode`、`generateModel`、
`generateProviderInstanceId`、`generateSystemPrompt`、`mediaOutputDir`。

> **首帧模式是可选项、不是模板现状**：视频节点只在 `generateFrameMode` 为 `first` / `first_last` 时
> 才动态长出 `in-first-frame`（`in-last-frame`）端口；此时图片走帧口，`in-image` 的参考图会被剔除
> （两类参考互斥）。模板用的是默认 `none` + `in-image`，所以**不要**在不改帧模式的情况下把站位图
> 接到帧口（端口根本不存在），也不要在改了帧模式后还指望 `in-image` 同时当参考图。

## 全景图（`asset.image` 节点）

| 参数 | 说明 |
|---|---|
| `generateAspectRatio` | **必须 `2:1`**；缺省时模型自由取比例，贴到球上会变形 |
| `generateInstruction` | 场景氛围描述；可用应用生成面板里那个「720 全景」指令预设（要求 2:1、2048×1024 或 4096×2048） |
| `generateResolution` | 2:1 时优先 2048×1024 / 4096×2048 量级 |
| `generateCount` | 一次多张；下游 `in-panorama` 是**单选口**，只吃 `out`（默认最新一张） |

## 与相邻工作流的端口差异（最容易连错的地方）

| 需求 | 正确来源 | 为什么 |
|---|---|---|
| 给导演台一个 3D 模型 | `model.*` / `spatialWorld.export:out` | `in-model` 只吃 `model` |
| 给导演台一个空间世界 | **必须先过 `spatialWorld.export`** | `spatialWorld` 与 `model` **严格同类型**，直连会被拒 |
| 把导演台结果变成成片 | `out-shots → image.select → asset.video:in-image` | `out-shots` 是复数类型，`asset.video:in-image` 是单数 |
| 要导演台的动态输出 | `out-actions`（类型 `videos`） | 本工作流没接；接了要用 `video.select` 一族 |

## 常见错误

| 现象 | 原因 |
|---|---|
| 连线被拒（多图 → 单图） | 导演台直连 `asset.video:in-image`；中间必须有 `image.select` |
| 全景背景被拉伸 | 全景图不是 2:1；多半是被 `workflow_use_installed` 的统一宽高比覆盖了 |
| 下游拿到一张奇怪的图 | 舞台里没有任何站位截图，走了 `previewDataUrl` 兜底 |
| 选中的构图不对 | 没设 `selectedImageId`，回退到了最早那张 |
| 参数写了但没生效 | 键名拼错会作为"未声明参数"被丢弃，看 `graph_edit` / 物化的 warnings |
