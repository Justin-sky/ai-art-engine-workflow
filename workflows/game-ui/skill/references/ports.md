# 端口、参数与内图契约（game-ui）

字段名与端口 id 取自应用源码，可直接写进 `graph_edit` 的 `params`。**参数名拼错会被当作"未声明参数"丢弃**并在物化 warnings 里列出 —— 先看 warnings。

## asset.gameSystem（策划案生成）

| 端口 | 方向 | 类型 | 说明 |
|---|---|---|---|
| `in` | in | `text`（multiple） | 上游正文（`processingIn: 'text'`） |
| `out` | out | `text` | 策划案正文 |

参数（`defaultParams()` 声明）：

| 参数 | 默认 | 说明 |
|---|---|---|
| `text` | `'…'`（预设为占位提示） | **可写正文**。指令为空且 `text` 非空时，把它当底稿扩写（会把 `text` 作为"已有人类可读底稿"并入提示词） |
| `generateInstruction` | `DEFAULT_GAME_SYSTEM_USER_PROMPT_ZH` | 用户指令；非空时**优先于 `text` 底稿**（`text` 不再并入） |
| `generateSystemPrompt` | `DEFAULT_GAME_SYSTEM_SYSTEM_PROMPT_ZH` | 系统提示词 |
| `generateModel` / `generateProviderInstanceId` | `''` | 指定文本模型 |

行为要点：产物写入节点 `text` 与文本图库（`generatedTexts`）。**注意**：它自己再跑一次生成会**重写 `text`**，所以 agent 手工写进去的正文不要指望它在重跑后还在。

## ui.split（UI界面拆分）

| 端口 | 方向 | 类型 | 说明 |
|---|---|---|---|
| `in` | in | `text`（multiple） | 上游策划案正文 |
| `out` | out | `texts`（multiple） | 每屏一项（含 `title` / `text`(=prompt) / `cleanPrompt`） |

参数：

| 参数 | 默认 | 说明 |
|---|---|---|
| `generateInstruction` | `DEFAULT_UI_SPLIT_USER_PROMPT_ZH` | 拆分用户指令（支持 `@n` 引用与 `@` 提及源） |
| `generateSystemPrompt` | `DEFAULT_UI_SPLIT_SYSTEM_PROMPT_ZH` | 拆分系统提示词（规定输出 JSON 数组、四字段、双轨、禁风格词） |
| `generateModel` / `generateProviderInstanceId` | `''` | 文本模型 |
| `text` | `''` | 拆分结果的**摘要**（第 N 屏标题列表），由执行写回 |
| `generatedTexts` | `[]` | 图库条目：`{ id, title, text, cleanPrompt?, createdAt }`，**每次拆分整体替换** |
| `selectedTextId` | `''` | 当前选中项 |
| `uiScreens` | `[]` | 规范化的界面列表 `{ id, title, prompt, cleanPrompt? }` |
| `uiSplitAssetId` | `''` | 内图资产 id；提示词变化或内图结构版本变化时**置空**，下次进内图重建 |

行为要点：没有文本模型时退化为"从指令 / 上游正文里解析界面"；解析失败（没有可解析的界面列表）会报错而非静默为空。解析器接受 JSON 数组（也容忍对象包裹与 markdown 列表兜底）。

## ui.gen（UI界面生成）

| 端口 | 方向 | 类型 | 说明 |
|---|---|---|---|
| `in` | in | `texts`（multiple） | 上游每屏提示词；端口为空时**回退**节点已存的 `uiScreens` |
| `out` | out | `images`（multiple） | cook 时汇集内图全部输出边界的图片组 |

参数：

| 参数 | 默认 | 说明 |
|---|---|---|
| `text` | `''` | 界面清单摘要，执行时写回 |
| `uiScreens` | `[]` | 实际传入内图的界面列表（执行时写回） |
| `uiSplitAssetId` | `''` | 内图资产 id |
| `uiSplitGraphVersion` | `UI_SPLIT_INNER_GRAPH_VERSION`（当前 `6`） | 内图结构版本 |

行为要点：**它自己不生图**。`out` 来自内图各屏输出边界的软解析；内图没跑过就是空 `images`（不报错）。

## 内图契约（双击 ui.gen 后看到的那张图）

- 内图由 `buildUiSplitInnerGraph(screens, locale)` 生成，宿主接口由 `buildUiSplitHostInterface(screens)` 生成。
- **每屏两个输出边界**：`out-<slot>`（带字精修图，`slot` 从 1 开始）与 `out-<slot>-clean`（空字底图）；每屏一个输入边界 `in-<slot>`（类型 `text`，`multiple: false`）。
- **每屏两个图像生成节点**：`图片·<title>` 与 `底图·<title>`，参数为
  `generateAspectRatio: '9:16'`、`styleImagesUseGlobal: true`、`styleReferenceSubject: 'ui'`、
  `generateSystemPrompt: resolveUiImageSystemPrompt(...)`。
- 连线：`in-<slot>` →（`out` → `in-text`）`图片·<title>` →（`out` → `in`）`out-<slot>`；
  同时 `图片·<title>` →（`out` → `in-image`）`底图·<title>` →（`out` → `in`）`out-<slot>-clean`。
  即**空字底图默认以本屏带字图为参考图**去字，保证两轨布局一致。
- 槽位上限 `UI_SPLIT_SLOT_CAP = 12`：`in`/`out` 口与两条轨都只按前 12 屏建。
- 内图结构版本变化时，已存在的内图资产会在下次 dive 时按新结构重建。

## 工作流里可用的通用参数

任何节点上都合法（应用 `ALLOWED_PARAM_KEYS`）：

`text`、`generateInstruction`、`generateSystemPrompt`、`skillId`、`generateModel`、
`generateProviderInstanceId`、`generateAspectRatio`、`generateResolution`、`generateQuality`、
`generateDuration`、`generateCount`、`generateStyle`、`generateSeed`、`generateSeedUseGlobal`、
`generateFrameMode`、`generateAudio`、`notes`、`label`、`mediaOutputDir`、
`styleImages`、`styleImagesUseGlobal`、`styleReferenceSubject`、`characterRefs`

约束：`styleReferenceSubject` 只能是 `default` / `ui`；`styleImages` 条目须带 `libraryId` 或 `data:` 开头的 `dataUrl`；
`styleImagesUseGlobal=false` 时必须同时给本地 `styleImages`，否则回落全局；`characterRefs` 每条须带 `imageUrl`。

## 常见错误

| 现象 | 原因 |
|---|---|
| cook 之后没有界面图（也不报错） | 跳过了"进内图逐屏出图"，内图输出边界里没有产物 |
| 拆分报"可解析的界面列表"缺失 | 文本模型没按 JSON 数组输出，且 markdown 兜底也解析不出内容 |
| 改完提示词后界面图对不上 / 内图像旧的 | `uiScreens` 变化会作废内图资产，需重新进内图重建 + 重跑 |
| 只有前 12 屏出图 | `UI_SPLIT_SLOT_CAP = 12`，多出的屏被截断 |
| 界面画风与预期不符 / 像"文字描述的风格" | 拆分提示词会剔除风格词；画风只由全局 UI 风格参考图决定 |
| 手工写进 `asset.gameSystem` 的 `text` 不见了 | 该节点重跑生成会重写 `text`；先把指令写进 `generateInstruction` 或把它当底稿 |
