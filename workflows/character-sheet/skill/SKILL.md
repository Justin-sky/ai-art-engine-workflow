---
name: wf-character-sheet
description: 用「角色设定」工作流把一段人设文案变成三张立绘（正面 / 侧面 / 半身表情变体）。当用户要角色三视图、立绘、人设图、表情差分，或先定角色形象再往下做分镜 / 视频时加载本技能。
workflow: character-sheet
workflow-version: 1.0.0
---

# 角色设定（character-sheet）

## 这条工作流产出什么

`人设文案 → 正面立绘 + 侧面立绘 + 表情变体`

产物是 **3 张图片资产**，同一段人设文案 + 三条不同的 `generateInstruction` 各自出一张图。
它不是角色资产包，也不是三视图交付件 —— 排版、拼版、加水印都不在这条链路里。

## 什么时候用 / 什么时候别用

用：

- 用户给了（或愿意写）一段角色描述，要"一张立绘"、"三视图"、"人设图"、"表情差分"。
- 后续要接分镜 / 视频，需要先把角色形象定下来。

别用，改走这些：

- 要**多角度镜头**（俯拍、荷兰角、鱼眼、环绕机位）→ 用节点 `image.multiAngle`（「多角度编辑器」），
  或工作流 `director-previz`（3D导演台预演）。本工作流的「侧面」只是换一句提示词的另一次生成。
- 要**表情网格 / 情绪 9 宫格**→ 节点 `image.emotion`（「情绪调节」）。
- 要**人像精修**（肤质 / 证件照 / 换背景）→ 节点 `image.portrait`（「人像精修」）。
- 要**角色参与剧情**（分镜、节拍、成片）→ 用 `short-drama`、`short-drama9`、`storyboard-video`、
  `game-ua-video`：它们自己也接一段剧本，不要在这条工作流上叠剧情。
- 要**3D 角色资产**（GLB、骨架、进导演台）→ 用 `game3d-asset`（本工作流只出位图）。

## 上游输入怎么给

用户要提供 **一段人设文案**，写进 `play.script` 节点（默认标题「人设描述」）的 `text` 参数：

```json
{ "op": "node_update", "nodeId": "<bio 节点 id>", "params": { "text": "姓名 / 年龄 / 性格 / 外观 / 发型发色 / 服饰 / 禁忌色 / 画风约束" } }
```

这段文案经 `bio` 的 `out`（类型 `text`）扇出到三张图各自的 `in-text`。执行期行为（已核对）：

- 三条 `generateInstruction` 里都**没有** `@n` 引用，所以上游剧本正文会被**自动整段拼进提示词**
  （`asset.image` 的执行器把 `incomingText` 追加在指令之后）。所以文案写在剧本里就会生效，不用改 `generateInstruction`。
- 三张图共用同一段文案，彼此的差异**只来自 `generateInstruction`**：正面 / 侧面 / 半身三到四格。
  想调画面就改对应那张的 `generateInstruction`，不要改剧本（改剧本三张一起变）。

三张图默认的 `generateInstruction`（物化后就是这些，可直接覆盖）：

| 节点 key | 默认标题 | `generateInstruction` 默认值 |
|---|---|---|
| `front` | 正面立绘 | 角色正面全身立绘，干净背景 |
| `side` | 侧面立绘 | 同一角色侧面全身立绘，画风与正面一致 |
| `expr` | 表情变体 | 同一角色半身表情变体，三到四格 |

还有一张 `note.text`（「设定备注」），**没有端口、不参与生成**，只给人写禁忌色 / 道具 / 参考链接。
不要把用户输入往 `note.text` 里塞。

## 关键约束与顺序

1. **先落地工作流再改参数**：`workflow_use_installed({ id: "character-sheet" })` 返回 `assetId`；
   之后所有 `graph_edit` / `task_run` 都用这个 `assetId`。
2. **顺序是 `bio` → 三张图**，没有别的依赖。三张图之间**没有边**，可以只跑其中一张。
3. **`task_run` 跑整张图**：会把三张图**全部重新生成一遍**（含已经满意的那些）。
   只想重跑一张时，在界面里用单节点执行，不要反复 `task_run`。
4. **一致性不是自动的**：三张图是三次独立生成，图与图之间没有参考图连线。
   只靠文字无法保证同一张脸 —— 要可靠一致，必须把参考图真正接进去，任选其一：
   - 把已有的正面图接到侧面 / 表情节点的 `in-image`（`edge_connect`，`toPort: "in-image"`）；
   - 在图片节点的 `characterRefs` 里绑定角色引用。
     **`characterRefs` 的每一项必须带 `imageUrl`**，只写角色名解析不出参考图，会被直接丢弃并记 warning。
5. **参数写给哪**：`generateInstruction` / `generateAspectRatio` / `generateResolution` / `generateQuality` /
   `generateCount` / `generateSeed` / `generateSeedUseGlobal` / `generateModel` /
   `generateProviderInstanceId` / `generateSystemPrompt` / `styleImages` / `styleImagesUseGlobal` /
   `styleReferenceSubject` / `characterRefs` 都写在**每个图片节点自己**的 params 上。
   `workflow_use_installed` 只有 `generateAspectRatio` / `imageModel` / `videoModel` 三个统一覆盖项。
6. **参数名写错不会报错**：不在白名单里的键会被物化 / `graph_edit` 丢弃并写进 `warnings`。
   应用后先读 `warnings`，别把"跑完但产物不对"当成成功。

## 常见追问怎么答

- **"能出三视图 / 一张图里四个角度吗？"** 本链路只出三张**独立**图，不拼版。
  要单图多角度用 `image.multiAngle`；要拼成一张版面用 `image.compose` 或 `comic.page`。
- **"表情变体是固定 4 格吗？"** 不是。默认指令写的是"三到四格"，由模型决定。
  要严格网格并用编号指定表情，用 `image.emotion`。
- **"能做角色三视图的建模参考吗？"** 出的就是位图。要 3D 资产走 `game3d-asset`。
- **"为什么三张脸不一样？"** 见上面的第 4 条 —— 默认没有参考图连线，这是本工作流的已知短板，不要承诺一致性。
- **"能给它加旁白 / 配音吗？"** 不能，本链路没有声音节点。要口播走 `course-narrate`。
- **"改文案后要不要重跑全部？"** 改 `bio.text` 影响三张图，需要三张都重跑；
  只改某张的 `generateInstruction` 就只重跑那一张。

## 参数去哪查

本工作流只有 6 个节点、没有私有参数，故不另写 `references/`。上面表格与列表覆盖了全部可写参数。
端口不确定时用 `graph_node_types` 查实（含端口与默认参数），不要靠猜。
