import path from 'node:path'
import { Hono } from 'hono'
import { AppError, errorResponse } from '@/lib/errors'
import { enqueueDetectionTask } from '@/lib/tasks/queue'
import { createRateLimiter } from '@/lib/tasks/rate-limit'
import { createTask, deleteTask, getTask } from '@/lib/tasks/store'
import {
  validateTextInput,
  readRequestWithinLimit,
  validateRequestSize,
  validateUpload,
  type DetectionInput,
} from '@/lib/validation/input'
import { renderDocxReport } from '@/lib/exports/render-docx'
import { renderHtmlReport } from '@/lib/exports/render-html'
import { renderPdfReport } from '@/lib/exports/render-pdf'

export const detectionsRoutes = new Hono()

const configuredRateLimit = Number(process.env.MAX_REQUESTS_PER_MINUTE)
const rateLimiter = createRateLimiter({
  limit: Number.isFinite(configuredRateLimit) && configuredRateLimit > 0 ? configuredRateLimit : 10,
  windowMs: 60_000,
})

const configuredExportLimit = Number(process.env.MAX_EXPORTS_PER_MINUTE)
const exportRateLimiter = createRateLimiter({
  limit: Number.isFinite(configuredExportLimit) && configuredExportLimit > 0 ? configuredExportLimit : 20,
  windowMs: 60_000,
})

detectionsRoutes.post('/', async (c) => {
  try {
    const rate = rateLimiter.check('global')
    if (!rate.allowed) {
      throw new AppError('RATE_LIMITED', `请求过于频繁，请在 ${rate.retryAfterSeconds} 秒后重试。`, 429)
    }
    validateRequestSize(c.req.raw)
    const input = await readDetectionInput(await readRequestWithinLimit(c.req.raw))
    const task = createTask(input)

    try {
      void enqueueDetectionTask(task.id).catch(() => {
        deleteTask(task.id)
      })
    } catch (error) {
      deleteTask(task.id)
      throw error
    }

    return c.json(
      { id: task.id, status: task.status },
      202,
    )
  } catch (error) {
    return errorResponse(error)
  }
})

detectionsRoutes.get('/:id', async (c) => {
  const task = getTask(c.req.param('id'))
  if (!task) return errorResponse(new AppError('TASK_NOT_FOUND', '检测任务不存在或已过期。', 404))
  return c.json({ id: task.id, status: task.status, stage: task.stage, progress: task.progress, report: task.report, error: task.error })
})

detectionsRoutes.get('/:id/export', async (c) => {
  try {
    const rate = exportRateLimiter.check('export')
    if (!rate.allowed) {
      throw new AppError('RATE_LIMITED', `导出过于频繁，请在 ${rate.retryAfterSeconds} 秒后重试。`, 429)
    }

    const task = getTask(c.req.param('id'))
    if (!task) {
      throw new AppError('TASK_NOT_FOUND', '检测报告不存在或已过期。', 404)
    }
    if (!task.report) {
      throw new AppError('TASK_NOT_READY', '检测还在进行中，请等待处理完成后再导出。', 409)
    }

    const format = new URL(c.req.url).searchParams.get('format')
    if (format !== 'html' && format !== 'docx' && format !== 'pdf') {
      throw new AppError('INVALID_EXPORT_FORMAT', '不支持的报告导出格式。')
    }

    const report = task.report
    const baseName = safeFileName(report.sourceName)

    if (format === 'html') {
      return download(
        Buffer.from(renderHtmlReport(report), 'utf8'),
        'text/html; charset=utf-8',
        `${baseName}-检测报告.html`,
      )
    }

    if (format === 'docx') {
      return download(await renderDocxReport(report), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', `${baseName}-检测报告.docx`)
    }

    return download(await renderPdfReport(report), 'application/pdf', `${baseName}-检测报告.pdf`)
  } catch (error) {
    return errorResponse(error)
  }
})

async function readDetectionInput(request: Request): Promise<DetectionInput> {
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      throw new AppError('INVALID_REQUEST', '请求内容无法读取。')
    }
    const text = typeof body === 'object' && body !== null && 'text' in body
      ? body.text
      : undefined

    if (typeof text !== 'string') {
      throw new AppError('TEXT_REQUIRED', '请输入或粘贴需要检测的正文。')
    }

    const validation = validateTextInput(text)
    return {
      kind: 'text',
      text,
      sourceName: '粘贴文本',
      warnings: validation.warnings,
    }
  }

  if (!contentType.includes('multipart/form-data')) {
    throw new AppError('INVALID_REQUEST', '请求格式不受支持。')
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    throw new AppError('INVALID_REQUEST', '请求内容无法读取。')
  }
  const text = formData.get('text')
  const file = formData.get('file')

  if (typeof text === 'string' && text.trim()) {
    if (file instanceof File) {
      throw new AppError('MULTIPLE_INPUTS', '一次只能提交文字或一个文件。')
    }
    const validation = validateTextInput(text)
    return {
      kind: 'text',
      text,
      sourceName: '粘贴文本',
      warnings: validation.warnings,
    }
  }

  if (!(file instanceof File)) {
    throw new AppError('FILE_REQUIRED', '请选择 Word 或 PDF 文件。')
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const fileInput = {
    filename: file.name,
    mimeType: file.type,
    buffer,
  }
  const validation = validateUpload(fileInput)

  return {
    kind: 'file',
    ...fileInput,
    sourceName: file.name,
    warnings: validation.warnings,
  }
}

function safeFileName(value: string): string {
  const base = path.parse(value).name.replace(/[\\/:*?"<>|\u0000-\u001f]/gu, '_').trim()
  return base || '论文'
}

function download(buffer: Buffer, contentType: string, filename: string): Response {
  const asciiName = filename
    .replace(/[\u0080-\uffff]/gu, '_')
    .replace(/["\\]/gu, '_')

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'content-type': contentType,
      'content-disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(filename).replace(/'/gu, '%27')}`,
      'cache-control': 'no-store',
    },
  })
}
