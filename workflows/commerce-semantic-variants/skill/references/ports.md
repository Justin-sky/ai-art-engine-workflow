# 端口与数据包速查

## 节点

| key | typeId | 入 | 出 |
|---|---|---|---|
| analyze | `video.semanticAnalyze` | video | text（timeline JSON） |
| timeline | `semantic.timeline` | text | text |
| compile | `semantic.compile` | text | text（commands + ScriptTimeline） |
| repair | `video.repair` | text | text（plan + definition） |
| variant | `video.variant` | text | text（plan；`recipeId`） |
| note | `note.text` | — | — |

## semanticPacks 相对路径

均相对工作流根目录，安装后落在 `<installed>/<id>/semanticPacks/`。

- `semanticPacks/commerce-vocabulary.json`
- `semanticPacks/commerce-director-rules.json`
- `semanticPacks/commerce-director-persona.json`
- `semanticPacks/variant-replace-product.json`
- `semanticPacks/variant-rewrite-hook.json`
- `semanticPacks/variant-revoice-lang.json`
