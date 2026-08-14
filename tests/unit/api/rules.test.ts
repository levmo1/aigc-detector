import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Hono } from 'hono'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { resetRuleLibraryCache } from '@/lib/rules/loader'

const tempDir = mkdtempSync(path.join(tmpdir(), 'aigc-rules-api-'))

beforeAll(() => {
  vi.stubEnv('RULES_DIR', tempDir)
})

afterAll(() => {
  vi.unstubAllEnvs()
  resetRuleLibraryCache()
  rmSync(tempDir, { recursive: true, force: true })
})

async function request(path: string, init?: RequestInit): Promise<Response> {
  const { rulesRoutes } = await import('@/server/routes/rules')
  const app = new Hono().route('/api/rules', rulesRoutes)
  return app.request(path, init)
}

describe('rules API', () => {
  it('returns the merged rule library with groups and features', async () => {
    const response = await request('/api/rules')
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.groups.length).toBeGreaterThan(10)
    expect(body.features).toBeDefined()
    expect(Object.keys(body.features).length).toBeGreaterThan(0)
  })

  it('persists user groups and returns the updated library', async () => {
    const response = await request('/api/rules', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        groups: [
          {
            id: 'my-api-rule',
            name: '接口新增规则',
            weight: 2,
            rules: [{ pattern: '接口测试词', weight: 2, note: '来自 API 测试' }],
          },
        ],
      }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.groups.some((group: { id: string }) => group.id === 'my-api-rule')).toBe(true)
  })

  it('rejects malformed rule payloads', async () => {
    const response = await request('/api/rules', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ groups: [{ id: 'bad', name: '坏', weight: 99, rules: [] }] }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'INVALID_RULES' } })
  })

  it('rejects dangerous regex patterns', async () => {
    const response = await request('/api/rules', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        groups: [{ id: 'unsafe', name: '危险', weight: 1, rules: [{ pattern: '(a+)+$', weight: 1 }] }],
      }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'INVALID_RULES' } })
  })

  it('rejects uncompilable regex patterns', async () => {
    const response = await request('/api/rules', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        groups: [{ id: 'broken', name: '坏正则', weight: 1, rules: [{ pattern: '([' , weight: 1 }] }],
      }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'INVALID_RULES' } })
  })
})
