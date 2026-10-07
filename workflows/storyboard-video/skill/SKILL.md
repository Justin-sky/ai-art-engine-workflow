---
name: wf-storyboard-video
description: 用「分镜出片」工作流把一份镜头列表变成 3 张分镜图 + 1 段高潮镜头短视频，并可经成片时间线合成 MP4。当用户要分镜图、故事板、把镜头脚本画出来、或给某个镜头出一小段视频时加载本技能。
workflow: storyboard-video
workflow-version: 1.0.0
---

# 分镜出片（storyboard-video）

## 这条工作流产出什么

`镜头列表 → 分镜 1 / 2 / 3（三张图）→ 高潮镜头视频（1 段视频）`

产物是 **3 张分镜位图 + 1 段 5 秒视频**。

**重要澄清（不要承诺过头）**：图里**没有**串片节点，这条工作流自己**不会**把三张分镜自动剪成
一条成片 MP4。所谓"出片"要用户（或你）另外做一步：把图铺进成片时间线再导出（见下节）。
一条 `generateInstruction` 只对应一个镜头的一张图 —— 三个分镜节点就是三个镜头，不是三个候选。

## 什么时候用 / 什么时候别用

用：

- 用户给了（或愿意写）**按镜头列的镜头列表**，要故事板 / 分镜图。
- 只要一两个镜头的画面，或要给某个关键镜头配一小段动态。

别用，改走这些：

- 要**整套短剧流水线**（剧本 → 节拍 → 宫格 → 多条动态视频）→ `short-drama` 或 `short-drama9`。
  本工作流没有节拍拆分、没有宫格、没有 Agent 复核。
- 要**游戏买量短视频**（带卖点文案节奏）→ `game-ua-video`。
- 要**漫画页排版导出**（把分镜拼成漫画页）→ `comic-publish`。
- 要**把一张序列图切成逐帧 + GIF** → `anim2d-gif`。
- 要**已有视频串成成片 / 掐掉静默** → 那是 `timeline_rough_cut` + `timeline_export` 的活，不是本工作流。
- 要**导演台式预演**（3D 搭景、锁机位、出站位图）→ `director-previz`。

## 上游输入怎么给

用户要提供 **一份按镜头列的镜头列表**，写进 `play.script` 节点（默认标题「镜头列表」）的 `text`：

```json
{ "op": "node_update", "nodeId": "<shots 节点 id>", "params": { "text": "镜头1：<画面说明>｜<对白>\n镜头2：…\n镜头3：…\n高潮：…" } }
```

`shots.out`（类型 `text`）扇出到 `board1` / `board2` / `board3` 的 `in-text`。执行期行为（已核对）：

- 三条 `generateInstruction` 都不含 `@n`，所以整段镜头列表会被**自动拼进每张图的提示词**
  —— 每张分镜都会"看到"全部三个镜头的描述。
- 因此**把分镜与镜头绑定的是 `generateInstruction`，不是剧本**。默认值如下，改这里而不是重排剧本：

| 节点 key | 默认标题 | `generateInstruction` 默认值 |
|---|---|---|
| `board1` | 分镜 1 | 镜头 1 分镜图 |
| `board2` | 分镜 2 | 镜头 2 分镜图 |
| `board3` | 分镜 3 | 镜头 3 分镜图 |
| `clip` | 高潮镜头视频 | 基于关键分镜生成短视频（`generateDuration: 5`） |

- 建议把 `generateInstruction` 写得比默认值具体（景别 / 机位 / 光线 / 人物动作），
  因为模型同时看到全篇镜头表，指令太泛会导致三张图撞车。

`clip` 的输入是 `board2.out` → `clip.in-image`（类型 `image`）。在默认帧模式下这是**参考图**，
不是首帧；要把它当首帧用还得改 `generateFrameMode`，见「关键约束」第 5 条。

还有一张 `note.text`（「剪辑顺序」），**没有端口、不参与生成**，只是给人看的建议顺序。
不要把用户输入往 `note.text` 里塞。

## 关键约束与顺序

