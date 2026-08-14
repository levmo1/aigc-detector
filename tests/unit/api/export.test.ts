import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { createTask, updateTask } from '@/lib/tasks/store'

async function request(path: string): Promise<Response> {
  const { detectionsRoutes } = await import('@/server/routes/detections')
  const app = new Hono().route('/api/detections', detectionsRoutes)
  return app.request(path)
}

describe('report export API', () => {
  it('returns an HTML download for a ready report', async () => {
    const task = createTask({ kind: 'text', text: '检测正文'.repeat(40), sourceName: '导出论文', warnings: [] })
    updateTask(task.id, {
      status: 'ready',
      report: {
        id: task.id,
        mode: 'mock',
        sourceName: '导出论文',
        sourceType: 'text',
        text: '检测正文',
        segments: [],
        summary: { aiRate: 0, humanRate: 0, uncertainRate: 0, scoredCharacters: 0 },
        warnings: [],
        generatedAt: '2026-08-12T00:00:00.000Z',
      },
    })

    const response = await request(`/api/detections/${task.id}/export?format=html`)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    await expect(response.text()).resolves.toContain('导出论文')
  })

  it('rejects an unknown export format', async () => {
    const task = createTask({ kind: 'text', text: '检测正文'.repeat(40), sourceName: '格式论文', warnings: [] })
    updateTask(task.id, {
      status: 'ready',
      report: {
        id: task.id,
        mode: 'mock',
        sourceName: '格式论文',
        sourceType: 'text',
        text: '检测正文',
        segments: [],
        summary: { aiRate: 0, humanRate: 0, uncertainRate: 0, scoredCharacters: 0 },
        warnings: [],
        generatedAt: '2026-08-12T00:00:00.000Z',
      },
    })

    const response = await request(`/api/detections/${task.id}/export?format=txt`)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'INVALID_EXPORT_FORMAT' } })
  })
})
