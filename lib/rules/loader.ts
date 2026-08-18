import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import type { RuleGroup, RulePattern } from './engine'

export const rulePatternSchema = z.object({
  pattern: z.string().min(1).max(200),
  weight: z.number().int().min(1).max(10),
  maxMatches: z.number().int().min(1).max(20).optional(),
  excludes: z.array(z.string().min(1).max(80)).max(10).optional(),
  note: z.string().max(200).optional(),
})

export const ruleGroupSchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().min(1).max(60),
  weight: z.number().int().min(1).max(10),
  maxContribution: z.number().int().min(1).max(30).optional(),
  rules: z.array(rulePatternSchema).max(500),
})

export const ruleThresholdSchema = z.object({
  segmentAIScore: z.number().int().min(1).max(20),
  segmentUncertainScore: z.number().int().min(0).max(10),
  minimumAIRuleGroups: z.number().int().min(2).max(10).optional(),
})

export const ruleLibrarySchema = z.object({
  version: z.number().int().optional(),
  revision: z.number().int().min(0).optional(),
  description: z.string().optional(),
  thresholds: ruleThresholdSchema.optional(),
  groups: z.array(ruleGroupSchema).max(50),
})

export type RuleLibrary = z.infer<typeof ruleLibrarySchema>

function ruleFilePaths(): { defaults: string; user: string; backup: string } {
  const userDirectory = process.env.RULES_DIR ?? path.join(process.cwd(), 'rules')
  const user = path.join(userDirectory, 'user-rules.json')
  return {
    defaults: path.join(process.cwd(), 'rules', 'ai-writing-rules.json'),
    user,
    backup: `${user}.bak`,
  }
}

let cachedLibrary: RuleLibrary | null = null

const userRuleFileSchema = z.object({
  revision: z.number().int().min(0).default(0),
  thresholds: ruleThresholdSchema.optional(),
  groups: z.array(ruleGroupSchema).max(50),
})

export function loadRuleLibrary(): RuleLibrary {
  if (cachedLibrary) return cachedLibrary

  const { defaults, user } = ruleFilePaths()
  const defaultLibrary = readRuleFile(defaults)
  const userOverrides = readUserOverrides(user)
  const defaultThresholds = defaultLibrary.thresholds ?? {
    segmentAIScore: 3,
    segmentUncertainScore: 1,
    minimumAIRuleGroups: 2,
  }
  const merged: RuleLibrary = {
    ...defaultLibrary,
    revision: userOverrides.revision,
    thresholds: { ...defaultThresholds, ...userOverrides.thresholds },
    groups: mergeGroups(defaultLibrary.groups, userOverrides.groups),
  }

  cachedLibrary = merged
  return merged
}

export function resetRuleLibraryCache(): void {
  cachedLibrary = null
}

export function saveUserRuleGroups(
  groups: RuleGroup[],
  thresholds?: z.infer<typeof ruleThresholdSchema>,
): RuleLibrary {
  const parsed = z.array(ruleGroupSchema).parse(groups)
  const { user, backup } = ruleFilePaths()
  const previous = readUserOverrides(user)
  if (existsSync(user)) copyFileSync(user, backup)
  const currentThresholds = thresholds ?? loadRuleLibrary().thresholds ?? {
    segmentAIScore: 3,
    segmentUncertainScore: 1,
    minimumAIRuleGroups: 2,
  }
  const payload = {
    revision: previous.revision + 1,
    thresholds: ruleThresholdSchema.parse(currentThresholds),
    groups: parsed,
  }
  mkdirSync(path.dirname(user), { recursive: true })
  writeFileSync(user, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  cachedLibrary = null
  return loadRuleLibrary()
}

export function rollbackUserRuleGroups(): RuleLibrary {
  const { user, backup } = ruleFilePaths()
  if (!existsSync(backup)) return loadRuleLibrary()

  const swap = `${user}.swap`
  if (existsSync(user)) copyFileSync(user, swap)
  copyFileSync(backup, user)
  if (existsSync(swap)) {
    copyFileSync(swap, backup)
    rmSync(swap, { force: true })
  }
  cachedLibrary = null
  return loadRuleLibrary()
}

function readRuleFile(filePath: string): RuleLibrary {
  try {
    const raw = readFileSync(filePath, 'utf8')
    return ruleLibrarySchema.parse(JSON.parse(raw))
  } catch (error) {
    throw new Error(`规则库文件 ${filePath} 无法解析：${error instanceof Error ? error.message : String(error)}`)
  }
}

function readUserOverrides(userFilePath: string): {
  revision: number
  groups: RuleGroup[]
  thresholds?: z.infer<typeof ruleThresholdSchema>
} {
  try {
    const raw = readFileSync(userFilePath, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return { revision: 0, groups: z.array(ruleGroupSchema).parse(parsed) }
    }
    return userRuleFileSchema.parse(parsed)
  } catch {
    return { revision: 0, groups: [] }
  }
}

function mergeGroups(defaults: RuleGroup[], userGroups: RuleGroup[]): RuleGroup[] {
  const merged = new Map<string, RuleGroup>()

  for (const group of defaults) merged.set(group.id, { ...group, rules: [...group.rules] })
  for (const group of userGroups) {
    const existing = merged.get(group.id)
    if (existing) {
      merged.set(group.id, { ...group, rules: group.rules })
    } else {
      merged.set(group.id, { ...group, rules: [...group.rules] })
    }
  }

  return [...merged.values()]
}
