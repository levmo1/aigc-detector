import { countScoredCharacters, type DetectedSegment } from './segments'
import type { DetectorMode } from '@/lib/detection/types'

export interface DetectionSummary {
  aiRate: number
  humanRate: number
  uncertainRate: number
  scoredCharacters: number
}

export interface DetectionReport {
  id: string
  mode: DetectorMode
  sourceName: string
  sourceType: 'text' | 'docx' | 'pdf'
  text: string
  segments: DetectedSegment[]
  summary: DetectionSummary
  warnings: string[]
  generatedAt: string
}

export function buildSummary(segments: readonly DetectedSegment[]): DetectionSummary {
  const characterCounts = {
    ai: 0,
    human: 0,
    uncertain: 0,
  }

  for (const segment of segments) {
    if (segment.scored === false) continue
    characterCounts[segment.label] += countScoredCharacters(segment.text)
  }

  const scoredCharacters = characterCounts.ai + characterCounts.human + characterCounts.uncertain

  if (scoredCharacters === 0) {
    return {
      aiRate: 0,
      humanRate: 0,
      uncertainRate: 100,
      scoredCharacters: 0,
    }
  }

  const exactRates = {
    ai: (characterCounts.ai / scoredCharacters) * 100,
    human: (characterCounts.human / scoredCharacters) * 100,
    uncertain: (characterCounts.uncertain / scoredCharacters) * 100,
  }
  const rates = {
    ai: Math.floor(exactRates.ai),
    human: Math.floor(exactRates.human),
    uncertain: Math.floor(exactRates.uncertain),
  }
  let remaining = 100 - rates.ai - rates.human - rates.uncertain

  for (const label of (Object.keys(exactRates) as Array<keyof typeof exactRates>).sort(
    (left, right) => (exactRates[right] % 1) - (exactRates[left] % 1),
  )) {
    if (remaining === 0) break
    rates[label] += 1
    remaining -= 1
  }

  return {
    aiRate: rates.ai,
    humanRate: rates.human,
    uncertainRate: rates.uncertain,
    scoredCharacters,
  }
}

export function buildReport(input: {
  id: string
  mode: DetectionReport['mode']
  sourceName: string
  sourceType: DetectionReport['sourceType']
  text: string
  segments: DetectedSegment[]
  warnings?: string[]
}): DetectionReport {
  return {
    ...input,
    summary: buildSummary(input.segments),
    warnings: input.warnings ?? [],
    generatedAt: new Date().toISOString(),
  }
}
