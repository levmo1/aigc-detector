import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { judgeReportWithLlm } from '@/lib/llm/enhance'

vi.mock('@/lib/llm/http', () => ({
  llmFetch: vi.fn(),
}))
import { saveLlmConfig } from '@/lib/llm/config'
import { llmFetch } from '@/lib/llm/http'
import type { DetectionReport } from '@/lib/domain/report'

const tempDir = mkdtempSync(path.join(tmpdir(), 'aigc-llm-enhance-'))

const report: DetectionReport = {
  id: 'det_1',
  mode: 'rule',
  sourceName: '测试论文',
  sourceType: 'text',
  text: '综上所述，这是结论。',
  segments: [
    {
      id: 's-1',
      text: '综上所述，这是结论。',
      start: 0,
      end: 10,
      paragraphIndex: 0,
      label: 'ai',
      confidence: 0.9,
      reasons: ['本地原因'],
      suggestions: ['本地建议'],
      scored: true,
    },
  ],
  summary: { aiRate: 100, humanRate: 0, uncertainRate: 0, scoredCharacters: 10 },
  warnings: [],
  generatedAt: '2026-08-12T00:00:00.000Z',
}

beforeAll(() => {
  vi.stubEnv('CONFIG_DIR', tempDir)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

afterAll(() => {
  vi.unstubAllEnvs()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('judgeReportWithLlm', () => {
  it('leaves the report unchanged when LLM is disabled', async () => {
    saveLlmConfig({ enabled: false, baseUrl: 'https://api.deepseek.com/v1', apiKey: '', model: 'deepseek-chat', timeoutMs: 30000, maxSegments: 30 })
    const result = await judgeReportWithLlm(report)

    expect(result).toBe(report)
  })

  it('replaces the judgement for segments when the LLM responds', async () => {
    saveLlmConfig({ enabled: true, baseUrl: 'https://api.deepseek.com/v1', apiKey: 'k', model: 'deepseek-chat', timeoutMs: 30000, maxSegments: 30 })
    vi.mocked(llmFetch).mockResolvedValue(({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify([
              { id: 's-1', label: 'human', confidence: 0.85, reasons: ['这是具体叙述'], suggestions: [] },
            ]),
          },
        }],
      }),
    }) as unknown as Response)

    const result = await judgeReportWithLlm(report)

    expect(result.segments[0].label).toBe('human')
    expect(result.segments[0].confidence).toBe(0.85)
    expect(result.segments[0].reasons).toEqual(['这是具体叙述'])
  })

  it('keeps the rule judgement when the LLM call fails', async () => {
    saveLlmConfig({ enabled: true, baseUrl: 'https://api.deepseek.com/v1', apiKey: 'k', model: 'deepseek-chat', timeoutMs: 30000, maxSegments: 15 })
    vi.mocked(llmFetch).mockRejectedValue(new Error('down'))

    const result = await judgeReportWithLlm(report)

    expect(result.segments[0].label).toBe('ai')
    expect(result.segments[0].reasons).toEqual(['本地原因'])
  })

  it('keeps the rule judgement when the LLM gives a label without reasons', async () => {
    saveLlmConfig({ enabled: true, baseUrl: 'https://api.deepseek.com/v1', apiKey: 'k', model: 'deepseek-chat', timeoutMs: 30000, maxSegments: 15 })
    vi.mocked(llmFetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify([
              { id: 's-1', label: 'human', confidence: 0.9, reasons: [], suggestions: [] },
            ]),
          },
        }],
      }),
    } as unknown as Response)

    const result = await judgeReportWithLlm(report)

    expect(result.segments[0].label).toBe('ai')
    expect(result.segments[0].reasons).toEqual(['本地原因'])
  })
})
