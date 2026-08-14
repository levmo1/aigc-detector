// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Hono } from 'hono'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const tempRoot = mkdtempSync(path.join(tmpdir(), 'aigc-history-'))
const tempConfig = path.join(tempRoot, 'config')

beforeAll(() => {
  vi.stubEnv('CONFIG_DIR', tempConfig)
  vi.stubEnv('DATA_DIR', tempRoot)
})

beforeEach(async () => {
  vi.resetModules()
  vi.stubEnv('DATA_DIR', mkdtempSync(path.join(tempRoot, 'data-')))
})

afterAll(() => {
  vi.unstubAllEnvs()
  rmSync(tempRoot, { recursive: true, force: true })
})

async function request(path: string, init?: RequestInit): Promise<Response> {
  const { historyRoutes } = await import('@/server/routes/history')
  const app = new Hono().route('/api/history', historyRoutes)
  return app.request(path, init)
}

describe('history API', () => {
  it('lists a finished detection after the task completes', async () => {
    const { createTask, updateTask } = await import('@/lib/tasks/store')

    const task = createTask({ kind: 'text', text: '历史记录测试正文。'.repeat(30), sourceName: '历史论文', warnings: [] })
    updateTask(task.id, {
      status: 'ready',
      report: {
        id: task.id,
        mode: 'rule',
        sourceName: '历史论文',
        sourceType: 'text',
        text: '历史记录测试正文。',
        segments: [],
        summary: { aiRate: 40, humanRate: 60, uncertainRate: 0, scoredCharacters: 10 },
        warnings: [],
        generatedAt: new Date().toISOString(),
      },
    })

    const response = await request('/api/history')
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.items.length).toBe(1)
    expect(body.items[0].sourceName).toBe('历史论文')
    expect(body.maxCount).toBe(50)
  })

  it('deletes a history entry', async () => {
    const { createTask, updateTask } = await import('@/lib/tasks/store')

    const task = createTask({ kind: 'text', text: '待删除的历史记录正文。'.repeat(30), sourceName: '待删除', warnings: [] })
    updateTask(task.id, {
      status: 'ready',
      report: {
        id: task.id,
        mode: 'rule',
        sourceName: '待删除',
        sourceType: 'text',
        text: '待删除',
        segments: [],
        summary: { aiRate: 0, humanRate: 100, uncertainRate: 0, scoredCharacters: 5 },
        warnings: [],
        generatedAt: new Date().toISOString(),
      },
    })

    await request(`/api/history/${task.id}`, { method: 'DELETE' })

    const body = await (await request('/api/history')).json()
    expect(body.items.length).toBe(0)
  })

  it('applies the configured max count and prunes older entries', async () => {
    const { createTask, updateTask } = await import('@/lib/tasks/store')

    for (let index = 0; index < 3; index += 1) {
      const task = createTask({ kind: 'text', text: `第 ${index} 篇。`.repeat(30), sourceName: `论文${index}`, warnings: [] })
      updateTask(task.id, {
        status: 'ready',
        report: {
          id: task.id,
          mode: 'rule',
          sourceName: `论文${index}`,
          sourceType: 'text',
          text: `第 ${index} 篇。`,
          segments: [],
          summary: { aiRate: 0, humanRate: 100, uncertainRate: 0, scoredCharacters: 5 },
          warnings: [],
          generatedAt: new Date().toISOString(),
        },
      })
    }

    const putResponse = await request('/api/history', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ maxCount: 1 }),
    })
    expect(putResponse.status).toBe(200)

    const body = await (await request('/api/history')).json()
    expect(body.maxCount).toBe(1)
    expect(body.items.length).toBe(1)
  })
})
