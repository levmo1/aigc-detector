import type { TextSegment } from '@/lib/domain/segments'
import type { ParsedDocument } from './types'

const sentenceEndings = new Set(['。', '！', '？', '!', '?'])

export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/gu, '\n')
    .replace(/\u00a0/gu, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t\u3000]+/gu, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim()
}

export function countScoredCharacters(text: string): number {
  return Array.from(text).filter((character) => !/\s/u.test(character)).length
}

export function isNonScoredParagraph(text: string): boolean {
  const compact = text.replace(/\s+/gu, '')
  if (!compact) return true

  const characterCount = countScoredCharacters(text)

  if (/\.{3,}/u.test(text)) return true

  if (/^\[\d+\]/u.test(compact)) return true

  const latinCount = (text.match(/[A-Za-z]/gu) ?? []).length
  const latinRatio = latinCount / Math.max(characterCount, 1)
  if (latinRatio > 0.5) return true

  const hasSentenceEnding = /[。！？!?]$/u.test(text.trim())
  if (!hasSentenceEnding && characterCount < 60) return true

  return false
}

export function isNonScoredSegment(text: string): boolean {
  const trimmed = text.trim()
  const characterCount = countScoredCharacters(trimmed)
  const hasSentenceEnding = /[。！？!?]$/u.test(trimmed)
  const numberedHeading = /^(?:[一二三四五六七八九十百]+、|（[一二三四五六七八九十百]+）|\d+[.、]\s*)/u.test(trimmed)

  if (/^\[\d+\]/u.test(trimmed)) return true
  if (/\.{3,}/u.test(trimmed)) return true
  if (/^(?:目\s*录|参考文献|自我声明|致\s*谢|摘\s*要)/u.test(trimmed)) return true
  if (!hasSentenceEnding && characterCount < 20) return true
  if (numberedHeading && !hasSentenceEnding && characterCount < 30) return true

  return false
}

function looksLikeStructuralLine(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (/^\[\d+\]/u.test(trimmed)) return true
  if (/\.{3,}/u.test(trimmed)) return true
  if (/^(?:[一二三四五六七八九十百]+、|（[一二三四五六七八九十百]+）|\d+[.、]\s*)/u.test(trimmed)) return true
  if (/^(?:目\s*录|参考文献|自我声明|致\s*谢|摘\s*要)/u.test(trimmed)) return true
  return false
}

export function splitIntoSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = []
  let paragraphIndex = 0
  let segmentStart = 0

  const appendSegment = (start: number, end: number, scored: boolean) => {
    while (start < end && /\s/u.test(text[start] ?? '')) start += 1
    while (end > start && /\s/u.test(text[end - 1] ?? '')) end -= 1

    if (start === end) return

    const segmentText = text.slice(start, end)
    const isScored = scored && !isNonScoredSegment(segmentText)

    segments.push({
      id: `s-${segments.length + 1}`,
      text: segmentText,
      start,
      end,
      paragraphIndex,
      scored: isScored,
    })
  }

  const splitParagraph = (start: number, end: number) => {
    const paragraphText = text.slice(start, end)
    const paragraphScored = !isNonScoredParagraph(paragraphText)
    let inReferencesBlock = false

    const isReferencesTitle = (line: string) => /^(?:参考文献|参考\s*文\s*献|References)/u.test(line.trim())

    for (let index = start; index < end; index += 1) {
      if (text[index] === '\n' && text[index + 1] !== '\n') {
        const currentLine = text.slice(segmentStart, index)
        const nextLine = text.slice(index + 1, Math.min(index + 1 + 80, end))
        if (isReferencesTitle(currentLine)) inReferencesBlock = true

        if (inReferencesBlock || looksLikeStructuralLine(currentLine) || looksLikeStructuralLine(nextLine)) {
          appendSegment(segmentStart, index, paragraphScored && !inReferencesBlock)
          segmentStart = index + 1
        }
        continue
      }

      if (!sentenceEndings.has(text[index] ?? '')) continue

      let sentenceEnd = index + 1
      while (text[sentenceEnd] === '”' || text[sentenceEnd] === '」' || text[sentenceEnd] === '』' || text[sentenceEnd] === '）' || text[sentenceEnd] === ')') {
        sentenceEnd += 1
      }
      appendSegment(segmentStart, sentenceEnd, paragraphScored && !inReferencesBlock)
      segmentStart = sentenceEnd
      index = sentenceEnd - 1
    }

    appendSegment(segmentStart, end, paragraphScored && !inReferencesBlock)
  }

  let paragraphStart = 0
  let cursor = 0

  while (cursor < text.length) {
    if (text[cursor] === '\n' && text[cursor + 1] === '\n') {
      splitParagraph(paragraphStart, cursor)
      paragraphIndex += 1
      segmentStart = cursor + 2
      paragraphStart = cursor + 2
      while (cursor < text.length && text[cursor] === '\n') cursor += 1
      continue
    }
    cursor += 1
  }

  splitParagraph(paragraphStart, text.length)
  return segments
}

export function parseTextDocument(source: string, sourceType: ParsedDocument['sourceType'] = 'text'): ParsedDocument {
  const text = normalizeText(source)

  return {
    sourceType,
    text,
    segments: splitIntoSegments(text),
    usedOcr: false,
    warnings: [],
  }
}
