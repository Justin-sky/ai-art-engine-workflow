# 阶段表与参数速查（short-drama）

字段名、端口 id、参数名均取自应用源码与 `workflow.json`；可直接写进 `graph_edit` 的 `ops[].params`。

## 阶段表

节点标题是安装后**写在图上的稳定标识**，`graph_read` 返回的 `title` 就是它，用它定位节点 id。

| # | 阶段 | 节点标题 | typeId | 关键参数 |
|---|---|---|---|---|
| 1 | 剧本 | 剧本 | `play.script` | `text`（用户输入） |
| 2 | 节拍拆解表 | Beat Breakdown Table | `prompt.optimize` | `episodeStep: breakdown`，skillId episode.breakdown |
| 2R | 导演审核 | Director Review · Beat Breakdown Table | `prompt.optimize` | `episodeReviewTarget: breakdown` |
| 3 | 9宫格分镜表 | 9-Grid Storyboard Table | `prompt.optimize` | `episodeStep: beatboard`，skillId episode.beatboard |
| 3R | 导演审核 | Director Review · 9-Grid Storyboard Table | `prompt.optimize` | `episodeReviewTarget: beatboard` |
| 4 | 9宫格拼图 | 9宫格拼图·锚点画布 | `asset.image` | `episodeStep: beatboard`，skillId episode.image.grid9 |
| 5 | 9 格提取 | 宫格提取·格1 … 宫格提取·格9 | `image.gridSplit` | `anchorCellIndex: 1..9` + `imageGridSplit` |
| 6 | 4宫格动态分镜表 | 4-Grid Motion Storyboard Table | `prompt.optimize` | `episodeStep: sequence`，skillId episode.sequence |
| 6R | 导演审核 | Director Review · 4-Grid Motion Storyboard Table | `prompt.optimize` | `episodeReviewTarget: sequence` |
| 7 | 4宫格拼图 ×9 | 4宫格拼图·组1 … 4宫格拼图·组9 | `asset.image` | `episodeStep: sequence`，skillId episode.image.grid4 |
| 8 | 36 格提取 | 宫格提取·组G-格C | `image.gridSplit` | `gridCellIndex: "G-C"` + `imageGridSplit` |
| 9 | 动态提示词表 | Motion Prompt Table | `prompt.optimize` | `episodeStep: motion`，skillId episode.motion |
| 9R | 导演审核 | Director Review · Motion Prompt Table | `prompt.optimize` | `episodeReviewTarget: motion` |
| 10 | 动态格选择 ×36 | 动态格选择·格G-C | `episode.cellSelect` | `cellGroupIndex: G`，`cellIndex: C` |
| 10 | 动态视频 ×36 | 动态视频·格G-C | `asset.video` | `motionCellIndex: "G-C"`，`generateDuration: 4`，skillId episode.video.grid4 |
| — | 说明便签 | 流水线说明 | `note.text` | `text`（只读参考） |

计数：1 剧本 + 8 个 `prompt.optimize` + 10 个 `asset.image` + 45 个 `image.gridSplit` + 36 个 `episode.cellSelect` + 36 个 `asset.video` + 1 便签 = 137 节点。

## 连线（哪些口是干什么的）

| 边 | 端口 | 含义 |
|---|---|---|
| 剧本 → 节拍拆解 / 各审核 | `out` → `in` | 文本 |
| 节拍拆解 → 9宫格 | `out` → `in` | 9宫格阶段据此注入 9 个锚点 |
| 9宫格分镜表 → 9宫格拼图 | `out` → `in-text` | 只给文本（`in-image` 空着，可接角色参考图） |
| 9宫格拼图 → 9 格提取 | `out` → `in` | 一张 3×3 拼图，本地裁切成 9 格 |
| 9宫格分镜表 + 节拍拆解 → 4宫格动态分镜 | `out` → `in` | 两条边都进同一个 `in`（multiple） |
| 4宫格动态分镜 → 4宫格拼图组G | `out` → `in-text` | 文本 |
| 宫格提取·格G → 4宫格拼图组G | `out` → `in-image` | **第 G 格锚点图作参考**，保证组与锚点一致 |
| 4宫格拼图组G → 36 格提取 | `out` → `in` | 本地裁切成 4 格 |
| 4宫格动态分镜 → 动态提示词 → 动态格选择 | `out` → `in` | 每格从提示词表里取自己那一条 |
| 宫格提取·组G-格C → 动态视频·格G-C | `out` → `in-image` | 视频的参考图 |
| 动态格选择·格G-C → 动态视频·格G-C | `out` → `in-text` | 视频的动态提示词 |

