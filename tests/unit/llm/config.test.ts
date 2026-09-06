// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defaultLlmConfig, loadLlmConfig, saveLlmConfig } from '@/lib/llm/config'

let directory: string
beforeEach(() => {
  directory = mkdtempSync(path.join(os.tmpdir(), 'aigc-key-migration-'))
  vi.stubEnv('CONFIG_DIR', directory)
  vi.stubEnv('XDG_DATA_HOME', directory)
  writeFileSync(path.join(directory, 'llm-config.json'), JSON.stringify({
    ...defaultLlmConfig, presetId: 'custom-fixture', apiKey: 'fixture-only-key',
    customPresets: [{ id: 'custom-fixture', name: 'fixture', baseUrl: 'http://localhost:1234' }],
  }))
})
afterEach(() => { vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }) })
it('migrates a legacy key when only other settings are saved', () => {
  saveLlmConfig({ ...loadLlmConfig(), apiKey: '', timeoutMs: 2000 })
  expect(loadLlmConfig().apiKey).toBe('fixture-only-key')
  const stored = JSON.parse(readFileSync(path.join(directory, 'llm-config.json'), 'utf8'))
  expect(stored.apiKey).toBeUndefined()
  expect(stored.apiKeys['custom-fixture']).toBe('fixture-only-key')
})
it('still clears a legacy key when explicitly requested', () => {
  saveLlmConfig({ ...loadLlmConfig(), apiKey: '' }, { resetApiKey: true })
  expect(loadLlmConfig().apiKey).toBe('')
})
it('preserves the old provider key when switching providers', () => {
  saveLlmConfig({ ...loadLlmConfig(), presetId: 'deepseek', baseUrl: defaultLlmConfig.baseUrl, apiKey: '' })
  const stored = JSON.parse(readFileSync(path.join(directory, 'llm-config.json'), 'utf8'))
  expect(stored.apiKeys['custom-fixture']).toBe('fixture-only-key')
  expect(stored.apiKeys.deepseek).toBeUndefined()
})
