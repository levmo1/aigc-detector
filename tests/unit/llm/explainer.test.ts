import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { judgeSegmentsWithLlm, isLlmConfigured, resetLlmConcurrency } from '@/lib/llm/explainer'

vi.mock('@/lib/llm/http', () => ({
  llmFetch: vi.fn(),
}))
import { saveLlmConfig } from '@/lib/llm/config'
import { llmFetch } from '@/lib/llm/http'
import type { DetectedSegment } from '@/lib/domain/segments'

const tempDir = mkdtempSync(path.join(tmpdir(), 'aigc-llm-'))

const segment = (id: string, text: string): DetectedSegment => ({
  id,
  text,
  start: 0,
  end: text.length,
  paragraphIndex: 0,
  label: 'ai',
  confidence: 0.8,
  reasons: ['规则线索'],
  suggestions: ['本地建议'],
  scored: true,
})

beforeAll(() => {
  vi.stubEnv('CONFIG_DIR', tempDir)
})

afterEach(() => {
  vi.unstubAllGlobals()
  resetLlmConcurrency()
})

afterAll(() => {
  vi.unstubAllEnvs()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('isLlmConfigured', () => {
  it('is disabled without configuration', () => {
    saveLlmConfig({ enabled: false, baseUrl: 'https://api.deepseek.com/v1', apiKey: '', model: 'deepseek-chat', timeoutMs: 30000, maxSegments: 30 })
    expect(isLlmConfigured()).toBe(false)
  })

  it('is enabled with a key', () => {
    saveLlmConfig({ enabled: true, baseUrl: 'https://api.deepseek.com/v1', apiKey: 'test-key', model: 'deepseek-chat', timeoutMs: 30000, maxSegments: 30 })
    expect(isLlmConfigured()).toBe(true)
  })
})

describe('judgeSegmentsWithLlm', () => {
  it('returns null when LLM is disabled', async () => {
    saveLlmConfig({ enabled: false, baseUrl: 'https://api.deepseek.com/v1', apiKey: '', model: 'deepseek-chat', timeoutMs: 30000, maxSegments: 30 })
    expect(await judgeSegmentsWithLlm([segment('s-1', '综上所述，这是结论。')])).toBeNull()
  })

  it('applies the LLM judgement labels and reasons back to segments', async () => {
    saveLlmConfig({ enabled: true, baseUrl: 'https://api.deepseek.com/v1', apiKey: 'test-key', model: 'deepseek-chat', timeoutMs: 30000, maxSegments: 30 })
    vi.mocked(llmFetch).mockResolvedValue(({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify([
              { id: 's-1', label: 'human', confidence: 0.8, reasons: ['这段是具体叙事'], suggestions: [] },
              { id: 's-2', label: 'ai', confidence: 0.9, reasons: ['总结套话'], suggestions: ['改结论'] },
            ]),
          },
        }],
      }),
    }) as unknown as Response)

    const result = await judgeSegmentsWithLlm([
      segment('s-1', '周三我去图书馆还书。'),
      segment('s-2', '综上所述，这是结论。'),
    ])

    expect(result?.get('s-1')?.label).toBe('human')
    expect(result?.get('s-2')?.label).toBe('ai')
    expect(result?.get('s-2')?.suggestions).toEqual(['改结论'])
  })

  it('sends the configured base URL and model in the request', async () => {
    saveLlmConfig({ enabled: true, baseUrl: 'https://example.com/v1/', apiKey: 'k', model: 'custom-model', timeoutMs: 30000, maxSegments: 30 })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '[]' } }] }),
    })
    vi.mocked(llmFetch).mockImplementation(fetchMock)

    await judgeSegmentsWithLlm([segment('s-1', '文本')])

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.com/v1/chat/completions')
    const body = JSON.parse(init.body as string)
    expect(body.model).toBe('custom-model')
    expect(init.headers.authorization).toBe('Bearer k')
  })

  it('returns null when the API fails', async () => {
    saveLlmConfig({ enabled: true, baseUrl: 'https://api.deepseek.com/v1', apiKey: 'k', model: 'deepseek-chat', timeoutMs: 30000, maxSegments: 30 })
    vi.mocked(llmFetch).mockRejectedValue(new Error('network down'))

    expect(await judgeSegmentsWithLlm([segment('s-1', '文本')])).toBeNull()
  })

  it('returns null when the response is not valid JSON', async () => {
    saveLlmConfig({ enabled: true, baseUrl: 'https://api.deepseek.com/v1', apiKey: 'k', model: 'deepseek-chat', timeoutMs: 30000, maxSegments: 30 })
    vi.mocked(llmFetch).mockResolvedValue(({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'not json' } }] }),
    }) as unknown as Response)

    expect(await judgeSegmentsWithLlm([segment('s-1', '文本')])).toBeNull()
  })

  it('returns null when there are no segments', async () => {
    saveLlmConfig({ enabled: true, baseUrl: 'https://api.deepseek.com/v1', apiKey: 'k', model: 'deepseek-chat', timeoutMs: 30000, maxSegments: 30 })
    expect(await judgeSegmentsWithLlm([])).toBeNull()
  })

  it('runs chunks concurrently while staying within the concurrency budget', async () => {
    saveLlmConfig({ enabled: true, baseUrl: 'https://api.deepseek.com/v1', apiKey: 'k', model: 'deepseek-chat', timeoutMs: 30000, maxSegments: 30 })

    let active = 0
    let peak = 0
    vi.mocked(llmFetch).mockImplementation((async () => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 40))
      active -= 1
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: '[{"id":"s-0","label":"human","confidence":0.7,"reasons":["r"],"suggestions":[]}]' } }] }),
      } as unknown as Response
    }) as never)

    const segments = Array.from({ length: 18 }, (_, index) => segment(`s-${index}`, `第 ${index} 个片段用于并发测试。`))
    await judgeSegmentsWithLlm(segments)

    expect(peak).toBeLessThanOrEqual(5)
    expect(peak).toBeGreaterThanOrEqual(2)
  })
})
