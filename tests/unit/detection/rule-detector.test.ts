import { describe, expect, it } from 'vitest'
import { createRuleDetector } from '@/lib/detection/rule-detector'
import type { TextSegment } from '@/lib/domain/segments'

const segment = (text: string, index = 0): TextSegment => ({
  id: `s-${index}`,
  text,
  start: 0,
  end: text.length,
  paragraphIndex: 0,
})

describe('RuleDetector', () => {
  it('flags dense AI-catchphrase text as AI tendency', async () => {
    const detector = createRuleDetector()
    const text = '综上所述，本研究具有重要意义。首先，数据覆盖有限；其次，标注成本较高；再次，偏差尚未解决。值得注意的是，专家认为这一结果充分说明了问题的严重性。'
    const results = await detector.detect({ segments: [segment(text)] })

    expect(results[0].label).toBe('ai')
    expect(results[0].reasons.length).toBeGreaterThan(0)
  })

  it('labels plain text without features as human tendency', async () => {
    const detector = createRuleDetector()
    const text = '周三下午我去图书馆还书，顺便把上周借的那本统计教材翻了翻，公式还是老样子，倒是旁边多了几个新书架。'
    const results = await detector.detect({ segments: [segment(text)] })

    expect(results[0].label).toBe('human')
  })

  it('keeps a single common academic phrase as uncertain', async () => {
    const detector = createRuleDetector()
    const text = '研究表明，这一现象仍然需要结合具体样本和研究背景分析。'
    const results = await detector.detect({ segments: [segment(text)] })

    expect(results[0].label).toBe('uncertain')
  })

  it('keeps results stable across repeated runs', async () => {
    const detector = createRuleDetector()
    const first = await detector.detect({ segments: [segment('综上所述，本文的结论是明确的。')] })
    const second = await detector.detect({ segments: [segment('综上所述，本文的结论是明确的。')] })

    expect(first).toEqual(second)
  })

  it('reports its mode as rule', () => {
    expect(createRuleDetector().mode).toBe('rule')
  })
})
