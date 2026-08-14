import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { loadRuleLibrary, resetRuleLibraryCache } from '@/lib/rules/loader'

const tempDir = mkdtempSync(path.join(tmpdir(), 'aigc-rules-'))

beforeAll(() => {
  vi.stubEnv('RULES_DIR', tempDir)
})

afterAll(() => {
  vi.unstubAllEnvs()
  resetRuleLibraryCache()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('rule library loader', () => {
  it('loads the default rule library without a user file', async () => {
    const loaderModule = await import('@/lib/rules/loader')
    resetRuleLibraryCache()
    const library = loaderModule.loadRuleLibrary()

    expect(library.groups.length).toBeGreaterThan(10)
    expect(library.groups.every((group) => group.rules.length > 0)).toBe(true)
  })

  it('merges saved user groups over the defaults', async () => {
    const loaderModule = await import('@/lib/rules/loader')
    resetRuleLibraryCache()
    loaderModule.saveUserRuleGroups([
      {
        id: 'summary-catchphrase',
        name: '总结套话（用户版）',
        weight: 2,
        rules: [{ pattern: '我自定义的总结词', weight: 1, note: '用户新增' }],
      },
      {
        id: 'my-rules',
        name: '我的规则',
        weight: 1,
        rules: [{ pattern: '自定义正则.{0,5}匹配', weight: 2, note: '正则示例' }],
      },
    ])
    resetRuleLibraryCache()
    const library = loaderModule.loadRuleLibrary()

    const summaryGroup = library.groups.find((group) => group.id === 'summary-catchphrase')
    expect(summaryGroup?.name).toBe('总结套话（用户版）')
    expect(summaryGroup?.rules.map((rule) => rule.pattern)).toContain('我自定义的总结词')
    expect(library.groups.some((group) => group.id === 'my-rules')).toBe(true)
  })

  it('rejects invalid user rule groups', async () => {
    const loaderModule = await import('@/lib/rules/loader')

    expect(() => loaderModule.saveUserRuleGroups([
      { id: 'bad', name: '坏规则', weight: 0, rules: [] },
    ])).toThrow()
  })
})
