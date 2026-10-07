# 端口、参数与错误速查（game-icons）

字段名与端口 id 取自应用源码，可直接写进 `graph_edit` 的 `params` / `fromPort` / `toPort`。

## 节点与端口

| 节点标题 | typeId | 入端口 | 出端口 |
|---|---|---|---|
| 画风主题 | `play.script` | 无 | `out`（`text`） |
| 技能/道具/状态图标名单 | `play.script` | 无 | `out`（`text`） |
| ·整版 | `asset.image` | `in-text`(text，可多) / `in-image`(image，可多) | `out`（当前选中）/ `out-all`（历史） |
| ·切格 | `image.gridSplit` | `in`(image，**单个**) | `out` / `out-all` |
| ·打包 | `image.iconPack` | `in`(image，**单个**) / `in-text`(text，**单个**) | `out` / `out-all` |
| 使用说明 | `note.text` | 无端口 | 无端口 |

三条轨道各 5 个节点（2 个 `play.script` + ·整版 + ·切格 + ·打包），再加 1 个共用的 `note.text`；
每条轨道 5 条边（主题→整版、名单→整版、整版→切格、名单→打包、整版→打包），共 15 条。
`play.script:out` 可扇出；`image.iconPack` 的 `in` 与 `in-text` **不能接反**
（孔位类型是 `image` 与 `text`，接反会被端口兼容性校验拒掉）。

## `image.gridSplit`（·切格，纯本地裁切，不调模型）

| 参数 | 取值 | 说明 |
|---|---|---|
| `imageGridSplit.rows` | 1–5，默认 3 | 与 `iconPack.rows` 必须一致 |
| `imageGridSplit.cols` | 1–5，默认 3 | 与 `iconPack.cols` 必须一致 |
| `imageGridSplit.selected` | 字符串数组，如 `["1-1","2-3"]` | **空数组 = 运行时处理全部格**；元素是 `行-列`（1-based），越界项被丢弃 |

行为：按 `rows × cols` 对源图做整除边界裁切（相邻格无重叠、无缝隙），输出每格一张 PNG。
**不做透明化、不做统一画布** —— 那是打包节点的事。`selected` 只影响切哪几格。

## `image.iconPack`（·打包，纯本地像素处理）

参数对象是 `iconPack`（默认值即 plan 里的值）：

| 参数 | 取值 | 默认 | 说明 |
|---|---|---|---|
| `iconPack.rows` | 1–5 | 3 | 与整版表实际行列、与切格节点一致 |
| `iconPack.cols` | 1–5 | 3 | 同上 |
| `iconPack.edgeInset` | `'auto'` 或 0–64 | `'auto'` | 裁切后向内收缩像素，削格线 / 黑边；`auto` = 约格子短边的 1.5%，封顶 12px |
| `iconPack.keyColor` | `'auto'` / `'black'` / `'white'` / `'none'` | `'auto'` | 键控模式；非法值回落 `auto` |
| `iconPack.distance` | 0–255 | 40 | 采样色键控距离阈值；`0` 会回落成默认 40 |
| `iconPack.feather` | 0–255 | 34 | 键控软过渡羽化 |
| `iconPack.canvasSize` | 0–2048 | 0 | 统一方形画布边长；`0` = 按本批主体最大外接框自动定边（`max(4, ceil(max*1.04/2)*2)`） |
| `mediaOutputDir` | 工程相对目录 | 各类预设 | 透明 PNG 与清单的落盘目录 |

另有一个**执行器回填**参数，不要手写：

| 参数 | 说明 |
|---|---|
| `iconPackCellRefines` | `{ "<cellKey>": { cellKey, dataUrl, updatedAt? } }`，逐枚精修回炉的覆盖图；仅接受 `data:image/` 开头的 dataUrl 与合法 `cellKey`。`graph_icon_refine` 会写这个键 |

执行流程（`keyColor: 'auto'` 时）：

1. 采样背景色：名单未占满时取**第一个空白格**中心 60% 区域的平均色；
   名单占满 `rows × cols` 时退回采样**整版图外框色带**（上 → 下 → 左 → 右，宽约短边的 1.5%，最少 2px）。
2. 逐格裁切（按名单顺序 row-major）→ 色距键控 → `extractAlphaBounds` 修剪主体 →
   居中贴到统一方形画布。
3. 按名单命名落盘，并把清单写到同目录。

**硬性校验（会直接抛错，不会「尽力而为」）**：

| 错误 | 触发条件 |
|---|---|
| `ICON_PACK_TOO_MANY_NAMES` | 名单行数 > `rows × cols`（3×3 时即 > 9） |
| `ICON_PACK_EMPTY_NAMES` | 名单全空 / 全是 `#` `//` 注释行 |
| `GRAPH_PROCESS_NO_INPUT` | `in` 没接到整版图，或整版尚未产出 |
| `ICON_PACK_SOURCE_LOAD_FAILED` | 整版图读不出画面 |
| `ICON_PACK_CANVAS_UNAVAILABLE` | 渲染层 canvas 不可用（环境问题，非参数问题） |

