---
name: wf-game3d-asset
description: 用「游戏3D资产」工作流把一段资产设定做成 3D 模型预演：文生 3D 模型 → 进 3D 导演台摆机位 → 截站位图 → 出资产展示视频。当用户要游戏角色 / 道具的 3D 资产、旋转展示、或要进导演台预演时加载本技能。
workflow: game3d-asset
workflow-version: 1.0.0
---

# 游戏3D资产（game3d-asset）

## 这条工作流产出什么

`资产设定 → 主角 3D 模型 + 配套道具模型（GLB）→ 导演台预演 → 选站位图 → 资产展示视频`

产物是 **两个 GLB 3D 模型资产 + 一张站位图 + 一段展示视频**。

两个模型节点**各出各的**：`modelMain` 接进导演台，`modelProp` 在计划里**没有连线**，
是留给你按需接进去的第二份素材。展示视频是"站位图 → 图生视频"，
所以它是**基于截图的运镜视频**，不是真在 3D 场景里渲染出来的动画。

## 关键约束：导演台这一步没有 MCP 工具，必须由用户在界面里操作

这是本工作流最容易翻车的地方，不要向用户承诺"全自动出展示视频"。

已核对：应用的 MCP 工具清单里**没有任何导演台（`asset.motion`）工具** ——
没有摆机位、没有放几何体、没有"截取站位图"。所以：

- **AI 能做的**：落地工作流、改参数、生成两个 GLB、接线（`graph_edit`）、跑 `task_run`、调 `generate_video`。
- **只能用户做的**：在画布上**双击导演台节点进入舞台**、用基础几何体补景、摆机位、
  **在舞台里截取站位图**（截图写进节点 params，`out-shots` 才有内容）。

`select`（`image.select`）只会从收到的图里挑一张；截图为空时它输出空图，
下游视频节点会因为没有可视输入而失败。**所以正确顺序是"先让用户截好图，再跑视频节点"。**

## 什么时候用 / 什么时候别用

用：

- 用户要**游戏角色 / 道具 / 载具的 3D 资产**，想要一个能看的展示视频或预演图。
- 用户明确说"进导演台""摆机位""出个环绕展示"。

别用，改走这些：

- 只要**概念图 / 设定图**（不建模）→ `character-sheet`。
- 要**空间世界 / 可进入的环境**（不是单体模型）→ `world-model`；
  那条链路的世界出口类型是 `spatialWorld`，**必须先过 `spatialWorld.export` 才能接导演台**，
  本工作流的 `asset.model3d` 出的就是 `model`，可以直接接 `in-model`，两者不要混。
- 要**纯图/视频预演而不建模** → `director-previz`（3D导演台预演，全景参考 + 几何体搭景）。
- 要**可玩 HTML 游戏** → 走应用的游戏链路（`gameplay_prepare_project` / `gameplay_build`），
  不是这条工作流；本工作流不产可玩产物。
- 要**UI 界面 / 图标包** → `game-ui` / `game-icons`。
- 要**买量短视频** → `game-ua-video`。

## 上游输入怎么给

### 1. 资产设定（`script`，`play.script`）

写进 `play.script` 节点（默认标题「资产设定」）的 `text`：

```json
{ "op": "node_update", "nodeId": "<script 节点 id>", "params": { "text": "外观 / 材质 / 比例 / 用途（角色、道具还是载具）" } }
```

**必须注意（与图片节点不同）**：`asset.model3d` 的执行器**不会**把上游剧本正文自动拼进提示词 ——
它的提示词是 `generateInstruction || 上游文本`，指令一旦非空，剧本正文就被**整个忽略**。
所以要引用剧本，只有两条路：

- **推荐**：把设定直接写进两个模型节点各自的 `generateInstruction`（自带完整描述）；
- 或在 `generateInstruction` 里用 `@1` 引用（运行期会展开成 `script` 的正文）。
  `@1` 指第一条入边，这里就是 `script`。写了 `@n` 后"自动拼接"会关闭，只剩展开后的指令。

### 2. 模型与风格

- `generateModel` / `generateProviderInstanceId`：3D 生成模型。缺省用应用当前选择的
  （`workflow_use_installed` 也能收 `imageModel` / `videoModel`，但那是给图片 / 视频节点的）。
- `generateStyle`：3D 风格档位，取值为
  `photorealistic` / `cartoon` / `anime` / `hand_painted` / `cyberpunk` / `fantasy` / `glass`。
- 参考图（图生 3D）：把图片接到模型节点的 `in-image`。可选，不接就是纯文生 3D。

### 3. 展示视频（`video`，`asset.video`）

