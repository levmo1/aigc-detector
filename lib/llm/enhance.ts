import type { DetectionReport } from '@/lib/domain/report'
import { buildSummary } from '@/lib/domain/report'
import { loadLlmConfig } from './config'
import { judgeSegmentsWithLlm } from './explainer'

export async function judgeReportWithLlm(report: DetectionReport): Promise<DetectionReport> {
  const config = loadLlmConfig()
  if (!config.enabled || !config.apiKey || report.mode !== 'rule') return report

  const candidateSegments = report.segments.filter((segment) => segment.scored !== false)
  const review = await judgeSegmentsWithLlm(candidateSegments, report.text)
  if (!review) {
    return {
      ...report,
      llmReviewStatus: 'failed',
      llmRequestedSegments: Math.min(candidateSegments.length, config.maxSegments),
      llmReviewedSegments: 0,
      warnings: [...report.warnings, '模型辅助判断未完成（可能超时或服务异常），本报告使用本地规则判断结果。'],
    }
  }

  const segments = report.segments.map((segment) => {
    const localLabel = segment.localLabel ?? segment.label
    const judgement = review.judgements.get(segment.id)
    if (!judgement) return { ...segment, localLabel }

    const reviewEvidence = [...judgement.evidence, ...judgement.reasons]
    const base = {
      ...segment,
      localLabel,
      llmLabel: judgement.label,
      llmConfidence: judgement.confidence,
      llmReasons: reviewEvidence,
    }
    if (judgement.label === 'uncertain' || judgement.evidence.length === 0 || reviewEvidence.length === 0) return base

    if (judgement.label === localLabel) {
      return {
        ...base,
        label: localLabel,
        confidence: judgement.confidence,
        reasons: judgement.reasons.length > 0 ? judgement.reasons : segment.reasons,
        suggestions: judgement.suggestions.length > 0 ? judgement.suggestions : segment.suggestions,
      }
    }

    return {
      ...base,
      label: 'uncertain' as const,
      confidence: 0.55,
      reasons: [
        `本地规则为「${localLabel}」，模型复核为「${judgement.label}」，两者不一致`,
        ...judgement.reasons,
      ].slice(0, 3),
      suggestions: judgement.suggestions.length > 0 ? judgement.suggestions : segment.suggestions,
    }
  })

  return {
    ...report,
    llmAssisted: review.completedSegments > 0,
    llmModel: config.model,
    llmReviewStatus: review.completedSegments < review.requestedSegments ? 'partial' : 'completed',
    llmRequestedSegments: review.requestedSegments,
    llmReviewedSegments: review.completedSegments,
    segments,
    summary: buildSummary(segments),
  }
}
