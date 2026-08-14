import type { DetectedSegment, SegmentLabel } from '@/lib/domain/segments'
import { loadLlmConfig } from './config'
import { llmFetch } from './http'

export interface LlmJudgement {
  id: string
  label: SegmentLabel
  confidence: number
  reasons: string[]
  suggestions: string[]
}

export function isLlmConfigured(): boolean {
  const config = loadLlmConfig()
  return config.enabled && Boolean(config.apiKey)
}

export async function judgeSegmentsWithLlm(
  segments: DetectedSegment[],
  contextText?: string,
): Promise<Map<string, LlmJudgement> | null> {
  const config = loadLlmConfig()
  if (!config.enabled || !config.apiKey || segments.length === 0) return null

  const selected = segments.slice(0, config.maxSegments)
  const chunkSize = 4
  const chunks: DetectedSegment[][] = []
  for (let offset = 0; offset < selected.length; offset += chunkSize) {
    chunks.push(selected.slice(offset, offset + chunkSize))
  }

  const contexts = contextText ? buildParagraphContexts(selected, contextText) : undefined

  const overallDeadlineMs = Math.min(config.timeoutMs * chunks.length, 240_000)
  const deadlineAt = Date.now() + overallDeadlineMs

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      if (Date.now() >= deadlineAt) return null
      return judgeSegmentsInternal(config, chunk, contexts, deadlineAt)
    }),
  )

  const result = new Map<string, LlmJudgement>()
  let hasAnyResponse = false
  for (const chunkResult of results) {
    if (!chunkResult) continue
    hasAnyResponse = true
    for (const [id, judgement] of chunkResult) result.set(id, judgement)
  }

  return hasAnyResponse ? result : null
}

let activeLlmCalls = 0
const initialMaxConcurrency = 5
const minConcurrency = 1
let currentMaxConcurrency = initialMaxConcurrency
let consecutiveFailures = 0
let consecutiveSuccesses = 0

export function resetLlmConcurrency(): void {
  currentMaxConcurrency = initialMaxConcurrency
  consecutiveFailures = 0
  consecutiveSuccesses = 0
  activeLlmCalls = 0
}

