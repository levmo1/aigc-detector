import path from 'node:path'
import { buildReport } from '@/lib/domain/report'
import { AppError, toAppError } from '@/lib/errors'
import { getDetectorProvider } from '@/lib/detection/provider'
import { normalizeText, parseTextDocument } from '@/lib/documents/normalize'
import { parseDocx } from '@/lib/documents/parse-docx'
import { parsePdf } from '@/lib/documents/parse-pdf'
import { judgeReportWithLlm } from '@/lib/llm/enhance'
import { isLlmConfigured } from '@/lib/llm/explainer'
import { limits, validateTextInput } from '@/lib/validation/input'
import { getTask, updateTask } from './store'

export async function processDetectionTask(id: string): Promise<void> {
  const task = getTask(id)
  const input = task?.input
  if (!input) return

  try {
    updateTask(id, { status: 'parsing', stage: '解析文档', progress: 20 })

    const parsed = input.kind === 'text'
      ? parseTextDocument(normalizeText(input.text))
      : await parseFile(input.filename, input.buffer)

    const textValidation = validateTextInput(parsed.text)
    updateTask(id, { status: 'detecting', stage: '分析文本片段', progress: 60 })

    const detector = getDetectorProvider()
    const segments = await detector.detect({ segments: parsed.segments })
    const report = buildReport({
      id,
      mode: detector.mode,
      sourceName: input.sourceName,
      sourceType: parsed.sourceType,
      text: parsed.text,
      segments,
      warnings: [...new Set([...input.warnings, ...textValidation.warnings, ...parsed.warnings])],
    })

    if (isLlmConfigured()) {
      updateTask(id, { status: 'detecting', stage: '模型辅助判断', progress: 75 })
    }

    const judged = await judgeReportWithLlm(report)

    updateTask(id, {
      status: 'ready',
      stage: '报告已生成',
      progress: 100,
      report: judged,
      input: undefined,
    })
  } catch (error) {
    const appError = toAppError(error)

    updateTask(id, {
      status: 'error',
      stage: '处理失败',
      progress: 100,
      error: { code: appError.code, message: appError.message },
      input: undefined,
    })
  }
}

async function parseFile(filename: string, buffer: Buffer) {
  const extension = path.extname(filename).toLowerCase()

  if (extension === '.docx') return parseDocx(buffer)
  if (extension === '.pdf') return parsePdf(buffer, { maxPages: limits.maxPdfPages })

  throw new AppError('UNSUPPORTED_FILE', '只支持 Word（.docx）和 PDF 文件。')
}
