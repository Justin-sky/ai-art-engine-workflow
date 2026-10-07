# 端口与参数速查（comic-publish）

字段名与端口 id 均取自应用源码，可直接写进 `graph_edit` 的 `params`。
节点 id 是随机生成的（`node-<uuid>`），改参数前先用 `graph_read`（`includeParams: true`）拿到真实 id。

## play.script（漫画剧本 / 文本节点）

| 端口 | 类型 | 说明 |
|---|---|---|
| `out` | `text`（多） | 文本出口，扇出到三张分镜图 |

| 参数 | 说明 |
|---|---|
| `text` | 正文；也接受 `generateInstruction`（两者都在生成参数白名单里） |

## asset.image（分镜图 1 / 2 / 3）

| 端口 | 类型 | 说明 |
|---|---|---|
| `in-text` | `text`（多） | 提示词来源（`play.script:out` 接这里） |
| `in-image` | `image`（多） | 参考图（保持角色一致时用） |
| `out` | `image` | 当前选中一张（新建生成后默认= 最新一张） |
| `out-all` | `images`（多） | 全部历史，仅供 `image.select` 一族消费 |

| 参数 | 说明 |
|---|---|
| `generateInstruction` | 该格画面指令 |
| `generateAspectRatio` | 如 `2:3` / `3:4`；单格画面用竖版更贴近漫画页 |
| `generateCount` | 一次出几张（能力档位通常 1 / 2 / 4）；**漫画页只吃 `out` 那一张** |
| `generateModel` / `generateProviderInstanceId` | 覆盖模型与自建提供商 |
| `generateSeed` / `generateSeedUseGlobal` | 复现用；默认跟随工程全局种子 |
| `styleImages` / `styleImagesUseGlobal` / `styleReferenceSubject` / `characterRefs` | 风格 / 角色参考，条目必须带可解析的图（`characterRefs` 每项需 `imageUrl`，一般让用户在节点检查器里绑） |
| `mediaOutputDir` | 覆盖落盘目录 |

## comic.page（漫画页）

| 端口 | 类型 | 说明 |
|---|---|---|
| `in-image` | `image`（**多**） | 分镜图逐个连一条边；cook 按阅读顺序填入空格 |
| `out` / `out-all` | `image` / `images` | 合成后的 PNG 进图库 |

| 参数 | 说明 |
|---|---|
| `comicPage` | 页面数据的序列化 JSON 字符串（`defaultParams` 里声明，故物化/`graph_edit` 都放行） |

### `comicPage` 数据结构（`serializeComicPage` 的产物）

```jsonc
{
  "title": "第一页",              // 可选，页首标题
  "backgroundColor": "#ffffff",  // 可选；缺省 = 导出透明底
  "columns": 3,                   // 网格列数，默认 3
  "rows": 3,                      // 网格行数，默认 3
  "gutter": 16,                   // 格间距（页面像素）
  "width": 1080,                  // 页面像素宽，默认 1080
  "height": 1440,                 // 页面像素高，默认 1440
  "panels": [
    {
      "id": "panel-1",
      "row": 0, "col": 0, "rowSpan": 1, "colSpan": 1,
      "backgroundColor": "#eee",  // 可选，该格底色
      "imageUrl": "相对路径或 data:/http(s)",
      "title": "格标题（无图时作为占位文字）",
      "bubbles": [
        {
          "id": "panel-1-bubble-1",
          "text": "台词正文（空白会被丢弃）",
          "speaker": "角色名",     // 可选
          "x": 0.5, "y": 0.2,      // 格内归一化锚点 0~1，默认 0.5/0.5
          "tail": "tl",            // 尾巴朝向：tl / tr / bl / br，默认 tl
          "scale": 1               // 0.5~4，缺省 1
        }
      ]
    }
  ]
}
```

要点：

- 分格位置会被**夹取**进网格：`col ≤ columns-1`、`row ≤ rows-1`，跨度不会越界（越界即截断）。
- `columns` / `rows` 缺省分别回落 3；`width` / `height` 缺省 1080×1440。
- 气泡坐标与尾巴也走规范化：`tail` 非法值回落 `tl`，`scale` 夹到 0.5–4。
- 页面 `backgroundColor` 缺省时，合成器先 `clearRect`，**留白处 alpha=0**。
- 无 `resolveImage` 通道或图片加载失败时，该格画 `#f2f2f2` 底 + 描边 + 占位标题（不会报错）。

## 输出与写回

- `comic.page` 执行后：合成 PNG 落盘为图片产物，并把规范化后的页面写回节点 `comicPage`（`commitGeneratedImages` 的 `extraParams`）。
- 编辑器里的「导出 PNG」按钮走另一条路：直接合成 → `saveBinaryFilesToDirectory` 让用户选目录，文件名为 `comic-page.png`（可用节点标题覆盖）。
- 合成时图片按 **cover** 方式居中裁切填满分格，不拉伸。

## 常见错误

| 现象 | 原因 |
|---|---|
| 报 `GRAPH_COMIC_PAGE_EMPTY` | 页面没有任何分格，且上游没图可自动建格 |
| 分镜图跑完但页面没变化 | 页面里对应格已有图（只填空格）；先清掉旧图或加格 |
| 参数写了但没生效 | 键名拼错会被当作"未声明参数"丢弃，看物化/`graph_edit` 的 warnings |
| 导出不是透明底 | 页面 `backgroundColor` 被设成了颜色值 |
