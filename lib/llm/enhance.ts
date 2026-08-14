import type { DetectionReport } from '@/lib/domain/report'
import { buildSummary } from '@/lib/domain/report'
import { judgeSegmentsWithLlm, isLlmConfigured } from './explainer'

export async function judgeReportWithLlm(report: DetectionReport): Promise<DetectionReport> {
  if (!isLlmConfigured() || report.mode !== 'rule') return report

  const candidateSegments = report.segments.filter((segment) => segment.scored !== false)
  const judgements = await judgeSegmentsWithLlm(candidateSegments, report.text)
  if (!judgements) {
    return {
      ...report,
      warnings: [...report.warnings, '模型辅助判断未完成（可能超时或服务异常），本报告使用本地规则判断结果。'],
    }
  }

  const segments = report.segments.map((segment) => {
    const judgement = judgements.get(segment.id)
    if (!judgement) return segment
    if (judgement.label === 'uncertain') return segment
    if (judgement.reasons.length === 0) return segment

    return {
      ...segment,
      label: judgement.label,
      confidence: judgement.confidence,
      reasons: judgement.reasons,
      suggestions: judgement.suggestions.length > 0 ? judgement.suggestions : segment.suggestions,
    }
  })

  return {
    ...report,
    segments,
    summary: buildSummary(segments),
  }
}
