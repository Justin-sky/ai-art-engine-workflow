#!/usr/bin/env node
/**
 * 工作流市场校验器（贡献者本地与 CI 共用）。
 *
 * 设计原则：**能机械判定的都在这里拒掉**，不留给人工审核去发现 ——
 * 审核应该花在「这个工作流好不好用」，而不是「id 拼错了没有」。
 *
 * 用法：
 *   node scripts/validate.mjs              校验全部工作流 + 索引一致性
 *   node scripts/validate.mjs --check-index 只校验索引是否与磁盘一致（CI 快速路径）
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WORKFLOWS_DIR = join(ROOT, 'workflows')
const INDEX_PATH = join(ROOT, 'index.json')
const KNOWN_TYPES_PATH = join(ROOT, 'scripts', 'known-node-types.json')

/** 与 index.json 的 schemaVersion 对齐 */
export const SCHEMA_VERSION = 1

/** 分类枚举：与应用 `src/shared/workflowMarket.ts` 的 WORKFLOW_MARKET_CATEGORIES 必须一致 */
export const CATEGORIES = ['film', 'ad', 'game', 'character', 'comic', 'utility']

export const LIMITS = {
  summaryMax: 60,
  coverMaxBytes: 300 * 1024,
  nodesMax: 200,
  paramTextMax: 20000
}

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[-0-9A-Za-z.]+)?(?:\+[-0-9A-Za-z.]+)?$/

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function knownNodeTypes() {
  try {
    const raw = readJson(KNOWN_TYPES_PATH)
    return new Set(Array.isArray(raw.nodeTypes) ? raw.nodeTypes : [])
  } catch {
    return null // 缺文件时不阻塞（首次引入脚本时还没生成）
  }
}

/** 从 plan 派生用到的节点类型（与应用 `nodeTypesOfPlan` 同一口径） */
export function nodeTypesOfPlan(plan) {
  const set = new Set()
  for (const node of plan?.nodes ?? []) {
    if (node && typeof node.typeId === 'string' && node.typeId.trim()) set.add(node.typeId.trim())
  }
  return [...set].sort()
}

/**
 * 校验一个工作流目录，返回错误数组（空数组 = 通过）。
 * 导出以便测试与 CI 复用同一套规则。
 */
export function validateWorkflow({ dirName, bundle, coverBytes, known }) {
  const errors = []
  const push = (msg) => errors.push(`${dirName}: ${msg}`)

  if (!bundle || typeof bundle !== 'object') {
    push('workflow.json 不是对象')
    return errors
  }
  if (bundle.schemaVersion !== SCHEMA_VERSION) {
    push(`schemaVersion 必须是 ${SCHEMA_VERSION}，实际 ${bundle.schemaVersion}`)
  }
  if (typeof bundle.id !== 'string' || !ID_RE.test(bundle.id)) {
    push(`id 必须是 kebab-case（小写字母/数字/连字符），实际 ${JSON.stringify(bundle.id)}`)
  }
  if (bundle.id !== dirName) {
    push(`id（${bundle.id}）必须与目录名（${dirName}）一致`)
  }
  for (const field of ['title', 'summary', 'license']) {
    if (typeof bundle[field] !== 'string' || !bundle[field].trim()) {
      push(`${field} 必填`)
    }
  }
  if (typeof bundle.summary === 'string' && bundle.summary.length > LIMITS.summaryMax) {
    push(`summary 超过 ${LIMITS.summaryMax} 字（卡片只有一行）`)
  }
  if (typeof bundle.version !== 'string' || !SEMVER_RE.test(bundle.version)) {
    push(`version 必须是 semver，实际 ${JSON.stringify(bundle.version)}`)
  }
  if (!bundle.author || typeof bundle.author !== 'object' || !bundle.author.name?.trim?.()) {
    push('author.name 必填（署名是审核底线）')
  }
  if (!CATEGORIES.includes(bundle.category)) {
    push(`category 必须是 ${CATEGORIES.join(' / ')} 之一，实际 ${JSON.stringify(bundle.category)}`)
  }

  const plan = bundle.plan
  if (!plan || typeof plan !== 'object') {
    push('plan 必填')
    return errors
  }
  const nodes = plan.nodes
  if (!Array.isArray(nodes) || nodes.length === 0) {
    push('plan.nodes 必须是非空数组')
    return errors
  }
  if (nodes.length > LIMITS.nodesMax) {
    push(`plan.nodes 超过 ${LIMITS.nodesMax} 个`)
  }
  const keys = new Set()
  for (const node of nodes) {
    if (!node || typeof node !== 'object') {
      push('plan.nodes 含非对象项')
      continue
    }
    if (typeof node.key !== 'string' || !node.key.trim()) push('节点缺 key')
    else if (keys.has(node.key)) push(`节点 key 重复：${node.key}`)
    else keys.add(node.key)
    if (typeof node.typeId !== 'string' || !node.typeId.trim()) {
      push(`节点 ${node.key ?? '?'} 缺 typeId`)
    }
    for (const [paramKey, value] of Object.entries(node.params ?? {})) {
      if (typeof value === 'string' && value.length > LIMITS.paramTextMax) {
        push(`节点 ${node.key} 的参数 ${paramKey} 超长（> ${LIMITS.paramTextMax} 字符）`)
      }
    }
  }
  for (const edge of plan.edges ?? []) {
    if (!edge || typeof edge !== 'object') {
      push('plan.edges 含非对象项')
      continue
    }
    if (!keys.has(edge.from)) push(`连线起点不存在：${edge.from}`)
    if (!keys.has(edge.to)) push(`连线终点不存在：${edge.to}`)
  }

  // requires 必须与 plan 实际用到的一致（派生字段，不允许手写撒谎）
  const declared = [...new Set(bundle.requires?.nodeTypes ?? [])].sort()
  const actual = nodeTypesOfPlan(plan)
  if (JSON.stringify(declared) !== JSON.stringify(actual)) {
    push(
      `requires.nodeTypes 与 plan 不一致：声明 ${JSON.stringify(declared)}，实际 ${JSON.stringify(actual)}（应由 build-index 派生）`
    )
  }
  if (known) {
    const unknown = actual.filter((typeId) => !known.has(typeId))
    if (unknown.length) push(`引用了未知节点类型：${unknown.join(', ')}`)
  }

  // 封面必填：参考图的观感一半来自封面，缺图的卡片就是这个市场失败的样子
  if (coverBytes == null) push('缺少封面（cover.png）')
  else if (coverBytes > LIMITS.coverMaxBytes) {
    push(`封面超过 ${Math.round(LIMITS.coverMaxBytes / 1024)}KB`)
  }

  return errors
}

