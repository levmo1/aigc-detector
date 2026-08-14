import type { TextSegment } from '@/lib/domain/segments'

export interface ParsedDocument {
  sourceType: 'text' | 'docx' | 'pdf'
  text: string
  segments: TextSegment[]
  pageCount?: number
  usedOcr: boolean
  warnings: string[]
}
