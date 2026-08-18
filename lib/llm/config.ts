import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { z } from 'zod'

export interface LlmPreset {
  id: string
  name: string
  baseUrl: string
  model: string
}

export interface CustomLlmPreset {
  id: string
  name: string
  baseUrl: string
}

export const LLM_PRESETS: LlmPreset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
  },
  {
    id: 'opencodego',
    name: 'OpencodeGO',
    baseUrl: 'https://opencode.ai/zen/go/v1',
    model: 'deepseek-v4-flash',
  },
]

const OPENCODE_AUTH_PATH = 'opencode/auth.json'

const presetToProvider: Record<string, string> = {
  deepseek: 'deepseek',
  opencodego: 'opencode-go',
}

export const llmConfigSchema = z.object({
  enabled: z.boolean(),
  // Kept optional for backward compatibility with configs created before the
  // separate second-review switch was introduced.
  secondReviewEnabled: z.boolean().optional(),
  presetId: z.string().optional(),
  baseUrl: z.string().url().max(300),
  apiKey: z.string().max(300).optional(),
  apiKeys: z.record(z.string(), z.string()).optional(),
  customPresets: z.array(z.object({
    id: z.string().regex(/^custom-[a-z0-9-]+$/u).max(80),
    name: z.string().min(1).max(60),
    baseUrl: z.string().url().max(300),
  })).max(20).optional(),
  model: z.string().min(1).max(120),
  timeoutMs: z.number().int().min(1000).max(60_000).default(30_000),
  maxSegments: z.number().int().min(1).max(200).default(6),
})

export type LlmConfig = z.infer<typeof llmConfigSchema>

export type LlmApiKeySource = 'opencode-auth' | 'user' | 'none'

export const customPresetInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  baseUrl: z.string().url().max(300),
})

export const defaultLlmConfig: LlmConfig = {
  enabled: false,
  secondReviewEnabled: false,
  presetId: 'deepseek',
  baseUrl: LLM_PRESETS[0].baseUrl,
  apiKey: '',
  apiKeys: {},
  customPresets: [],
  model: LLM_PRESETS[0].model,
  timeoutMs: 30_000,
  maxSegments: 6,
}

function configPath(): string {
  return path.join(process.env.CONFIG_DIR ?? path.join(process.cwd(), 'config'), 'llm-config.json')
}

function opencodeAuthPath(): string {
  if (process.platform === 'win32') {
    // Windows 上 opencode 把 auth.json 放在 %APPDATA%\opencode
    const appData = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming')
    return path.join(appData, 'opencode', 'auth.json')
  }
  const xdgData = process.env.XDG_DATA_HOME ?? path.join(os.homedir(), '.local', 'share')
  return path.join(xdgData, OPENCODE_AUTH_PATH)
}

function resolveProviderKey(presetId: string | undefined): string {
  if (!presetId) return ''
  const provider = presetToProvider[presetId]
  if (!provider) return ''

  try {
    const raw = readFileSync(opencodeAuthPath(), 'utf8')
    const auth = JSON.parse(raw) as Record<string, { key?: string } | undefined>
    return auth[provider]?.key ?? ''
  } catch {
    return ''
  }
}

function userKeyFor(parsed: LlmConfig, presetId: string | undefined): string {
  const keys = parsed.apiKeys ?? {}
  const id = presetId ?? ''
  if (keys[id]) return keys[id] ?? ''
  return id === parsed.presetId ? parsed.apiKey ?? '' : ''
}

export function llmApiKeySourceFor(config: LlmConfig, presetId: string | undefined): LlmApiKeySource {
  if (resolveProviderKey(presetId)) return 'opencode-auth'
  if (presetId === config.presetId && userKeyFor(config, presetId)) return 'user'
  return 'none'
}

export function llmApiKeySource(config: LlmConfig): LlmApiKeySource {
  return llmApiKeySourceFor(config, config.presetId)
}