1. **先落地工作流**：`workflow_use_installed({ id: "storyboard-video" })` 返回 `assetId`，
   后续 `graph_edit` / `task_run` / 时间线操作都用这个 `assetId`。
2. **拓扑**：`shots → board1 / board2 / board3`，然后 `board2 → clip`。
   **只有 `board2` 接进视频**：`board1` / `board3` 不参与出片。想让视频用另一张关键分镜，
   就改 `clip` 的入边（`edge_delete` + `edge_connect`，`toPort: "in-image"`），别指望它自动挑。
3. **`out` 与 `out-all` 不互通**：分镜节点的 `out` 是单张（`image`），`out-all` 是复数（`images`）。
   视频节点的 `in-image` 是单数口，只吃 `out`。连 `out-all` 会被回退成默认口 —— 明确写 `fromPort: "out"`。
4. **`task_run` 跑整张图**：三张分镜 + 视频会被**全部重新生成**。只重跑一张时用界面单节点执行。
5. **想真正"图生视频"而不是"参考图生视频"**：设该视频节点的 `generateFrameMode: "first"`，
   并接 `in-first-frame`（`inPort`/`toPort` 用 `in-first-frame`）。
   帧模式下 `in-image` 口会被隐藏；模型不支持首帧时 `generateFrameMode` 会**回落到 `none`**，
   此时首帧图不会被使用。不确定就先用默认的参考图模式。
6. **参数写给哪**：`generateInstruction` / `generateAspectRatio` / `generateResolution` / `generateQuality` /
   `generateCount` / `generateDuration` / `generateSeed` / `generateSeedUseGlobal` / `generateModel` /
   `generateProviderInstanceId` / `styleImages` / `characterRefs` 写在**每个节点自己**的 params 上。
   `clip` 已有 `generateDuration: 5`（视频时长默认就是 5 秒档）。
7. **要成片 MP4 时的正确路径**（工作流本身不提供）：
   先 `task_run` 出图 → 找到承载时间线的剧本资产 → `timeline_edit`
   （`op: "add"`，`clips` 每项给 `track: "video"` + `durationSec` + 分镜图的 `assetId` 或
   `relativePath`，`startSec` 缺省自动排到轨尾，`apply: true` 才落盘）→ `timeline_export`。
   注意 `timeline_*` 工具作用在**剧本资产的时间线**上，`assetId` 是那条剧本，不是本工作流的 `assetId`。
   时间线编辑器打开时写不进去，需先关闭。
8. **参数名写错不会报错**：白名单外的键会被丢弃并写进 `warnings`。应用后先读 `warnings`。

## 常见追问怎么答

- **"能自动串成一条视频吗？"** 这条工作流不能。它出的是三张图 + 一段视频。
  串片要用 `timeline_edit` + `timeline_export`（第 7 条），或用户在界面里把素材铺到时间线。
- **"分镜能保持一致的角色吗？"** 默认不能。三个分镜是三次独立生成、彼此没有参考图连线；
  而且每张都读到全部三个镜头的描述，容易串味。要一致就把第一张接到其余分镜的 `in-image`。
- **"能出超过 3 个镜头吗？"** 复制分镜节点即可（`node_upsert`，`typeId: "asset.image"`），
  `shots.out` 可以扇出多条边；每新加一个节点要自己写 `generateInstruction`。
- **"视频能多长 / 多分辨率？"** 由所配视频模型的能力决定，`generateDuration` 只是请求值，
  最终会被钳到模型支持档位。档位不确定就用 `models_list` 查。
- **"能配旁白 / 对白吗？"** 不能，本链路没有声音节点、也没有对口型节点。
  口播走 `course-narrate`；短剧流水线走 `short-drama9`。
- **"为什么只有一段视频？"** 因为计划里只有 `clip` 一个视频节点，且只接 `board2`。
  要每镜都出视频，按上面第 7 条之外另行复制视频节点。

## 参数去哪查

本工作流 6 个节点、无私有参数，故不另写 `references/`。端口 / 参数不确定时用 `graph_node_types`
查实（含端口 id 与默认参数），不要靠猜。
