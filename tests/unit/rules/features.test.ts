import { describe, expect, it } from 'vitest'
import type { TextSegment } from '@/lib/domain/segments'
import { builtinFeatures } from '@/lib/rules/features'

const segment = (text: string, paragraphIndex = 0): TextSegment => ({
  id: `s-${text.length}-${paragraphIndex}`,
  text,
  start: 0,
  end: text.length,
  paragraphIndex,
})

describe('builtin rule features', () => {
  it('flags mechanically even sentence lengths in a paragraph', () => {
    const segments = [
      segment('人工智能在医疗领域展现出显著的应用价值。', 0),
      segment('深度学习在影像诊断中已经取得重要突破。', 0),
      segment('多模态模型正在推动临床决策支持系统的进步。', 0),
    ]

    const variance = builtinFeatures.sentenceLengthVariance.score(segments[0], segments)
    expect(variance).toBeGreaterThan(0)
  })

  it('does not flag naturally varying sentence lengths', () => {
    const segments = [
      segment('人工智能在医疗领域展现出显著的应用价值，尤其在影像诊断方面。', 0),
      segment('短期看仍有不少障碍。', 0),
      segment('但这并没有阻止资本和技术持续涌入这个赛道。', 0),
    ]

    const variance = builtinFeatures.sentenceLengthVariance.score(segments[0], segments)
    expect(variance).toBe(0)
  })

  it('flags repeated 3-grams', () => {
    const text = '本文认为本文认为本文认为这是一个重要的问题。'
    const score = builtinFeatures.nGramRepeat.score(segment(text), [segment(text)])

    expect(score).toBeGreaterThan(0)
  })

  it('flags dense transition words', () => {
    const text = '然而，与此同时，此外，因此，总的来说，综上所述。'
    const score = builtinFeatures.transitionDensity.score(segment(text), [segment(text)])

    expect(score).toBeGreaterThan(0)
  })

  it('flags dense dashes and colons', () => {
    const text = '这——不是——问题：而——是——答案：一切——都——很——明确。'
    const score = builtinFeatures.punctuationDensity.score(segment(text), [segment(text)])

    expect(score).toBeGreaterThan(0)
  })

  it('flags rule-of-three parallel sentences', () => {
    const segments = [
      segment('该研究突破了传统范式。', 0),
      segment('该研究填补了理论空白。', 0),
      segment('该研究创新了分析视角。', 0),
    ]

    const score = builtinFeatures.ruleOfThree.score(segments[0], segments)
    expect(score).toBeGreaterThan(0)
  })

  it('does not flag naturally similar sentence lengths without shared structure', () => {
    const segments = [
      segment('人工智能在医疗领域展现出显著的应用价值。', 0),
      segment('深度学习在影像诊断中已经取得重要突破。', 0),
      segment('多模态模型正在推动临床决策支持系统的进步，并在基层试点。', 0),
    ]

    const score = builtinFeatures.ruleOfThree.score(segments[0], segments)
    expect(score).toBe(0)
  })

  it('flags sentences with an identical prefix even when lengths differ', () => {
    const segments = [
      segment('该研究突破了传统范式。', 0),
      segment('该研究填补了理论空白。', 0),
      segment('该研究创新了分析视角，也丰富了方法体系。', 0),
    ]

    const score = builtinFeatures.ruleOfThree.score(segments[0], segments)
    expect(score).toBeGreaterThan(0)
  })
})
