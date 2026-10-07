# 阶段表与参数速查（short-drama9）

字段名、端口 id、参数名均取自应用源码与 `workflow.json`；可直接写进 `graph_edit` 的 `ops[].params`。

## 阶段表

节点标题是安装后写在图上的稳定标识，`graph_read` 返回的 `title` 就是它。

| # | 阶段 | 节点标题 | typeId | 关键参数 |
|---|---|---|---|---|
| 1 | 剧本 | 剧本 | `play.script` | `text`（用户输入） |
| 2 | 节拍拆解表 | Beat Breakdown Table | `prompt.optimize` | `episodeStep: breakdown`，skillId episode.breakdown |
| 2R | 导演审核 | Director Review · Beat Breakdown Table | `prompt.optimize` | `episodeReviewTarget: breakdown` |
| 3 | 9宫格分镜表 | 9-Grid Storyboard Table | `prompt.optimize` | `episodeStep: beatboard`，skillId episode.beatboard |
| 3R | 导演审核 | Director Review · 9-Grid Storyboard Table | `prompt.optimize` | `episodeReviewTarget: beatboard` |
| 4 | 9宫格拼图 | 9宫格拼图·锚点画布 | `asset.image` | `episodeStep: beatboard`，skillId episode.image.grid9 |
| 5 | 9 格提取 ×9 | 宫格提取·格1 … 宫格提取·格9 | `image.gridSplit` | `anchorCellIndex: 1..9` + `imageGridSplit` |
| 6 | 9宫格动态提示词表 | Motion Prompt Table | `prompt.optimize` | `episodeStep: motion`，skillId episode.motion9 |
| 6R | 导演审核 | Director Review · Motion Prompt Table | `prompt.optimize` | `episodeReviewTarget: motion`，`episodeReviewVariant: "9"` |
| 7 | 动态格选择 ×9 | 动态格选择·格1-1 … 格9-1 | `episode.cellSelect` | `cellGroupIndex: 1..9`，`cellIndex: 1` |
| 7 | 动态视频 ×9 | 动态视频·格1-1 … 格9-1 | `asset.video` | `motionCellIndex: "G-1"`，`generateDuration: 15`，skillId episode.video.grid9 |
| — | 说明便签 | 流水线说明 | `note.text` | `text`（只读参考） |

计数：1 剧本 + 6 个 `prompt.optimize` + 1 个 `asset.image` + 9 个 `image.gridSplit` + 9 个 `episode.cellSelect` + 9 个 `asset.video` + 1 便签 = 36 节点。

## 连线

| 边 | 端口 | 含义 |
|---|---|---|
| 剧本 → 节拍拆解 | `out` → `in` | 文本 |
| 剧本 / 节拍拆解 → review1 | `out` → `in` | 审核同时看剧本与产物 |
| 节拍拆解 → 9宫格表 | `out` → `in` | 9宫格阶段据此注入 9 个锚点 |
| 剧本 / 节拍拆解 / 9宫格表 → review2 | `out` → `in` | |
| 9宫格表 → 9宫格拼图 | `out` → `in-text` | 只给文本（`in-image` 空着，可接角色参考图） |
| 9宫格拼图 → 9 格提取 | `out` → `in` | 一张 3×3 拼图，本地裁切成 9 格 |
| 剧本 + 节拍拆解 + 9宫格表 → 动态提示词 | 三条边都进同一个 `in`（multiple） | 这是"一格吃掉一段完整剧情"的输入来源 |
| 剧本 / 节拍拆解 / 9宫格表 / 动态提示词表 → review4 | `out` → `in` | |
| 动态提示词表 → 动态格选择·格G-1 | `out` → `in` | 取第 G 条提示词 |
| 宫格提取·格G → 动态视频·格G-1 | `out` → `in-image` | 视频参考图（锚点图） |
| 动态格选择·格G-1 → 动态视频·格G-1 | `out` → `in-text` | 视频的动态提示词 |

**没有 4宫格相关节点**：这条链不展开 4 格，也没有 review3。

## 三张表的解析契约

解析器是正则，解析失败**不报错**、只静默退化（锚点/区间注入失效、动态格选择取不到自己的那条）。

### 节拍拆解表（Markdown 表格）

```
| 节拍编号 | 事件摘要 | 观众获得 (信息/情绪) | 情绪强度 (1-10) | 关键锚点 (是/否) |
|---------|---------|-------------------|----------------|----------------|
| #1 | … | … | 3 | 否 |
```

- 编号可写 `1` 或 `#1`；**末列必须恰好是「是」或「否」**（英文 YES/NO 也认）。
- 列数、列序、末列写法错 → 整表解析不出 → 9 个锚点注入与节拍区间注入全部失效。
- 锚点挑选规则：先取标记「是」的行，**按情绪强度降序**；不足 9 个再用其余节拍按强度补齐；最后按节拍序号排序。标多了不会错，但兜底依据仍是这张表。

### 9宫格分镜表

```
## 格1 [节拍ID: #1] - 标题
- **景别与视角**: …
```

- 标题必须是二级标题 `## 格N`（N = 锚点序号 1~9，不是原始节拍编号）。
- `节拍ID` 供 UI 显示关联节拍；`Beat ID` 写法也认。

