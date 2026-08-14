import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Hono } from 'hono'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

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

    // 切到自定义方案：不应看到 deepseek 的 key
    const custom = await request('/api/llm-config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        enabled: true,
        presetId: 'custom',
        baseUrl: 'https://example.com/v1',
        apiKey: '',
        model: 'my-model',
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
})
