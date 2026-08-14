// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Hono } from 'hono'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const tempData = mkdtempSync(path.join(tmpdir(), 'aigc-persist-'))

beforeAll(() => {
  vi.stubEnv('DATA_DIR', tempData)
})

afterAll(() => {
  vi.unstubAllEnvs()
  rmSync(tempData, { recursive: true, force: true })
})

vi.mock('@/lib/llm/config', () => ({
  loadLlmConfig: () => ({ enabled: false, apiKey: '', presetId: 'deepseek', baseUrl: '', model: '', timeoutMs: 30000, maxSegments: 15 }),
}))

const longText = '这是一段用于 API 契约测试的中文正文。'.repeat(30)

async function request(path: string, init?: RequestInit): Promise<Response> {
  const { detectionsRoutes } = await import('@/server/routes/detections')
  const app = new Hono().route('/api/detections', detectionsRoutes)
  return app.request(path, init)
}

describe('detections API', () => {
  it('accepts JSON text and exposes the completed report', async () => {
    const response = await request('/api/detections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: longText }),
    })
    const created = await response.json()

    expect(response.status).toBe(202)
    expect(created.id).toMatch(/^det_/u)

    let result: Response | undefined
    for (let attempt = 0; attempt < 20; attempt += 1) {
      result = await request(`/api/detections/${created.id}`)
      const body = await result.clone().json()
      if (body.status === 'ready') break
      await new Promise((resolve) => setTimeout(resolve, 5))
    }

    const completed = await result!.json()
    expect(completed.status).toBe('ready')
    expect(completed.report.mode).toBe('rule')
    expect(completed.report.summary.scoredCharacters).toBeGreaterThan(0)
  })

  it('rejects short JSON text with a stable Chinese error', async () => {
    const response = await request('/api/detections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '太短了' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'TEXT_TOO_SHORT' },
    })
  })

  it('rejects malformed JSON and unsupported content types as client errors', async () => {
    const malformed = await request('/api/detections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    })
    const unsupported = await request('/api/detections', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: longText,
    })

    expect(malformed.status).toBe(400)
    expect(unsupported.status).toBe(400)
    await expect(malformed.json()).resolves.toMatchObject({ error: { code: 'INVALID_REQUEST' } })
    await expect(unsupported.json()).resolves.toMatchObject({ error: { code: 'INVALID_REQUEST' } })
  })

  it('rejects a multipart request that contains both text and a file', async () => {
    const formData = new FormData()
    formData.set('text', longText)
    formData.set('file', new File(['%PDF-demo'], 'paper.pdf', { type: 'application/pdf' }))

    const response = await request('/api/detections', {
      method: 'POST',
      body: formData,
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'MULTIPLE_INPUTS' } })
  })

  it('returns 404 for an expired or unknown task', async () => {
    const response = await request('/api/detections/missing')

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'TASK_NOT_FOUND' },
    })
  })
})
