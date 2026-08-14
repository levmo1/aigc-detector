import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import type { RuleGroup, RulePattern } from './engine'

export const rulePatternSchema = z.object({
  pattern: z.string().min(1).max(200),
  weight: z.number().int().min(1).max(10),
  note: z.string().max(200).optional(),
})

export const ruleGroupSchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().min(1).max(60),
  weight: z.number().int().min(1).max(10),
  rules: z.array(rulePatternSchema).max(500),
})

export const ruleLibrarySchema = z.object({
  version: z.number().int().optional(),
  description: z.string().optional(),
  thresholds: z.object({
    segmentAIScore: z.number().int().min(1).max(20),
    segmentUncertainScore: z.number().int().min(0).max(10),
  }).optional(),
  groups: z.array(ruleGroupSchema).max(50),
})

export type RuleLibrary = z.infer<typeof ruleLibrarySchema>

function ruleFilePaths(): { defaults: string; user: string } {
  const userDirectory = process.env.RULES_DIR ?? path.join(process.cwd(), 'rules')
  return {
    defaults: path.join(process.cwd(), 'rules', 'ai-writing-rules.json'),
    user: path.join(userDirectory, 'user-rules.json'),
  }
}

let cachedLibrary: RuleLibrary | null = null

export function loadRuleLibrary(): RuleLibrary {
  if (cachedLibrary) return cachedLibrary

  const { defaults, user } = ruleFilePaths()
  const defaultLibrary = readRuleFile(defaults)
  const userGroups = readUserGroups(user)
  const merged: RuleLibrary = {
    ...defaultLibrary,
    groups: mergeGroups(defaultLibrary.groups, userGroups),
  }

  cachedLibrary = merged
  return merged
}

export function resetRuleLibraryCache(): void {
  cachedLibrary = null
}

export function saveUserRuleGroups(groups: RuleGroup[]): RuleLibrary {
  const parsed = z.array(ruleGroupSchema).parse(groups)
  const { user } = ruleFilePaths()
  writeFileSync(user, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')
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

function readUserGroups(userFilePath: string): RuleGroup[] {
  try {
    const raw = readFileSync(userFilePath, 'utf8')
    return z.array(ruleGroupSchema).parse(JSON.parse(raw))
  } catch {
    return []
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
