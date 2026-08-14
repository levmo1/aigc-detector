import { describe, expect, it } from 'vitest'
import type { DetectedSegment } from '@/lib/domain/segments'
import { createRuleEngine, validateRegexPattern, type RuleEngineInput } from '@/lib/rules/engine'

const segment = (text: string, index = 0): DetectedSegment => ({
  id: `s-${index}`,
  text,
  start: 0,
  end: text.length,
  paragraphIndex: index,
  label: 'ai',
  confidence: 0.5,
  reasons: [],
  suggestions: [],
})

const minimalRules: RuleEngineInput = {
  groups: [
    {
      id: 'summary',
      name: '总结套话',
      weight: 3,
      rules: [
        { pattern: '综上所述', weight: 3, note: '总结套话' },
        { pattern: '综上所述，本研究', weight: 4, note: '论文结尾模板' },
      ],
    },
    {
      id: 'pattern-rule',
      name: '编号逻辑',
      weight: 3,
      rules: [
        { pattern: '首先.{0,20}其次.{0,20}再次', weight: 3, note: '三段论' },
      ],
    },
  ],
  features: {},
}

describe('rule engine', () => {
  it('scores keyword hits with rule weight', () => {
    const engine = createRuleEngine(minimalRules)
    const result = engine.evaluate([segment('综上所述，本文的结论是明确的。')])

    expect(result[0].hits.length).toBeGreaterThan(0)
    expect(result[0].hits.some((hit) => hit.rule.pattern === '综上所述')).toBe(true)
    expect(result[0].score).toBeGreaterThanOrEqual(3)
  })

  it('gives more weight to longer pattern hits', () => {
    const engine = createRuleEngine(minimalRules)
    const plain = engine.evaluate([segment('综上所述，这是一个结论。')])
    const template = engine.evaluate([segment('综上所述，本研究具有重要的理论意义。')])

    expect(template[0].score).toBeGreaterThan(plain[0].score)
  })

  it('matches regex patterns across the sentence', () => {
    const engine = createRuleEngine(minimalRules)
    const result = engine.evaluate([segment('首先，数据覆盖有限；其次，标注成本较高；再次，偏差未解决。')])

    expect(result[0].hits.some((hit) => hit.rule.pattern === '首先.{0,20}其次.{0,20}再次')).toBe(true)
  })

  it('classifies by score thresholds', () => {
    const engine = createRuleEngine({ ...minimalRules, thresholds: { segmentAIScore: 3, segmentUncertainScore: 1 } })

    expect(engine.classify(6)).toBe('ai')
    expect(engine.classify(2)).toBe('uncertain')
    expect(engine.classify(0)).toBe('human')
  })

  it('produces report segments with reasons and suggestions from hits', () => {
    const engine = createRuleEngine({
      ...minimalRules,
      suggestions: {
        summary: { note: '总结套话建议：删掉或改成具体结论。', pattern: '综上所述' },
      },
    })
    const segments = engine.evaluate([segment('综上所述，这是结论。')])
    const report = engine.toReportSegments(segments)

    expect(report[0].label).toBe('ai')
    expect(report[0].reasons).toContain('命中「总结套话」规则（综上所述）')
    expect(report[0].suggestions.length).toBeGreaterThan(0)
  })

  it('multiplies group weight into the segment score', () => {
    const engine = createRuleEngine(minimalRules)
    const result = engine.evaluate([segment('综上所述，这是结论。')])

    expect(result[0].score).toBe(9)
  })
})

describe('validateRegexPattern', () => {
  it('accepts safe bounded patterns', () => {
    expect(validateRegexPattern('首先.{0,20}其次')).toBeNull()
    expect(validateRegexPattern('综上所述')).toBeNull()
  })

  it('rejects nested quantifier patterns', () => {
    expect(validateRegexPattern('(a+)+')).not.toBeNull()
    expect(validateRegexPattern('(ab*)*c')).not.toBeNull()
  })

  it('rejects uncompilable patterns', () => {
    expect(validateRegexPattern('([')).not.toBeNull()
  })

  it('rejects overlength patterns', () => {
    expect(validateRegexPattern('x'.repeat(200))).not.toBeNull()
  })
})
