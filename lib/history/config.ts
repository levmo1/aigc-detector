import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

export const historyConfigSchema = z.object({
  maxCount: z.number().int().min(1).max(500),
})

export type HistoryConfig = z.infer<typeof historyConfigSchema>

export const defaultHistoryConfig: HistoryConfig = { maxCount: 50 }

function configPath(): string {
  return path.join(process.env.CONFIG_DIR ?? path.join(process.cwd(), 'config'), 'history-config.json')
}

export function loadHistoryConfig(): HistoryConfig {
  try {
    const raw = readFileSync(configPath(), 'utf8')
    return historyConfigSchema.parse(JSON.parse(raw))
  } catch {
    return { ...defaultHistoryConfig }
  }
}

export function saveHistoryConfig(config: HistoryConfig): HistoryConfig {
  const parsed = historyConfigSchema.parse(config)
  mkdirSync(path.dirname(configPath()), { recursive: true })
  writeFileSync(configPath(), `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')
  return parsed
}
