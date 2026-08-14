import { describe, expect, it } from 'vitest'
import { createMockDetector } from '@/lib/detection/mock-detector'

const segments = [
  { id: 's-1', text: '人工智能正在改变学术写作的工作方式。', start: 0, end: 20, paragraphIndex: 0 },
  { id: 's-2', text: '这段文字用于测试稳定的演示结果。', start: 21, end: 37, paragraphIndex: 0 },
]

describe('MockDetector', () => {
  it('returns stable results for the same segments', async () => {
    const detector = createMockDetector()

    const first = await detector.detect({ segments })
    const second = await detector.detect({ segments })

    expect(first).toEqual(second)
    expect(first).toHaveLength(2)
    expect(first.every((item) => ['ai', 'human', 'uncertain'].includes(item.label))).toBe(true)
    expect(first.every((item) => item.reasons.length > 0 && item.suggestions.length > 0)).toBe(true)
  })

  it('distributes labels close to the configured thresholds', async () => {
    const detector = createMockDetector()
    const corpus = Array.from({ length: 5000 }, (_, index) => ({
      id: `s-${index}`,
      text: `用于验证标签分布的演示句子，编号为 ${index}。`,
      start: 0,
      end: 20,
      paragraphIndex: 0,
    }))
    const results = await detector.detect({ segments: corpus })
    const counts = { ai: 0, human: 0, uncertain: 0 }

    for (const result of results) counts[result.label] += 1

    expect(counts.ai / results.length).toBeGreaterThan(0.35)
    expect(counts.ai / results.length).toBeLessThan(0.45)
    expect(counts.human / results.length).toBeGreaterThan(0.25)
    expect(counts.human / results.length).toBeLessThan(0.35)
    expect(counts.uncertain / results.length).toBeGreaterThan(0.25)
    expect(counts.uncertain / results.length).toBeLessThan(0.35)
  })
})