async function acquireLlmSlot(): Promise<() => void> {
  while (activeLlmCalls >= currentMaxConcurrency) {
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  activeLlmCalls += 1
  return () => {
    activeLlmCalls -= 1
  }
}

function recordLlmSuccess(): void {
  consecutiveFailures = 0
  consecutiveSuccesses += 1
  if (consecutiveSuccesses >= 10 && currentMaxConcurrency < initialMaxConcurrency) {
    currentMaxConcurrency += 1
    console.info(`[llm] concurrency restored to ${currentMaxConcurrency}`)
  }
}

function recordLlmFailure(): void {
  consecutiveSuccesses = 0
  consecutiveFailures += 1
  if (consecutiveFailures >= 2 && currentMaxConcurrency > minConcurrency) {
    currentMaxConcurrency = minConcurrency
    console.error('[llm] reduced concurrency to 1 after repeated failures')
  }
}

function buildParagraphContexts(
  segments: DetectedSegment[],
  contextText: string,
): Map<string, string> {
  const byParagraph = new Map<number, DetectedSegment[]>()
  for (const segment of segments) {
    const group = byParagraph.get(segment.paragraphIndex) ?? []
    group.push(segment)
    byParagraph.set(segment.paragraphIndex, group)
  }

  const contexts = new Map<string, string>()
  for (const [paragraphIndex, group] of byParagraph) {
    const start = Math.min(...group.map((segment) => segment.start))
    const end = Math.max(...group.map((segment) => segment.end))
    const paragraphText = contextText.slice(start, end).trim()
    if (!paragraphText) continue

    for (const segment of group) {
      if (paragraphText !== segment.text.trim()) {
        contexts.set(segment.id, paragraphText)
      }
    }
  }

  return contexts
}

async function judgeSegmentsInternal(
  config: ReturnType<typeof loadLlmConfig>,
  selected: DetectedSegment[],
  contexts?: Map<string, string>,
  deadlineAt?: number,
): Promise<Map<string, LlmJudgement> | null> {
  const prompt = [
    '你是中文论文 AI 写作辅助判断助手。对每个句子片段判断它更像 AI 生成还是人工写作。',
    '请独立阅读文本判断，不要参考任何外部线索。',
    'context 字段是该片段所在段落的完整上下文，仅用于帮助理解语境，判断对象始终是 text 片段本身。',
    '判断要点：包含具体年份、机构名称、数据、专有名词、口语化表达或成语的片段更可能为人工写作；',
    '空泛的总结、机械的排比、模板化起笔与收尾更可能为 AI 生成。',
    '对每个片段返回三件事：',
    '1. label：ai（疑似 AI 生成）或 human（更像人工写作）或 uncertain（无法判断）；',
    '2. reasons：判断依据，1-2 条，通俗具体，指出句子里的实际证据；',
    '3. suggestions：如果是 ai，必须给出 2 条修改建议，一条针对措辞表达，一条针对内容或结构，都要具体可操作。',
    'confidence 用 0-1 的小数表示你的确信程度。',
    '严格只返回一个 JSON 对象，格式为 {"segments": [{"id": "...", "label": "...", "confidence": 0.8, "reasons": [...], "suggestions": [...]}]}，不要输出任何其他内容。',
    '待判断片段：',
    JSON.stringify(selected.map((segment) => {
      const context = contexts?.get(segment.id)
      return context ? { id: segment.id, text: segment.text, context } : { id: segment.id, text: segment.text }
    })),
  ].join('\n')

  const release = await acquireLlmSlot()
  try {
    const endpoint = `${config.baseUrl.replace(/\/$/u, '')}/chat/completions`
    const controller = new AbortController()
    const remainingMs = deadlineAt ? Math.max(1000, deadlineAt - Date.now()) : config.timeoutMs
    const timer = setTimeout(() => controller.abort(), Math.min(remainingMs, config.timeoutMs))

    try {
      const response = await llmFetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        console.error(`[llm] judge request failed: ${response.status}`)
        recordLlmFailure()
        return null
      }

      const body = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const content = body.choices?.[0]?.message?.content
      if (!content) {
        console.error('[llm] judge response missing content')
        recordLlmFailure()
        return null
      }

      const raw = JSON.parse(content) as unknown
      const items = Array.isArray(raw)
        ? raw as Array<Partial<LlmJudgement>>
        : ((raw as { segments?: unknown })?.segments as Array<Partial<LlmJudgement>> | undefined) ?? []
      const result = new Map<string, LlmJudgement>()

      for (const item of Array.isArray(items) ? items : []) {
        if (!item.id) continue
        const label = normalizeLabel(item.label)
        if (!label) continue

        result.set(item.id, {
          id: item.id,
          label,
          confidence: clampConfidence(Number(item.confidence), label),
          reasons: Array.isArray(item.reasons) && item.reasons.length > 0 ? item.reasons.slice(0, 3) : [],
          suggestions: Array.isArray(item.suggestions) && item.suggestions.length > 0 ? item.suggestions.slice(0, 3) : [],
        })
      }

      if (result.size === 0) {
        console.error('[llm] judge response contained no usable entries')
        recordLlmFailure()
        return null
      }

      recordLlmSuccess()
      return result
    } finally {
      clearTimeout(timer)
    }
  } catch (error) {
    console.error('[llm] judge failed:', error instanceof Error ? error.message : String(error))
    recordLlmFailure()
    return null
  } finally {
    release()
  }
}

function normalizeLabel(label: unknown): SegmentLabel | null {
  if (label === 'ai' || label === 'human' || label === 'uncertain') return label
  if (label === 'AI' || label === 'Ai') return 'ai'
  if (label === 'Human' || label === 'HUMAN') return 'human'
  if (label === 'Uncertain' || label === 'UNCERTAIN') return 'uncertain'
  return null
}

function clampConfidence(value: number, label: SegmentLabel): number {
  if (!Number.isFinite(value)) return label === 'uncertain' ? 0.6 : 0.8
  if (label === 'uncertain') return Math.min(0.7, Math.max(0.5, value))
  return Math.min(0.95, Math.max(0.55, value))
}
