import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Hono } from 'hono'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import * as llmHttp from '@/lib/llm/http'

const tempDir = mkdtempSync(path.join(tmpdir(), 'aigc-llm-api-'))

beforeAll(() => {
  vi.stubEnv('CONFIG_DIR', tempDir)
})

afterAll(() => {
  vi.unstubAllEnvs()
  rmSync(tempDir, { recursive: true, force: true })
})

async function request(path: string, init?: RequestInit): Promise<Response> {
  const { llmConfigRoutes } = await import('@/server/routes/llm-config')
  const app = new Hono().route('/api/llm-config', llmConfigRoutes)
  return app.request(path, init)
}

describe('llm config API', () => {
  it('returns the config with masked key and preset list', async () => {
    const response = await request('/api/llm-config')
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.enabled).toBe(false)
    expect(body.secondReviewEnabled).toBe(false)
    expect(body.hasApiKey).toBe(false)
    expect(body.presets.some((preset: { id: string }) => preset.id === 'deepseek')).toBe(true)
    expect(body.presets.some((preset: { id: string }) => preset.id === 'opencodego')).toBe(true)
  })

  it('persists configuration with a new key', async () => {
    const response = await request('/api/llm-config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        enabled: true,
        presetId: 'deepseek',
        baseUrl: 'https://api.deepseek.com',
        apiKey: 'sk-test',
        model: 'deepseek-chat',
      }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.enabled).toBe(true)
    expect(body.hasApiKey).toBe(true)
    expect(body.apiKeySource).toBe('user')

    const reload = await request('/api/llm-config')
    expect((await reload.json()).model).toBe('deepseek-chat')
  })

  it('keeps model assistance and second review as separate switches', async () => {
    const response = await request('/api/llm-config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        enabled: true,
        secondReviewEnabled: false,
        presetId: 'deepseek',
        baseUrl: 'https://api.deepseek.com',
        apiKey: 'sk-test',
        model: 'deepseek-chat',
      }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.enabled).toBe(true)
    expect(body.secondReviewEnabled).toBe(false)
  })

  it('isolates keys per preset', async () => {
    await request('/api/llm-config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        enabled: true,
        presetId: 'deepseek',
        baseUrl: 'https://api.deepseek.com',
        apiKey: 'sk-deepseek-only',
        model: 'deepseek-chat',
      }),
    })

    // 切到用户方案：不应看到 deepseek 的 key
    const custom = await request('/api/llm-config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        enabled: true,
        presetId: 'custom-gateway',
        baseUrl: 'https://example.com/v1',
        apiKey: '',
        model: 'my-model',
        customPresets: [{ id: 'custom-gateway', name: '自定义网关', baseUrl: 'https://example.com/v1' }],
      }),
    })
    const customBody = await custom.json()
    expect(customBody.hasApiKey).toBe(false)
    expect(customBody.apiKeySource).toBe('none')

    // 回到 deepseek：key 仍保留
    const back = await request('/api/llm-config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        enabled: true,
        presetId: 'deepseek',
        baseUrl: 'https://api.deepseek.com',
        apiKey: '',
        model: 'deepseek-chat',
      }),
    })
    const backBody = await back.json()
    expect(backBody.hasApiKey).toBe(true)
    expect(backBody.apiKeySource).toBe('user')
  })

  it('keeps the existing key when apiKey is omitted', async () => {
    const response = await request('/api/llm-config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        enabled: true,
        presetId: 'deepseek',
        baseUrl: 'https://api.deepseek.com',
        apiKey: '',
        model: 'deepseek-chat',
      }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.hasApiKey).toBe(true)
  })

  it('rejects invalid configuration', async () => {
    const response = await request('/api/llm-config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: true, baseUrl: 'not-a-url', apiKey: 'k', model: '' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'INVALID_LLM_CONFIG' } })
  })

  it('clears the persisted key when resetApiKey is set', async () => {
    const response = await request('/api/llm-config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        enabled: true,
        baseUrl: 'https://example.com/v1',
        apiKey: 'sk-kept',
        model: 'm',
        resetApiKey: true,
      }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.hasApiKey).toBe(false)
  })

  it('adds a custom preset and preserves it when saving the main config', async () => {
    const created = await request('/api/llm-config/presets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '公司网关', baseUrl: 'https://gateway.example.com/v1' }),
    })
    const createdBody = await created.json()
    const custom = createdBody.presets.find((preset: { id: string; name: string }) => preset.name === '公司网关')

    expect(created.status).toBe(201)
    expect(custom).toMatchObject({ name: '公司网关', baseUrl: 'https://gateway.example.com/v1' })

    const saved = await request('/api/llm-config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        enabled: false,
        presetId: 'deepseek',
        baseUrl: 'https://api.deepseek.com',
        apiKey: '',
        model: 'deepseek-chat',
      }),
    })
    const savedBody = await saved.json()

    expect(saved.status).toBe(200)
    expect(savedBody.presets.some((preset: { id: string }) => preset.id === custom.id)).toBe(true)

    const deleted = await request(`/api/llm-config/presets/${custom.id}`, { method: 'DELETE' })
    const deletedBody = await deleted.json()
    expect(deleted.status).toBe(200)
    expect(deletedBody.presetId).toBe('deepseek')
    expect(deletedBody.presets.some((preset: { id: string }) => preset.id === custom.id)).toBe(false)
  })

  it('discovers models from an OpenAI-compatible models endpoint', async () => {
    const fetchMock = vi.spyOn(llmHttp, 'llmFetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'model-a' }, { id: 'model-b', name: 'Model B' }] }),
    } as unknown as Response)

    const response = await request('/api/llm-config/models', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        presetId: 'custom-company',
        baseUrl: 'https://gateway.example.com/v1',
        apiKey: 'test-key',
      }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.models).toEqual([
      { id: 'model-a', name: 'model-a' },
      { id: 'model-b', name: 'Model B' },
    ])
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe('https://gateway.example.com/v1/models')
  })
})
