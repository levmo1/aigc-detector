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
  evidenceScore?: number
  ruleGroupCount?: number
  localLabel?: SegmentLabel
  llmLabel?: SegmentLabel
  llmConfidence?: number
  llmReasons?: string[]
  reasons: string[]
  suggestions: string[]
}

export function countScoredCharacters(text: string): number {
  return Array.from(text).filter((character) => !/\s/u.test(character)).length
}
