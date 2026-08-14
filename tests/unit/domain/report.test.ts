import { describe, expect, it } from 'vitest'
import type { DetectedSegment } from '@/lib/domain/segments'
import { buildSummary } from '@/lib/domain/report'

const segment = (label: DetectedSegment['label'], text: string): DetectedSegment => ({
  id: `${label}-${text}`,
  text,
  start: 0,
  end: text.length,
  paragraphIndex: 0,
  label,
  confidence: 0.8,
  reasons: [],
  suggestions: [],
})

describe('buildSummary', () => {
  it('weights the three rates by non-whitespace characters', () => {
    const summary = buildSummary([
      segment('ai', 'AI 片段'),
      segment('human', '人工'),
      segment('uncertain', '待判断'),
    ])

    expect(summary.scoredCharacters).toBe(9)
    expect(summary.aiRate + summary.humanRate + summary.uncertainRate).toBe(100)
    expect(summary.aiRate).toBe(45)
    expect(summary.humanRate).toBe(22)
    expect(summary.uncertainRate).toBe(33)
  })

  it('keeps rounded rates non-negative and summing to 100', () => {
    const summary = buildSummary([
      segment('ai', 'a'.repeat(101)),
      segment('human', 'b'.repeat(99)),
    ])

    expect(summary.aiRate).toBeGreaterThanOrEqual(0)
    expect(summary.humanRate).toBeGreaterThanOrEqual(0)
    expect(summary.uncertainRate).toBeGreaterThanOrEqual(0)
    expect(summary.aiRate + summary.humanRate + summary.uncertainRate).toBe(100)
  })

  it('returns zero rates when no scored characters exist', () => {
    expect(buildSummary([])).toEqual({
      aiRate: 0,
      humanRate: 0,
      uncertainRate: 100,
      scoredCharacters: 0,
    })
  })
})