export function apiKeyForPreset(config: LlmConfig, presetId: string | undefined): string {
  return resolveProviderKey(presetId) || userKeyFor(config, presetId)
}

export function listLlmPresets(config: LlmConfig = loadLlmConfig()): LlmPreset[] {
  return [
    ...LLM_PRESETS,
    ...(config.customPresets ?? []).map((preset) => ({
      ...preset,
      model: '',
    })),
  ]
}

export function loadLlmConfig(): LlmConfig {
  try {
    const raw = readFileSync(configPath(), 'utf8')
    const parsed = llmConfigSchema.parse(JSON.parse(raw))
    const customPresets = parsed.customPresets ?? []
    const presetExists = !parsed.presetId
      || LLM_PRESETS.some((preset) => preset.id === parsed.presetId)
      || customPresets.some((preset) => preset.id === parsed.presetId)
    const normalized = presetExists
      ? parsed
      : {
          ...parsed,
          presetId: defaultLlmConfig.presetId,
          baseUrl: defaultLlmConfig.baseUrl,
          model: defaultLlmConfig.model,
        }
    return {
      ...normalized,
      customPresets,
      secondReviewEnabled: normalized.secondReviewEnabled ?? false,
      apiKey: apiKeyForPreset(normalized, normalized.presetId),
    }
  } catch {
    return {
      ...defaultLlmConfig,
      secondReviewEnabled: false,
      apiKey: apiKeyForPreset(defaultLlmConfig, defaultLlmConfig.presetId),
    }
  }
}

export function saveLlmConfig(config: LlmConfig, options: { resetApiKey?: boolean } = {}): LlmConfig {
  const parsed = llmConfigSchema.parse(config)
  const presetId = parsed.presetId ?? ''

  let existing: LlmConfig = { ...defaultLlmConfig }
  try {
    const raw = readFileSync(configPath(), 'utf8')
    existing = llmConfigSchema.parse(JSON.parse(raw))
  } catch {
    // 配置文件不存在或损坏时从空开始
  }

  const apiKeys: Record<string, string> = { ...(existing.apiKeys ?? {}) }
  if (options.resetApiKey) {
    delete apiKeys[presetId]
  } else if (parsed.apiKey) {
    apiKeys[presetId] = parsed.apiKey
  }

  const customPresets = parsed.customPresets ?? existing.customPresets ?? []
  const stored = { ...parsed, apiKeys, customPresets, apiKey: undefined }
  mkdirSync(path.dirname(configPath()), { recursive: true })
  writeFileSync(configPath(), `${JSON.stringify(stored, null, 2)}\n`, 'utf8')

  return {
    ...stored,
    secondReviewEnabled: parsed.secondReviewEnabled ?? false,
    apiKey: resolveProviderKey(presetId) || apiKeys[presetId] || '',
  }
}

export function addCustomLlmPreset(input: z.infer<typeof customPresetInputSchema>): LlmPreset {
  const current = loadLlmConfig()
  const customPreset: CustomLlmPreset = {
    id: `custom-${randomUUID()}`,
    name: input.name,
    baseUrl: input.baseUrl,
  }
  const saved = saveLlmConfig({
    ...current,
    apiKey: '',
    customPresets: [...(current.customPresets ?? []), customPreset],
  })
  return listLlmPresets(saved).find((preset) => preset.id === customPreset.id) as LlmPreset
}

export function removeCustomLlmPreset(id: string): LlmConfig {
  const current = loadLlmConfig()
  const isActive = current.presetId === id
  const fallback = LLM_PRESETS[0]
  return saveLlmConfig({
    ...current,
    apiKey: '',
    ...(isActive ? { presetId: fallback.id, baseUrl: fallback.baseUrl, model: fallback.model } : {}),
    customPresets: (current.customPresets ?? []).filter((preset) => preset.id !== id),
  })
}

export function presetById(id: string): LlmPreset | undefined {
  return listLlmPresets().find((preset) => preset.id === id)
}