计划已给：`generateInstruction` = 基于站位图生成游戏资产展示视频，缓慢环绕运镜；
`generateDuration: 8`、`generateAspectRatio: "16:9"`。
输入是 `select.out` → `video.in-image`（单数 `image` 口）。

## 关键约束与顺序

1. **先落地工作流**：`workflow_use_installed({ id: "game3d-asset" })` 返回 `assetId`。
2. **两个模型节点先跑**：导演台实例化的是**上游运行输出**里的模型。
   已核对取候选的三条路径：上游节点的运行输出、输出里嵌套的图库资产、
   以及"节点自身挂着模型资产"的兜底。所以**"生成了但没跑 / 运行态被清空"通常仍能实例化**，
   但最稳的是先 `task_run` 让两个模型节点跑出 GLB。
3. **模型怎么进导演台**：`modelMain.out` → `motion.in-model`
   （计划已连：`fromPort: "out"`，`toPort: "in-model"`）。
   `in-model` 口类型是 `model`，`asset.model3d` 的出口就是 `model`，**直接连，不需要中转**。
4. **道具模型要自己接**：`modelProp` 在计划里是断开的。要把它也放进舞台：
   ```json
   { "op": "edge_connect", "fromNodeId": "<modelProp id>", "fromPort": "out", "toNodeId": "<motion id>", "toPort": "in-model" }
   ```
   `in-model` **支持挂多条线**：舞台按 `assetId` 去重，同一资产只保留"加工最深"的一条
   （动画 > 姿势 > 蒙皮 / 重拓扑 > 原模型），所以主模和道具会各实例化一份，不会重复实例化。
   注意：**动画片段资产和姿势资产按设计不能当网格放到舞台上**，接进去也不会出现。
5. **站位图从哪来**：`motion.out-shots`（类型 `images`，复数）→ `select.in`（类型 `images`，复数）。
   这条必须用复数口：`out-shots` 接单数口会被拒。
   **只有用户在舞台里截过图，`out-shots` 才有内容。**
6. **选哪张**：`image.select` 按 `params.selectedImageId` 挑一张；没设过就取第一张。
   截图最多保留最近 24 张。要指定某张就用节点检查器选，或写 `selectedImageId`。
7. **截图 → 视频**：`select.out`（单数 `image`）→ `video.in-image`。这是**参考图**模式
   （默认 `generateFrameMode` 为 `none`）。要把它当首帧，得设 `generateFrameMode: "first"`
   并接 `in-first-frame`；模型不支持首帧时会回落到 `none`，首帧图不生效。
8. **`task_run` 跑整张图**：会连两个 3D 生成一起重跑（3D 生成是远程长任务，很贵）。
   只想重跑视频时，用界面单节点执行，不要反复 `task_run`。
9. **参数名写错不会报错**：不在白名单里的键会被丢弃并写进 `warnings`。应用后先读 `warnings`。
10. **视频时长只是请求值**：`generateDuration: 8` 会被钳到所配视频模型支持的档位，
    档位不确定先用 `models_list` 查。

## 常见追问怎么答

- **"能自动出展示视频吗？"** 不能全自动。中间"进舞台摆机位 + 截站位图"是**人工步骤**，
  没有对应工具。要么请用户操作，要么改用 `generate_video`（拿模型的一张预览/渲染图当参考图直接出片）。
- **"能让人物做动作 / 绑骨 / 换姿势吗？"** 本工作流的计划里没有这些节点。
  模型加工要用 `model.rigSkin`（蒙皮）/ `model.animation`（动作）/ `model.pose`（姿势）等节点，
  它们吃 `model` 口，可以接在 `modelMain.out` 上，但**需要自己 `graph_edit` 加节点**。
- **"展示视频是真 3D 渲染吗？"** 不是。视频是"站位图 → 图生视频"生成的，
  舞台上摆的几何体只是构图参考；最终画面由视频模型重绘。
- **"能导出 GLB 给引擎用吗？"** 模型就在工程资产里（GLB），可以在资产库导出。
  本工作流不负责引擎格式转换；要转格式用 `model.convert` / `model.retopology` 一族节点。
- **"能多几个道具吗？"** 复制 `asset.model3d` 节点并各写 `generateInstruction`，
  再按第 4 条接进 `in-model`。
- **"为什么舞台是空的？"** 三种原因：上游没跑出模型、模型资产不在库且拿不到文件路径、
  候选是动画 / 姿势资产（不是网格，按设计不能放）。先按顺序排查这三个，不要盲目重试。

## 参数去哪查

节点端口、参数与默认值见 `references/ports.md`。
不确定的端口 id 用 `graph_node_types` 查实（含端口与默认参数），不要靠猜。
