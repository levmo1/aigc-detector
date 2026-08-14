import type { TextSegment } from '@/lib/domain/segments'
import type { BuiltinFeature } from './engine'

const transitionWords = ['然而', '与此同时', '此外', '因此', '总之', '总的来说', '综上所述', '但是', '进而']

function countScoredCharacters(text: string): number {
  return Array.from(text).filter((character) => !/\s/u.test(character)).length
}

function paragraphSegmentsOf(segment: TextSegment, segments: TextSegment[]): TextSegment[] {
  return segments.filter((item) => item.paragraphIndex === segment.paragraphIndex)
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export const builtinFeatures: Record<string, BuiltinFeature> = {
  sentenceLengthVariance: {
    weight: 1,
    note: '句长方差过低＝句式过于工整',
    score(segment, segments) {
      const paragraphSegments = paragraphSegmentsOf(segment, segments)
      if (paragraphSegments.length < 3) return 0

      const lengths = paragraphSegments.map((item) => countScoredCharacters(item.text))
      const average = mean(lengths)
      const variance = mean(lengths.map((length) => (length - average) ** 2))
      const relativeDeviation = Math.sqrt(variance) / Math.max(average, 1)

      if (relativeDeviation < 0.08) return 2
      if (relativeDeviation < 0.15) return 1
      return 0
    },
  },
  nGramRepeat: {
    weight: 2,
    note: '3-gram 重复度',
    score(segment) {
      const characters = Array.from(segment.text)
      if (characters.length < 9) return 0

      const grams = new Map<string, number>()
      for (let index = 0; index <= characters.length - 3; index += 1) {
        const gram = characters.slice(index, index + 3).join('')
        grams.set(gram, (grams.get(gram) ?? 0) + 1)
      }

      const repeatedCount = [...grams.values()].filter((count) => count > 1).reduce((sum, count) => sum + count - 1, 0)
      const totalGrams = Math.max(characters.length - 2, 1)
      const repeatRatio = repeatedCount / totalGrams

      if (repeatRatio > 0.08) return 2
      if (repeatRatio > 0.04) return 1
      return 0
    },
  },
  transitionDensity: {
    weight: 1,
    note: '转折/递进连接词密度',
    score(segment) {
      const characters = countScoredCharacters(segment.text)
      if (characters < 15) return 0

      let hits = 0
      for (const word of transitionWords) {
        let index = segment.text.indexOf(word)
        while (index >= 0) {
          hits += 1
          index = segment.text.indexOf(word, index + word.length)
        }
      }

      const density = hits / characters
      if (density > 0.06) return 2
      if (density > 0.03) return 1
      return 0
    },
  },
  punctuationDensity: {
    weight: 1,
    note: '破折号/冒号密度',
    score(segment) {
      const characters = countScoredCharacters(segment.text)
      if (characters < 20) return 0

      const dashes = (segment.text.match(/——/gu) ?? []).length
      const colons = (segment.text.match(/：/gu) ?? []).length
      const density = (dashes + colons) / characters

      if (density > 0.08) return 2
      if (density > 0.04) return 1
      return 0
    },
  },
  lexicalDiversity: {
    weight: 1,
    note: '词汇多样性异常',
    score(segment) {
      const characters = Array.from(segment.text).filter((character) => !/\s/u.test(character))
      if (characters.length < 30) return 0

      const unique = new Set(characters)
      const ratio = unique.size / characters.length

      if (ratio < 0.3) return 2
      if (ratio < 0.4) return 1
      return 0
    },
  },
  ruleOfThree: {
    weight: 2,
    note: '三连结构检测',
    score(segment, segments) {
      const paragraphSegments = paragraphSegmentsOf(segment, segments)
      if (paragraphSegments.length < 3) return 0

      const texts = paragraphSegments.map((item) => item.text)
      let triples = 0
      for (let index = 0; index <= texts.length - 3; index += 1) {
        const [a, b, c] = [texts[index], texts[index + 1], texts[index + 2]]
        const lengths = [countScoredCharacters(a), countScoredCharacters(b), countScoredCharacters(c)]
        if (lengths.some((length) => length < 6)) continue

        const sameLength = Math.max(...lengths) - Math.min(...lengths) <= 1
        const samePrefix = [a, b, c].every((text) => text.slice(0, 3) === a.slice(0, 3) && a.slice(0, 3).length > 0)
        if (!sameLength && !samePrefix) continue

        triples += 1
      }

      if (triples >= 2) return 2
      if (triples === 1) return 1
      return 0
    },
  },
}
