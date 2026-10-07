#!/usr/bin/env node
/**
 * 校验器的技能包分支测试（`node --test scripts/`）。
 *
 * 为什么必须测：技能包一旦提交就以**引导加载**的方式进入 agent 的上下文，
 * 而 dsh 对不合法的技能是**静默忽略**（只写一行日志）。也就是说仓库侧漏检
 * 不会报错，只会让用户「装了却看不见」—— 这种故障最难查，所以把每条规则钉在这里。
 *
 * 用 node:test 而非引入测试框架：本仓库刻意零依赖，CI 只跑 node。
 */

import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import { after, describe, it } from 'node:test'

import {
  LIMITS,
  parseSkillFrontmatter,
  readSkillBundle,
  readJson,
  validateAll
} from './validate.mjs'

const dirs = []
after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

/** 造一个临时工作流目录；`skillFiles` 为相对 skill/ 的路径 → 内容 */
function makeWorkflow({ id = 'demo', version = '1.0.0', skillFiles = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'wf-validate-'))
  dirs.push(root)
  const dir = join(root, id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'workflow.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        id,
        title: 'T',
        summary: 's',
        category: 'utility',
        version,
        author: { name: 'a' },
        license: 'MIT',
        cover: 'cover.png',
        requires: { nodeTypes: [] },
        plan: { nodes: [{ key: 'n', typeId: 'note.text' }], edges: [] }
      },
      null,
      2
    )
  )
  if (skillFiles) {
    for (const [rel, content] of Object.entries(skillFiles)) {
      const abs = join(dir, 'skill', rel)
      mkdirSync(join(abs, '..'), { recursive: true })
      writeFileSync(abs, content)
    }
  }
  return dir
}

const FRONTMATTER = (extra = '') =>
  `---\nname: wf-demo\ndescription: 演示技能\nworkflow: demo\n${extra}---\n\n# Demo\n\n正文。\n`

describe('不带技能包的工作流', () => {
  it('不产生 skill 段（向后兼容）', () => {
    const dir = makeWorkflow()
    const result = readSkillBundle(dir, 'demo', { version: '1.0.0' })
    assert.deepEqual(result.errors, [])
    assert.equal(result.skill, null)
  })
})

describe('合法技能包', () => {
  it('派生出清单，且不含脚本', () => {
    const dir = makeWorkflow({
      skillFiles: { 'SKILL.md': FRONTMATTER(), 'references/ports.md': '# ports\n' }
    })
    const { errors, skill } = readSkillBundle(dir, 'demo', { version: '1.0.0' })
    assert.deepEqual(errors, [])
    assert.equal(skill.name, 'wf-demo')
    assert.equal(skill.entry, 'SKILL.md')
    assert.equal(skill.hasScripts, false)
    assert.deepEqual(
      skill.files.map((f) => f.path).sort(),
      ['SKILL.md', 'references/ports.md']
    )
    assert.equal(skill.sizeBytes, skill.files.reduce((sum, f) => sum + f.sizeBytes, 0))
  })

  it('含 scripts/ 时标记 hasScripts（仓库允许提交，客户端决定装不装）', () => {
    const dir = makeWorkflow({
      skillFiles: { 'SKILL.md': FRONTMATTER(), 'scripts/run.mjs': 'export {}\n' }
    })
    const { errors, skill } = readSkillBundle(dir, 'demo', { version: '1.0.0' })
    assert.deepEqual(errors, [])
    assert.equal(skill.hasScripts, true)
  })
})

