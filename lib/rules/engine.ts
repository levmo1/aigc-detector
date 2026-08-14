import type { DetectedSegment, SegmentLabel, TextSegment } from '@/lib/domain/segments'

export interface RulePattern {
  pattern: string
  weight: number
  note?: string
}

export interface RuleGroup {
  id: string
  name: string
  weight: number
  rules: RulePattern[]
}

export interface BuiltinFeature {
  weight: number
  note?: string
  score(segment: TextSegment, segments: TextSegment[]): number
}

export interface RuleEngineInput {
  groups: RuleGroup[]
  thresholds?: {
    segmentAIScore: number
    segmentUncertainScore: number
  }
  features?: Record<string, BuiltinFeature>
  suggestions?: Record<string, { note: string; pattern?: string }>
}

export interface RuleHit {
  groupId: string
  groupName: string
  rule: RulePattern
  matches: string[]
}

export interface SegmentEvaluation {
  segment: TextSegment
  score: number
  hits: RuleHit[]
  featureScores: Record<string, number>
}

interface CompiledRule extends RulePattern {
  regex?: RegExp
}

interface CompiledGroup {
  id: string
  name: string
  weight: number
  rules: CompiledRule[]
}

const defaultThresholds = {
  segmentAIScore: 3,
  segmentUncertainScore: 1,
}

const regexHint = /[\\[\]{}()*+?^$|.\\-]/u

export function createRuleEngine(input: RuleEngineInput) {
  const thresholds = { ...defaultThresholds, ...input.thresholds }
  const groups: CompiledGroup[] = input.groups.map((group) => ({
    id: group.id,
    name: group.name,
    weight: group.weight,
    rules: group.rules.map(compileRule),
  }))
  const features = input.features ?? {}

  function evaluate(segments: TextSegment[]): SegmentEvaluation[] {
    return segments.map((segment) => {
      const hits: RuleHit[] = []
      let score = 0

      for (const group of groups) {
        for (const rule of group.rules) {
          const matches = matchRule(rule, segment.text)
          if (matches.length === 0) continue

          score += group.weight * rule.weight * matches.length
          hits.push({
            groupId: group.id,
            groupName: group.name,
            rule,
            matches,
          })
        }
      }

      const featureScores: Record<string, number> = {}
      for (const [name, feature] of Object.entries(features)) {
        const featureScore = feature.score(segment, segments)
        featureScores[name] = featureScore
        if (featureScore > 0) score += feature.weight * featureScore
      }

      return { segment, score, hits, featureScores }
    })
  }

  function classify(score: number): SegmentLabel {
    if (score >= thresholds.segmentAIScore) return 'ai'
    if (score >= thresholds.segmentUncertainScore) return 'uncertain'
    return 'human'
  }

  function toReportSegments(evaluations: SegmentEvaluation[]): DetectedSegment[] {
    return evaluations.map((evaluation) => {
      const label = classify(evaluation.score)
      const confidence = confidenceFor(label, evaluation.score)
      const reasons = buildReasons(evaluation, features)
      const suggestions = buildSuggestions(evaluation)

      return {
        ...evaluation.segment,
        label,
        confidence,
        reasons,
        suggestions,
      }
    })
  }

  function buildReasons(evaluation: SegmentEvaluation, featureMap: Record<string, BuiltinFeature>): string[] {
    const reasons: string[] = []
    for (const hit of evaluation.hits) {
      reasons.push(`命中「${hit.groupName}」规则（${hit.rule.pattern}）`)
    }
    for (const [name, value] of Object.entries(evaluation.featureScores)) {
      if (value > 0) {
        const weighted = value * (featureMap[name]?.weight ?? 1)
        reasons.push(`统计特征「${name}」加权分 ${weighted}`)
      }
    }
    return reasons.length > 0 ? reasons : ['未命中任何疑似 AI 写作特征']
  }

  function buildSuggestions(evaluation: SegmentEvaluation): string[] {
    const suggestions = new Set<string>()
    const configured = input.suggestions ?? {}

    for (const hit of evaluation.hits) {
      const groupSuggestion = configured[hit.groupId]
      if (groupSuggestion && (!groupSuggestion.pattern || groupSuggestion.pattern === hit.rule.pattern)) {
        suggestions.add(groupSuggestion.note)
      }
    }

    if (suggestions.size === 0) {
      suggestions.add('结合上下文重新判断；若确有把握，可补充具体论据或数据。')
    }

    return [...suggestions]
  }

  return { evaluate, classify, toReportSegments, thresholds }
}

function compileRule(rule: RulePattern): CompiledRule {
  if (!regexHint.test(rule.pattern)) {
    return { ...rule }
  }

  try {
    if (!isSafeRegexPattern(rule.pattern)) {
      return { ...rule }
    }
    return { ...rule, regex: new RegExp(rule.pattern, 'gu') }
  } catch {
    return { ...rule }
  }
}

export function validateRegexPattern(pattern: string): string | null {
  if (pattern.length > 120) return '正则过长（最多 120 字符）。'
  if (!isSafeRegexPattern(pattern)) return '正则包含可能导致卡死的嵌套量词，请简化。'

  try {
    new RegExp(pattern, 'gu')
  } catch {
    return '正则无法编译，请检查语法。'
  }

  return null
}

function isSafeRegexPattern(pattern: string): boolean {
  const quantifierCount = (pattern.match(/[*+?]|\{(?:\d+,?\d*)?\}/gu) ?? []).length
  if (quantifierCount > 6) return false

  const nestedQuantifier = /\([^()]*[+*][^()]*\)\s*[+*{]/u.test(pattern)
  const alternationQuantifier = /\([^()]*\|[^()]*\)\s*[+*{]/u.test(pattern)
  const adjacentQuantifier = /[*+][?*{]|\{\d+,\d*\}\s*[*+{]/u.test(pattern)
  return !nestedQuantifier && !alternationQuantifier && !adjacentQuantifier
}

function matchRule(rule: CompiledRule, text: string): string[] {
  if (rule.regex) {
    const matches: string[] = []
    let cursor = 0
    let guard = 0
    rule.regex.lastIndex = 0

    while (cursor < text.length && guard < 200) {
      const match = rule.regex.exec(text)
      if (!match) break
      if (match[0]) matches.push(match[0])
      if (rule.regex.lastIndex === cursor) rule.regex.lastIndex = cursor + 1
      cursor = rule.regex.lastIndex
      guard += 1
    }

    return matches
  }

  const occurrences: string[] = []
  let index = text.indexOf(rule.pattern)
  while (index >= 0 && occurrences.length < 200) {
    occurrences.push(rule.pattern)
    index = text.indexOf(rule.pattern, index + rule.pattern.length)
  }
  return occurrences
}

function confidenceFor(label: SegmentLabel, score: number): number {
  if (label === 'ai') return Math.min(0.95, 0.7 + score / 30)
  if (label === 'human') return Math.min(0.95, 0.75 - score / 30)
  return 0.5 + (Math.min(Math.abs(score), 2) / 2) * 0.2
}
