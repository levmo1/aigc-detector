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
  {
    id: 'custom',
    name: '自定义方案',
    baseUrl: '',
    model: '',
  },
]

const OPENCODE_AUTH_PATH = 'opencode/auth.json'

const presetToProvider: Record<string, string> = {
  deepseek: 'deepseek',
  opencodego: 'opencode-go',
}

export const llmConfigSchema = z.object({
  enabled: z.boolean(),
  presetId: z.string().optional(),
  baseUrl: z.string().url().max(300),
  apiKey: z.string().max(300).optional(),
  apiKeys: z.record(z.string(), z.string()).optional(),
  model: z.string().min(1).max(120),
  timeoutMs: z.number().int().min(1000).max(60_000).default(30_000),
  maxSegments: z.number().int().min(1).max(200).default(15),
})

export type LlmConfig = z.infer<typeof llmConfigSchema>

export type LlmApiKeySource = 'opencode-auth' | 'user' | 'none'

export const defaultLlmConfig: LlmConfig = {
  enabled: false,
  presetId: 'deepseek',
  baseUrl: LLM_PRESETS[0].baseUrl,
  apiKey: '',
  apiKeys: {},
  model: LLM_PRESETS[0].model,
  timeoutMs: 30_000,
  maxSegments: 15,
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
  return parsed.apiKey ?? ''
}

export function llmApiKeySourceFor(config: LlmConfig, presetId: string | undefined): LlmApiKeySource {
  if (resolveProviderKey(presetId)) return 'opencode-auth'
  if (presetId === config.presetId && userKeyFor(config, presetId)) return 'user'
  return 'none'
}

export function llmApiKeySource(config: LlmConfig): LlmApiKeySource {
  return llmApiKeySourceFor(config, config.presetId)
}

export function loadLlmConfig(): LlmConfig {
  try {
    const raw = readFileSync(configPath(), 'utf8')
    const parsed = llmConfigSchema.parse(JSON.parse(raw))
    return {
      ...parsed,
      apiKey: resolveProviderKey(parsed.presetId) || userKeyFor(parsed, parsed.presetId),
    }
  } catch {
    return {
      ...defaultLlmConfig,
      apiKey: resolveProviderKey(defaultLlmConfig.presetId) || '',
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

  const stored = { ...parsed, apiKeys, apiKey: undefined }
  mkdirSync(path.dirname(configPath()), { recursive: true })
  writeFileSync(configPath(), `${JSON.stringify(stored, null, 2)}\n`, 'utf8')

  return {
    ...stored,
    apiKey: resolveProviderKey(presetId) || apiKeys[presetId] || '',
  }
}

export function presetById(id: string): LlmPreset | undefined {
  return LLM_PRESETS.find((preset) => preset.id === id)
}