describe('技能包的拒绝规则', () => {
  const cases = [
    {
      name: 'skill/ 存在但没有 SKILL.md',
      files: { 'references/a.md': 'x' },
      match: /缺少 SKILL\.md/
    },
    {
      name: 'name 缺少 wf- 前缀（会与内置技能重名）',
      files: { 'SKILL.md': '---\nname: demo\ndescription: d\nworkflow: demo\n---\n' },
      match: /name 必须是 wf-demo/
    },
    {
      name: 'name 不是 kebab-case',
      files: { 'SKILL.md': '---\nname: wf_Demo\ndescription: d\nworkflow: demo\n---\n' },
      match: /name 必须是 kebab-case/
    },
    {
      name: '缺 description',
      files: { 'SKILL.md': '---\nname: wf-demo\nworkflow: demo\n---\n' },
      match: /必须写 frontmatter description/
    },
    {
      name: '缺 workflow 绑定',
      files: { 'SKILL.md': '---\nname: wf-demo\ndescription: d\n---\n' },
      match: /必须写 workflow: demo/
    },
    {
      name: 'workflow 绑定到别的 id',
      files: { 'SKILL.md': '---\nname: wf-demo\ndescription: d\nworkflow: other\n---\n' },
      match: /与目录名 demo 不一致/
    },
    {
      name: 'workflow-version 与 workflow.json 不一致',
      files: {
        'SKILL.md': '---\nname: wf-demo\ndescription: d\nworkflow: demo\nworkflow-version: 9.9.9\n---\n'
      },
      match: /与 workflow\.json 的 version/
    },
    {
      name: '用了 dsh 会直接抛错的 camelCase 旧键',
      files: { 'SKILL.md': '---\nname: wf-demo\ndescription: d\nworkflow: demo\ndisableModelInvocation: true\n---\n' },
      match: /旧键 disableModelInvocation/
    },
    {
      name: '出现未允许的子目录',
      files: { 'SKILL.md': FRONTMATTER(), 'secret/a.md': 'x' },
      match: /只允许 references \/ scripts \/ assets/
    },
    {
      name: 'description 超过 dsh 目录上限',
      files: {
        'SKILL.md': `---\nname: wf-demo\ndescription: ${'x'.repeat(LIMITS.skillDescriptionMax + 1)}\nworkflow: demo\n---\n`
      },
      match: /description 超过/
    },
    {
      name: '单文件超体积上限',
      files: {
        'SKILL.md': FRONTMATTER(),
        'references/big.md': 'x'.repeat(LIMITS.skillFileMaxBytes + 1)
      },
      match: /超过 128KB/
    }
  ]

  for (const testCase of cases) {
    it(testCase.name, () => {
      const dir = makeWorkflow({ skillFiles: testCase.files })
      const { errors } = readSkillBundle(dir, 'demo', { version: '1.0.0' })
      assert.ok(errors.length > 0, `应当报错，实际：${JSON.stringify(errors)}`)
      assert.match(errors.join('\n'), testCase.match)
    })
  }

  it('符号链接被拒（避免技能包指向仓库外）', () => {
    const dir = makeWorkflow({ skillFiles: { 'SKILL.md': FRONTMATTER() } })
    try {
      symlinkSync(join(dir, 'workflow.json'), join(dir, 'skill', 'link.json'))
    } catch {
      return // Windows 无权限时跳过（CI 为 Linux，会真的走到断言）
    }
    const { errors } = readSkillBundle(dir, 'demo', { version: '1.0.0' })
    assert.match(errors.join('\n'), /不允许符号链接/)
  })
})

describe('frontmatter 解析', () => {
  it('剥掉引号、跳过注释与空行', () => {
    const parsed = parseSkillFrontmatter(
      '---\n# 注释\nname: "wf-demo"\ndescription: \'d\'\n\nworkflow: demo\n---\n正文\n'
    )
    assert.deepEqual(parsed.data, { name: 'wf-demo', description: 'd', workflow: 'demo' })
    assert.equal(parsed.body.trim(), '正文')
  })

  it('缺 frontmatter 报错', () => {
    assert.match(parseSkillFrontmatter('# 没有 frontmatter\n').error, /缺少 frontmatter/)
  })

  it('无法解析的行报错（不静默吞掉）', () => {
    assert.match(parseSkillFrontmatter('---\n- 列表项\n---\n').error, /无法解析/)
  })
})

describe('真实仓库', () => {
  it('validateAll 通过，且 world-model 带上了技能清单', () => {
    const { errors, entries } = validateAll()
    assert.deepEqual(errors, [])
    const world = entries.find((entry) => entry.id === 'world-model')
    assert.ok(world, '应当有 world-model')
    assert.ok(world.skill, 'world-model 应当带技能包')
    assert.equal(world.skill.name, 'wf-world-model')
    assert.equal(world.skill.hasScripts, false)
    assert.ok(world.skill.files.some((f) => f.path === 'SKILL.md'))
  })

  it('index.json 里的技能清单与磁盘派生一致', () => {
    const index = readJson(join(process.cwd(), 'index.json'))
    const { entries } = validateAll()
    for (const entry of entries) {
      const stated = index.workflows.find((w) => w.id === entry.id)
      assert.equal(
        JSON.stringify(stated?.skill ?? null),
        JSON.stringify(entry.skill ?? null),
        `${entry.id} 的技能清单不一致`
      )
    }
  })

  it('不带技能的工作流在索引里没有 skill 字段', () => {
    const { entries } = validateAll()
    const withoutSkill = entries.filter((entry) => !entry.skill)
    assert.ok(withoutSkill.length > 0, '应当仍有不带技能的工作流（向后兼容）')
  })
})
