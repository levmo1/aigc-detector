import { readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const presetToProvider: Record<string, string> = {
  deepseek: 'deepseek',
  opencodego: 'opencode-go',
}

interface OpenCodeModelsFile {
  [providerId: string]: {
    models?: Record<string, { name?: string }>
  }
}

function opencodeModelsPath(): string {
  if (process.platform === 'win32') {
    // Windows 上 opencode 把 models.json 放在 %LOCALAPPDATA%\opencode
    const localAppData = process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local')
    return path.join(localAppData, 'opencode', 'models.json')
  }
  const cacheHome = process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), '.cache')
  return path.join(cacheHome, 'opencode', 'models.json')
}

export function getModelsForPreset(presetId: string): Array<{ id: string; name: string }> {
  const provider = presetToProvider[presetId]
  if (!provider) return []

  try {
    const raw = readFileSync(opencodeModelsPath(), 'utf8')
    const data = JSON.parse(raw) as OpenCodeModelsFile
    const providerData = data[provider]
    if (!providerData?.models) return []

    return Object.entries(providerData.models).map(([id, meta]) => ({
      id,
      name: meta?.name ?? id,
    }))
  } catch {
    return []
  }
}