## 产物落盘路径

审核状态文件：`Cache/agent-state-<宿主资产 id>.json`（作用域键 = `episodeScopeKey`，装上后由应用改写为资产 id）。

状态文件里 `output_files` 登记的四个阶段产物：

```
outputs/beat-breakdown-<scope>.md          # 节拍拆解表
outputs/beat-board-prompt-<scope>.md       # 9宫格分镜表
outputs/sequence-board-prompt-<scope>.md   # 4宫格动态分镜表
outputs/motion-prompt-<scope>.md           # 动态提示词表
```

状态字段：`project_name` / `current_step`（breakdown | beatboard | sequence | motion | completed）/ `last_failed_reason` / `output_files` / `reviews[]`（每条含 step、result、reason、at）。

## 审核协议

审核节点必须输出「## 审核清单」逐项打分，然后**单独一行**给结论：

```
## 结论: PASS
## 结论: FAIL (原因: <可执行原因1>；<原因2>)
```

- PASS 条件（写死在审核提示词里）：五个维度没有 1~2 分的项、平均分 ≥ 4.0、本阶段硬性必须项全过。禁止默认 PASS。
- PASS → `current_step` 推进到下一阶段、`last_failed_reason` 清空。
- FAIL → `current_step` 回滚到该阶段、原因写入 `last_failed_reason`。
- 重跑阶段节点时，只有当该阶段**最近一次**结论仍是 FAIL 时，原因才被追加进提示词（避免已通过的历史 FAIL 造成"越改越差"循环）。
- 结论也会回标到审核节点与对应阶段节点（`episodeReviewStatus` / `episodeReviewReason` / `episodeReviewPending`），并清除下游审核回标。

## 提示词里写了什么硬约束（改这些字段时不要删掉结构性要求）

- 节拍拆解表：单集 **12~28 条**节拍（短剧一般 20~25），从中选 **9 个关键锚点**（可按篇幅 ±2，最多 11），每个节拍至多标 1 个「是」。标多了不影响正确性：选锚点时**标记「是」的按情绪强度降序优先**，不足再用其余节拍按强度补齐，最后按节拍序号排序 —— 也就是说应用会替模型兜底，但兜底的依据仍是这张表。
- 9宫格分镜表：每格必须写「景别与视角 / 人物动作与表情 / 场景与光影 / 构图与动线 / 故事功能」；服装、道具、武器、场景、发型**只写名称**，外观细节留给参考图。
- 4宫格动态分镜表：9 组全展开 = 36 格，顺序严格 定场→引入→冲突→收尾，组内景别 全景/远景 → 中景 → 近景/特写 → 全景/中景；组N 覆盖「锚点N-1 之后到锚点N（含）」，末组必须覆盖到剧本结束。
- 动态提示词表：36 条，每条含 Camera Move / Subject Action / Env Action / 台词对白 / Duration（3~5 秒）；台词逐字保留。

## 视频节点的实际参数行为

- `generateDuration`（秒）：请求值；模型声明了 `supported_durations` 时会被 clamp 到支持的档位（优先 5 / 4 / 6 / 8 / 10）。
- `in-image` = **参考图**（作为 image reference 与提示词一起送模型），不是首帧锁定。
- 首帧锁定需要：模型声明支持 `first_frame`、节点 `generateFrameMode` 设为 `first`（或 `first_last`）、并把图改接首帧口；该模式下 `in-image` 参考图会被弃用。需自行确认模型能力。
- `generateModel` / `generateProviderInstanceId` 是文本、图片、视频节点通用的模型覆盖参数。
- 媒体落盘目录可用 `mediaOutputDir` 覆盖；默认按工程配置的视频/图片缓存目录。

## 兼容性

- 应用最低版本 `7.1.0`（`requires.appMinVersion`）。
- `episodeStep` 与 `episodeReviewTarget` 互斥：生成节点用前者，审核节点用后者，同一个节点不要都写。
