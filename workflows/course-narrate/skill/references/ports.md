# 端口与参数速查（course-narrate）

字段名与端口 id 均取自应用源码，可直接写进 `graph_edit` 的 `params`。
节点 id 是随机生成的（`node-<uuid>`），改参数前先用 `graph_read`（`includeParams: true`）拿到真实 id。

## 图上的六个节点

| key | typeId | 标题 | 说明 |
|---|---|---|---|
| `script` | `play.script` | 课程讲稿 | 文本源，扇出到形象 / 配音 / 视频 |
| `portrait` | `asset.image` | 主讲人形象 | 出人物图，接 `talking:in-image` |
| `voice` | `asset.voice` | 口播配音 | 出音频，接 `lipSync:in-voice` |
| `talking` | `asset.video` | 口播视频 | 出参考视频，接 `lipSync:in-video` |
| `lipSync` | `video.lipSync` | 口型同步 | 出成片 |
| `note` | `note.text` | 使用说明 | 纯备注，**没有端口**，不参与生成 |

连线（模板固化）：

```
script:out   → portrait:in-text
script:out   → voice:in-text
script:out   → talking:in-text
portrait:out → talking:in-image
talking:out  → lipSync:in-video
voice:out    → lipSync:in-voice
```

## asset.image（主讲人形象）

| 端口 | 类型 | 说明 |
|---|---|---|
| `in-text` | `text`（多） | 讲稿（作上下文） |
| `in-image` | `image`（多） | 参考图 |
| `out` / `out-all` | `image` / `images` | 当前选中 / 全部历史 |

参数：`generateInstruction`、`generateAspectRatio`、`generateResolution`、`generateQuality`、
`generateCount`、`generateModel`、`generateProviderInstanceId`、`generateSeed`、
`mediaOutputDir`，以及参考图族 `styleImages` / `styleImagesUseGlobal` /
`styleReferenceSubject` / `characterRefs`（后者的每项必须带 `imageUrl`，否则被丢弃并告警）。

## asset.voice（口播配音）

| 端口 | 类型 | 说明 |
|---|---|---|
| `in-text` | `text`（多） | 讲稿 —— 这就是"念什么" |
| `in-image` | `image`（多） | 可选参考 |
| `out` / `out-all` | `voice` / `voices` | 当前选中 / 全部历史 |

参数：`generateInstruction`、`generateModel`、`generateProviderInstanceId`、
`mediaOutputDir`；另有播放向参数 `volume` / `muted` / `loop`（节点自带默认值）。

> ⚠️ **声音节点的 `generateInstruction` 是"会被朗读的内容"**，不是给模型的指令。执行时：
> `userPrompt = generateInstruction`；指令里没有 `@` 提及上游时，`in-text`（讲稿）正文会被
> **自动拼在它后面**，两者作为同一段文本送进 TTS，且**刻意不拼系统提示词**
> （源码注释明确说：拼了 TTS 会把那句指令也念出来）。
> 因此：不要把整句指令写进去；不要让 `generateInstruction` 与讲稿正文重复同一段内容；
> 想只念视频/图片等特定上游时用 `@` 提及（有 `@` 时不再自动拼接）。
> 配音时长由这段文本决定，与 `asset.video` 的 `generateDuration` 无关。
> `in-image` 是"方舟声音设计"那类端点的参考图，普通 TTS 用不上。

## asset.video（口播视频）

| 端口 | 类型 | 说明 |
|---|---|---|
| `in-text` | `text`（多） | 讲稿（作上下文） |
| `in-image` | `image`（多） | 人物形象参考 |
| `in-video` | `video`（多） | 可选视频参考 |
| `in-voice` | `voice`（多） | 可选音频参考 |
| `out` / `out-all` | `video` / `videos` | 当前选中 / 全部历史 |

参数：`generateInstruction`、`generateDuration`（模板给 10，单位秒）、`generateAspectRatio`（模板 `9:16`）、
`generateResolution`、`generateAudio`（**设 `false` 即静音**）、`generateFrameMode`、
`generateModel`、`generateProviderInstanceId`、`generateSeed`、`mediaOutputDir`。

> 节点自带的 `durationSec`（播放时长，默认 5）是**本地播放参数**，不是给模型的生成时长 —— 生成时长用 `generateDuration`。

## video.lipSync（口型同步）

| 端口 | 类型 | 说明 |
|---|---|---|
| `in-image` | `image`（**单选**） | 只有没有视频参考时才会用到 |
| `in-video` | `video`（**单选**） | 有则优先 |
| `in-voice` | `voice`（**单选**） | **必需**，缺了直接报错 |
| `in-text` | `text`（多） | 补充提示词 |
| `out` / `out-all` | `video` / `videos` | 成片 |

参数与默认值（节点 `defaultParams()`）：

| 参数 | 默认 | 说明 |
|---|---|---|
| `generateModel` | `''` | 多模态视频模型（Seedance 一类） |
| `generateProviderInstanceId` | `''` | 自建提供商时用 |
| `generateInstruction` | `''` | 留空则用内置的对口型提示词（按"视频 + 音频"/"图片 + 音频"两套口径） |
| `generateSystemPrompt` | 未在 `defaultParams()` 中声明 | 属通用生成参数，键合法可写；留空则用内置系统提示词（保持人物身份、口型紧跟音频、不加字幕水印） |
| `generateAudio` | `true` | 是否让成片带音轨 |
| `generateFrameMode` | `'none'` | 执行时被强制为 `none`（不做首尾帧） |

## 执行行为（决定怎么连）

- 音频来源：先看 `in-voice`，再回退 `in`；从**相对路径**或资产 id 解析参考音频。
- 视觉来源：**有视频就只用视频**（`in-image` 被跳过）；没有视频时才取图片。
- 提示词按视觉类型切换：有视频 → "保持视频 1 的形象/运镜，口型跟随音频 1"；只有图片 → "图片 1 中角色对镜说话"。
- 强制参考音驱动 + `frameMode: none`，不做首尾帧拼装。

## 常见错误

| 现象 | 原因 |
|---|---|
| 报缺音频 / 缺画面 | `in-voice` 或（视频 + 图片都）没接上 |
| 连线被拒 | `in-image` / `in-video` / `in-voice` 是单选口，一个口只能一条边 |
| 成片里人物形象不对 | 视频参考没接，退化成了用 `in-image` 单图驱动 |
| 参数写了但没生效 | 键名拼错会作为"未声明参数"被丢弃，看 `graph_edit` / 物化的 warnings |
| 连了首尾帧却不生效 | 该节点强制 `frameMode: none`，这是设计而非 bug |
