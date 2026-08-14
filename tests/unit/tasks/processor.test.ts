import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const tempData = mkdtempSync(path.join(tmpdir(), 'aigc-persist-'))

beforeAll(() => {
  vi.stubEnv('DATA_DIR', tempData)
})

afterAll(() => {
  vi.unstubAllEnvs()
  rmSync(tempData, { recursive: true, force: true })
})
import { processDetectionTask } from '@/lib/tasks/processor'
import { createTask, getTask } from '@/lib/tasks/store'

vi.mock('@/lib/llm/config', () => ({
  loadLlmConfig: () => ({ enabled: false, apiKey: '', presetId: 'deepseek', baseUrl: '', model: '', timeoutMs: 30000, maxSegments: 15 }),
}))

describe('processDetectionTask', () => {
  it('processes text into a report and clears the raw input', async () => {
    const task = createTask({
      kind: 'text',
      text: '这是一段用于验证检测任务完整流程的中文正文。'.repeat(20),
      sourceName: '演示论文',
      warnings: [],
    })

    await processDetectionTask(task.id)

    const completed = getTask(task.id)
    expect(completed?.status).toBe('ready')
    expect(completed?.input).toBeUndefined()
    expect(completed?.report?.mode).toBe('rule')
    expect(completed?.report?.segments.length).toBeGreaterThan(0)
  })
})