/** 从磁盘读取每个工作流并校验；返回 { errors, entries } */
export function validateAll() {
  const known = knownNodeTypes()
  const errors = []
  const entries = []
  let dirs = []
  try {
    dirs = readdirSync(WORKFLOWS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
  } catch {
    return { errors: [`缺少 workflows/ 目录`], entries: [] }
  }

  for (const dirName of dirs) {
    const dir = join(WORKFLOWS_DIR, dirName)
    let bundle = null
    try {
      bundle = readJson(join(dir, 'workflow.json'))
    } catch (err) {
      errors.push(`${dirName}: 无法读取 workflow.json（${err.message}）`)
      continue
    }
    let coverBytes = null
    const coverName = typeof bundle.cover === 'string' && bundle.cover ? bundle.cover : 'cover.png'
    try {
      coverBytes = statSync(join(dir, coverName)).size
    } catch {
      coverBytes = null
    }
    const dirErrors = validateWorkflow({ dirName, bundle, coverBytes, known })
    errors.push(...dirErrors)
    if (dirErrors.length === 0) entries.push(entryFromBundle(bundle, dir, coverName))
  }
  return { errors, entries }
}

/** 由 bundle 派生索引条目（索引里的派生字段只在这里产生） */
export function entryFromBundle(bundle, dir, coverName) {
  const plan = bundle.plan
  const nodeTypes = nodeTypesOfPlan(plan)
  let sizeBytes = 0
  try {
    sizeBytes = statSync(join(dir, 'workflow.json')).size
  } catch {
    sizeBytes = 0
  }
  return {
    id: bundle.id,
    title: bundle.title,
    ...(bundle.titleEn ? { titleEn: bundle.titleEn } : {}),
    summary: bundle.summary,
    category: bundle.category,
    ...(Array.isArray(bundle.tags) && bundle.tags.length ? { tags: bundle.tags } : {}),
    version: bundle.version,
    author: bundle.author,
    license: bundle.license,
    cover: coverName,
    requires: {
      nodeTypes,
      ...(bundle.requires?.appMinVersion ? { appMinVersion: bundle.requires.appMinVersion } : {})
    },
    nodeCount: plan.nodes.length,
    edgeCount: (plan.edges ?? []).length,
    sizeBytes
  }
}

function main() {
  const checkIndexOnly = process.argv.includes('--check-index')
  const { errors, entries } = validateAll()
  if (errors.length) {
    console.error(`✗ 校验失败（${errors.length} 项）：`)
    for (const error of errors) console.error(`  - ${error}`)
    process.exit(1)
  }
  console.log(`✓ ${entries.length} 个工作流校验通过`)

  let expected = null
  try {
    expected = readJson(INDEX_PATH)
  } catch {
    console.error('✗ 缺少 index.json（运行 node scripts/build-index.mjs）')
    process.exit(1)
  }
  const expectedIds = (expected.workflows ?? []).map((w) => w.id).join(',')
  const actualIds = entries.map((e) => e.id).join(',')
  if (expectedIds !== actualIds) {
    console.error('✗ index.json 与磁盘不一致（运行 node scripts/build-index.mjs 后提交）')
    console.error(`  索引：${expectedIds || '(空)'}`)
    console.error(`  磁盘：${actualIds || '(空)'}`)
    process.exit(1)
  }
  // 派生字段也要一致：防止有人手改索引把 requires 改松
  const expectedMap = new Map((expected.workflows ?? []).map((w) => [w.id, w]))
  for (const entry of entries) {
    const stated = expectedMap.get(entry.id)
    if (JSON.stringify(stated?.requires) !== JSON.stringify(entry.requires)) {
      console.error(`✗ ${entry.id} 的 requires 与 plan 派生结果不一致`)
      process.exit(1)
    }
    if (stated?.nodeCount !== entry.nodeCount || stated?.edgeCount !== entry.edgeCount) {
      console.error(`✗ ${entry.id} 的节点/连线数与 plan 不一致`)
      process.exit(1)
    }
  }
  console.log(checkIndexOnly ? '✓ 索引一致' : '✓ index.json 与磁盘一致')
}

// 直接执行时跑 main；被测试 import 时不跑
if (process.argv[1] && process.argv[1].endsWith('validate.mjs')) main()
