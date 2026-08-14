export type SegmentLabel = 'ai' | 'human' | 'uncertain'

export interface TextSegment {
  id: string
  text: string
  start: number
  end: number
  paragraphIndex: number
  scored?: boolean
}

export interface DetectedSegment extends TextSegment {
  label: SegmentLabel
  confidence: number
  reasons: string[]
  suggestions: string[]
}

export function countScoredCharacters(text: string): number {
  return Array.from(text).filter((character) => !/\s/u.test(character)).length
}