### 9宫格动态提示词表

```
## 镜头1 [来源: 9宫格 格1]

- **时长**: 12
- **一句话概述**: …
- **时间轴剧情**: …
```

- **`[来源: 9宫格 格N]` 是硬契约**：解析器把它读成 (组 = N, 格 = 1)，正好对上第 N 个动态格选择节点的 `cellGroupIndex: N, cellIndex: 1`。
- 标记丢失或写成别的形式 → 组号按"上一条 +0 / 格号 +1"兜底 → 第 2~9 格取不到自己的提示词 → 退化成整张表透传。
- 每条正文应含：时长（3~15 整数秒）、一句话概述、时间轴剧情（0 秒起连续覆盖到本时长，不重叠不留空）、镜头运动、环境/灯光、音频、全局锁定；对白逐字写进对应秒段，无对白写「无对白」。
- 第 1 条 = 剧本开头→关键帧1；第 N 条 = 上一关键帧之后→本关键帧；**第 9 条 = 上一关键帧之后→拆解表最后一条**（末端关键帧之后的剩余节拍也要吃进来）。

## 宫格索引

| 位置 | 参数 | 取值 |
|---|---|---|
| 9宫格提取节点（格 N） | `anchorCellIndex` | `1`~`9` |
| 裁切框 | `imageGridSplit` | `{rows:3, cols:3, selected:["行-列"]}` |
| 动态格选择（第 G 条） | `cellGroupIndex` + `cellIndex` | `G` + `1` |
| 动态视频（第 G 条） | `motionCellIndex` | `"G-1"` |

格 N → 裁切框（行优先）：1→1-1、2→1-2、3→1-3、4→2-1、5→2-2、6→2-3、7→3-1、8→3-2、9→3-3。

参数示例（格 5）：

```json
{ "anchorCellIndex": 5, "imageGridSplit": { "rows": 3, "cols": 3, "selected": ["2-2"] } }
```

`imageGridSplit.selected` 传空数组表示"裁出全部格"——这 9 个节点每个只该裁一格，不要传空。

## 动态格选择（episode.cellSelect）

- 端口：`in`（text）→ `out`（text）；参数 `cellGroupIndex` / `cellIndex`。
- 行为：优先从上游**动态提示词表**按 (组, 格) 取那一条，取到输出 `# 格G-C` + 正文；取不到再按 4宫格动态分镜表取（本图没有）；仍取不到就**把上游整段正文透传**（即"整张表当提示词"）。

## 动态视频（asset.video）

- 端口：`in-image`（来自「宫格提取·格G」的锚点图）、`in-text`（来自动态格选择）。
- `generateDuration`：预设 15（秒），会被所选视频模型的时长档 clamp（优先 5 / 4 / 6 / 8 / 10）。
- `in-image` = **参考图**（image reference，与提示词一起送模型），不是首帧锁定。首帧锁定需要模型支持 first_frame、`generateFrameMode` 设为 `first`（或 `first_last`）、并改接首帧口；该模式下参考图会被弃用。需自行确认模型能力。
- 命名：产物名由「宿主资产名 + 节点标题（动态视频·格G-1）+ 时间戳」组成。

## 产物落盘路径

审核状态文件：`Cache/agent-state-<宿主资产 id>.json`（作用域键 `episodeScopeKey` 装上后由应用改写为资产 id，不是预设里的 `ep01`）。

状态文件里 `output_files` 登记：

```
outputs/beat-breakdown-<scope>.md          # 节拍拆解表
outputs/beat-board-prompt-<scope>.md       # 9宫格分镜表
outputs/sequence-board-prompt-<scope>.md   # 本工作流不生成（4宫格阶段不存在）
outputs/motion-prompt-<scope>.md           # 9宫格动态提示词表
```

## 审核协议

```
## 审核清单
（逐项 1~5 分 + 一句话）

## 结论: PASS
## 结论: FAIL (原因: <可执行原因1>；<原因2>)
```

- PASS 条件：五个维度没有 1~2 分的项、平均分 ≥ 4.0、本阶段硬性必须项全过；禁止默认 PASS。
- PASS → `current_step` 推进、清空 `last_failed_reason`；FAIL → 回滚到该阶段并记录原因。
- 重跑阶段节点时，只有该阶段**最近一次**结论仍是 FAIL 时，原因才被追加进提示词。
- 结论回标到审核节点与对应阶段节点（`episodeReviewStatus` / `episodeReviewReason` / `episodeReviewPending`）。
- review4 在动态提示词的检查项里明确包含：9 条、时长 3~15 秒且时间轴从 0 连续覆盖、**最后一格必须覆盖末端关键帧之后直至剧本结束**、台词逐字保留。

## 本地 / 远程边界

- `image.gridSplit`：纯本地裁切（按整除边界切，不留缝），不调模型。
- `episode.cellSelect`：纯文本选取，不调模型。
- `asset.image` / `asset.video` / `prompt.optimize`：会调模型。

## 兼容性

- 应用最低版本 `7.1.0`。
- `episodeStep` 与 `episodeReviewTarget` 互斥：生成节点用前者，审核节点用后者。
