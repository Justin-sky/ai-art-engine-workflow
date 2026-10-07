#!/usr/bin/env node
/**
 * 由 workflows 目录下的 workflow.json 生成 index.json。
 *
 * **唯一的索引写入者**：贡献者不手改索引，CI 在 main 上自动重建 —— 这从根上消灭了
 * 「改了工作流忘了改索引」和「多人同时改索引」两类合并冲突。
 *
 * 索引里所有派生字段（requires / nodeCount / edgeCount / sizeBytes）都在这里产生，
 * 因此它们不可能与 workflow.json 撒谎。
 *
 * 注意：本文件里不要写出「星号紧跟斜杠」的 glob 字面量 —— 在块注释中它会提前结束注释，
 * 把后续文字当成代码，报出一个与真实位置无关的 SyntaxError。
 *
 * 用法：
 *   node scripts/build-index.mjs          重建并写入 index.json
 *   node scripts/build-index.mjs --check  只检查是否需要重建（CI 用，不写盘）
 */

import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJson, validateAll, SCHEMA_VERSION } from './validate.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const INDEX_PATH = join(ROOT, 'index.json')
const REPO_URL = 'https://github.com/Justin-sky/ai-art-engine-workflow'

function buildIndex(entries) {
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    source: { repo: REPO_URL, ref: 'main' },
    // 按 id 字典序：减少 PR 合并冲突
    workflows: entries.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  }
}

/** 比较时忽略 generatedAt（每次运行都不同，不该因此判定不一致） */
function stableView(index) {
  const { generatedAt: _ignored, ...rest } = index
  return JSON.stringify(rest, null, 2)
}

function main() {
  const check = process.argv.includes('--check')
  const { errors, entries } = validateAll()
  if (errors.length) {
    console.error(`✗ 校验失败（${errors.length} 项），先修完再重建索引：`)
    for (const error of errors.slice(0, 20)) console.error(`  - ${error}`)
    process.exit(1)
  }

  const next = buildIndex(entries)
  let current = null
  try {
    current = readJson(INDEX_PATH)
  } catch {
    current = null
  }

  if (check) {
    if (!current || stableView(current) !== stableView(next)) {
      console.error('✗ index.json 需要重建（运行 node scripts/build-index.mjs）')
      process.exit(1)
    }
    console.log('✓ index.json 已是最新')
    return
  }

  // 内容没变时保留原 generatedAt，避免每次 CI 都产生一个无意义的 diff
  if (current && stableView(current) === stableView(next)) {
    console.log('✓ index.json 无变化')
    return
  }
  writeFileSync(INDEX_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  console.log(`✓ 已写入 index.json（${next.workflows.length} 个工作流）`)
}

main()