## 名单解析规则

名单来自 `play.script` 的 `params.text`（或任何接入 `in-text` 的文本）：

- 按 `\r?\n` 拆行 → 去首尾空白 → 丢弃空行 → 丢弃以 `#` 或 `//` 开头的行；
- **行序 = 格位顺序**：`cellKey` 的 `行-列` 由 `index` 反推，
  `行 = floor(index / cols) + 1`，`列 = (index % cols) + 1`（`index` 从 0 起）；
- 名单名即 PNG 文件 stem：`\ / : * ? " < > |` 与控制字符替换为 `_`，空白折叠为 `_`，
  首尾 `_` 去掉；结果为空时回落 `icon`。

## 清单（manifest）

| 字段 | 说明 |
|---|---|
| `version` | 固定 `1` |
| `kind` | `'icon-pack'` |
| `packId` | `<节点id>:<时间戳>` |
| `createdAt` | ISO 时间 |
| `canvasSize` | 统一画布边长 |
| `background` | 采样到的键控底色 `{r,g,b}`；`keyColor: 'none'` 时为 `null` |
| `grid` | `{ rows, cols }` |
| `icons[]` | `name` / `fileName` / `cellKey` / `width` / `height` / `anchorX` / `anchorY`（锚点取画布中心） |

落盘文件名由节点的 `key`（这里是 `icons`）决定，扩展名固定 `.txt`；
同名已存在时自动变成 `icons 2.txt`（PNG 同理：`火焰斩 2.png`）；
**内容是 JSON**。

## `graph_icon_refine`（逐枚精修回炉）

| 入参 | 必填 | 说明 |
|---|---|---|
| `assetId` | ✔ | 宿主资产 id |
| `splitNodeId` | ✔ | 该类的 `image.gridSplit` 节点 id（`graph_read` 查） |
| `cellKey` | ✔ | `行-列`，如 `1-1` / `2-3`；越界会被拒 |
| `hint` | | 针对不满意点的修正说明 |
| `prompt` | | 完整生图指令，给出时覆盖默认指令与 `hint` |
| `repack` | | 完成后是否重跑同源打包节点，默认 `true` |
| `locale` | | `zh`（默认）/ `en` |

同源打包节点是**从该整版节点 `out` 出发能找到的那个 `image.iconPack`**，
且它的 `in-text` 名单非空才会被认领；找不到时该枚的 `name` 为 `null`。
名单顺序与格位对齐用的是 `cellKey` → `(row1-1)*packCols + (col1-1)`，
**所以打包的 `cols` 必须等于切格的 `cols`**，否则名字会错位。

## `asset.image`（·整版）参考图参数

| 参数 | 说明 |
|---|---|
| `styleImages` | 风格参考图数组；条目须带 `libraryId`（风格库 id）或 `data:` 开头的 `dataUrl` |
| `styleImagesUseGlobal` | `false` = 只用节点本地风格图；此时必须同时给 `styleImages` |
| `styleReferenceSubject` | 只能是 `default` / `ui`；非法值被丢弃并记 warning |
| `characterRefs` | 条目须带 `imageUrl`（工程相对路径或 data URL），只写角色名会被丢弃 |
| `generateInstruction` / `generateAspectRatio` / `generateResolution` / `generateQuality` / `generateModel` / `generateProviderInstanceId` | 通用生成参数；plan 已把整版设为 `1:1` |

> plan 里三条整版的 `generateInstruction` 末尾都带同一段「图标统一规范」：
> 等线宽描边、同一圆角与内边距比例、主体简洁高对比（缩小到 16px 仍可辨）、
> 每格一枚完整图标、不画任何文字 / 网格线 / 外框；名单不足 9 枚时其余格为纯色空白底。
> **改这段规范等于同时改画风与抠底效果**：把「纯色空白底」删了，`keyColor: 'auto'`
> 就可能采到杂色背景。要改风格请改「画风主题」或换风格参考图，别删这句。

## 常见错误

| 现象 | 原因 |
|---|---|
| 打包报 `名单数 > rows×cols` | 名单超过 9 行（3×3）；截断或加大 `rows`/`cols`（两处都要改） |
| PNG 名字与画面对不上 | 改名单后没重跑「·整版」，或打包 `cols` 与切格 `cols` 不一致 |
| 图标边缘残留底色 | `distance` 太小；或整版没留纯色空白格、`auto` 采到了杂色 |
| 图标的浅色 / 发光部分被抠没 | 色距键控把接近底色的颜色一起透明化了；改用 `keyColor: 'black'` / `none` |
| 每枚 PNG 尺寸不一 | `canvasSize` 没设（`0` = 按主体自动定边），或主体外接框差异过大 |
| 只切了几格 | `imageGridSplit.selected` 非空 —— 空数组才是全部 |
| 名单接上了但不生效 | 名单接到了 `in`（image 口）而不是 `in-text`（text 口） |
| 参数写了没生效 | 参数名拼错会被当未声明参数丢弃；先看物化 / `graph_edit` 的 warnings |
