import type { DetectedSegment, TextSegment } from '@/lib/domain/segments'

export type DetectorMode = 'mock' | 'rule' | 'external'

export interface DetectorProvider {
  mode: DetectorMode
  detect(input: { segments: TextSegment[] }): Promise<DetectedSegment[]>
}
