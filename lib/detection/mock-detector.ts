import type { DetectedSegment, SegmentLabel } from '@/lib/domain/segments'
import type { DetectorProvider } from './types'

const reasonSets: Record<SegmentLabel, string[][]> = {
  ai: [
    ['句式结构较均衡', '抽象概括表达较集中'],
    ['转折与总结连接较密集', '表达节奏较为规整'],
  ],
  human: [
    ['句式长短变化明显', '表达中保留了具体语境'],
    ['论述节奏有自然停顿', '细节密度相对充足'],
  ],
  uncertain: [
    ['文本长度不足以形成稳定判断', '语言特征同时呈现两种倾向'],
    ['学术表达较为规范', '当前片段需要结合上下文判断'],
  ],
}

const suggestionSets: Record<SegmentLabel, string[][]> = {
  ai: [
    ['补充具体案例或数据', '加入与研究对象直接相关的观察'],
    ['调整部分句式的长短变化', '把概括性判断落到具体论据上'],
  ],
  human: [
    ['保留现有表达，再检查论据衔接', '确认关键结论都有来源支撑'],
    ['可适度压缩重复表述', '保持个人判断和具体细节'],
  ],
  uncertain: [
    ['结合前后段落重新判断', '补充能够体现研究过程的细节'],
    ['避免只依据本句下结论', '检查这一段是否包含可核验依据'],
  ],
}

function hashText(text: string): number {
  let hash = 2166136261

  for (const character of text) {
    hash ^= character.codePointAt(0) ?? 0
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function avalanche(hash: number): number {
  let mixed = hash >>> 0
  mixed ^= mixed >>> 16
  mixed = Math.imul(mixed, 0x85ebca6b)
  mixed ^= mixed >>> 13
  mixed = Math.imul(mixed, 0xc2b2ae35)
  mixed ^= mixed >>> 16
  return mixed >>> 0
}

function classify(hash: number): { label: SegmentLabel; confidence: number } {
  const bucket = avalanche(hash) % 10

  if (bucket < 4) {
    return { label: 'ai', confidence: 0.72 + (avalanche(hash) % 8) / 100 }
  }

  if (bucket < 7) {
    return { label: 'human', confidence: 0.72 + (avalanche(hash) % 8) / 100 }
  }

  return { label: 'uncertain', confidence: 0.4 + (avalanche(hash) % 18) / 100 }
}

export function createMockDetector(): DetectorProvider {
  return {
    mode: 'mock',
    async detect({ segments }) {
      const neutral = segments
        .filter((segment) => segment.scored === false)
        .map((segment) => ({
          ...segment,
          label: 'human' as const,
          confidence: 0.5,
          reasons: ['非正文内容（标题、目录或引文），未参与检测'],
          suggestions: [],
        }))

      const scored = segments
        .filter((segment) => segment.scored !== false)
        .map((segment) => {
          const hash = hashText(`${segment.id}:${segment.text}`)
          const { label, confidence } = classify(hash)
          const reasons = reasonSets[label][avalanche(hash) % reasonSets[label].length]
          const suggestions = suggestionSets[label][avalanche(hash) % suggestionSets[label].length]

          return {
            ...segment,
            label,
            confidence,
            reasons: [...reasons],
            suggestions: [...suggestions],
          } satisfies DetectedSegment
        })

      return [...scored, ...neutral].sort((left, right) => left.start - right.start)
    },
  }
}
