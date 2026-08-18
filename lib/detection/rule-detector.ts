import type { DetectedSegment, TextSegment } from '@/lib/domain/segments'
import type { DetectorProvider } from './types'
import { createRuleEngine } from '@/lib/rules/engine'
import { builtinFeatures } from '@/lib/rules/features'
import { loadRuleLibrary } from '@/lib/rules/loader'
import { buildSuggestions, explainHits, explainNoHits } from '@/lib/rules/explain'

export function createRuleDetector(): DetectorProvider {
  const library = loadRuleLibrary()
  const engine = createRuleEngine({
    groups: library.groups,
    thresholds: library.thresholds,
    features: builtinFeatures,
  })

  return {
    mode: 'rule',
    async detect({ segments }: { segments: TextSegment[] }): Promise<DetectedSegment[]> {
      const scoredSegments = segments.filter((segment) => segment.scored !== false)
      const unscoredSegments = segments.filter((segment) => segment.scored === false)

      const evaluations = engine.evaluate(scoredSegments)
      const detected = engine.toReportSegments(evaluations)

      detected.forEach((segment, index) => {
        const evaluation = evaluations[index]
        const reasons = evaluation.score > 0 ? explainHits(evaluation) : [explainNoHits()]
        if (segment.label === 'ai' && evaluation.ruleGroupCount < engine.thresholds.minimumAIRuleGroups) {
          reasons.push('全文多个片段重复出现模板化、排比或高频表达，综合线索后达到 AI 倾向阈值')
        }
        segment.reasons = [...new Set(reasons)]
        segment.suggestions = buildSuggestions(evaluation)
      })

      const neutral = unscoredSegments.map((segment) => ({
        ...segment,
        label: 'human' as const,
        confidence: 0.5,
        reasons: ['非正文内容（标题、目录或引文），未参与检测'],
        suggestions: [],
      }))

      return [...detected, ...neutral].sort((left, right) => left.start - right.start)
    },
  }
}
