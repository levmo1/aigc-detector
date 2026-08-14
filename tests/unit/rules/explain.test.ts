import { describe, expect, it } from 'vitest'
import type { TextSegment } from '@/lib/domain/segments'
import { createRuleEngine } from '@/lib/rules/engine'
import { builtinFeatures } from '@/lib/rules/features'
import { explainHits, explainNoHits, buildSuggestions } from '@/lib/rules/explain'
import type { SegmentEvaluation } from '@/lib/rules/engine'

const segment = (text: string): TextSegment => ({
  id: 's-1',
  text,
  start: 0,
  end: text.length,
  paragraphIndex: 0,
  scored: true,
})

const engine = createRuleEngine({
  groups: [
    {
      id: 'summary-catchphrase',
      name: '总结套话',
      weight: 3,
      rules: [{ pattern: '综上所述', weight: 3, note: '总结套话' }],
    },
    {
      id: 'connectors',
      name: '高频连接词',
      weight: 2,
      rules: [{ pattern: '然而', weight: 1, note: 'AI 高频转折' }],
    },
  ],
  features: builtinFeatures,
})

describe('explainHits', () => {
  it('explains rule hits in plain language with the matched phrase', () => {
    const evaluation = engine.evaluate([segment('综上所述，这是结论。')])[0]
    const reasons = explainHits(evaluation)

    expect(reasons[0]).toContain('综上所述')
    expect(reasons[0]).toContain('总结')
  })

  it('explains statistical features in plain language', () => {
    const texts = [
      '该研究突破了传统范式。',
      '该研究填补了理论空白。',
      '该研究创新了分析视角。',
    ]
    const evaluation = engine.evaluate(texts.map((text, index) => ({ ...segment(text), id: `s-${index}` })))[0]
    const reasons = explainHits(evaluation)

    expect(reasons.some((reason) => reason.includes('句子'))).toBe(true)
  })

  it('mentions the specific matched words', () => {
    const evaluation = engine.evaluate([segment('然而，与此同时，此外，因此，总的来说，综上所述。')])[0]
    const reasons = explainHits(evaluation)

    expect(reasons.join(' ')).toContain('然而')
    expect(reasons.join(' ')).toContain('综上所述')
  })
})

describe('explainNoHits', () => {
  it('states the reason for human tendency without jargon', () => {
    expect(explainNoHits()).toMatch(/未发现|人工/i)
  })
})

describe('buildSuggestions', () => {
  it('returns actionable plain-language suggestions for the group', () => {
    const evaluation = engine.evaluate([segment('综上所述，这是结论。')])[0]
    const suggestions = buildSuggestions(evaluation)

    expect(suggestions.length).toBeGreaterThanOrEqual(2)
    expect(suggestions[0].length).toBeGreaterThan(10)
  })

  it('provides a generic suggestion when nothing matched', () => {
    const evaluation: SegmentEvaluation = {
      segment: segment('这是一句普通的话。'),
      score: 0,
      hits: [],
      featureScores: {},
    }
    const suggestions = buildSuggestions(evaluation)

    expect(suggestions.length).toBeGreaterThan(0)
  })
})
