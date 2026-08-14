import pdfMake from 'pdfmake/build/pdfmake'
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces'
import type { DetectionReport } from '@/lib/domain/report'
import type { SegmentLabel } from '@/lib/domain/segments'
import { AppError } from '@/lib/errors'
import { modeLabel, renderHtmlReport } from './render-html'
import { pdfFontName, pdfMakeFonts, pdfMakeVfs } from './pdfmake-fonts'

const FONT = pdfFontName()

const colors: Record<SegmentLabel, string> = {
  ai: '#dc624b',
  human: '#2d7b78',
  uncertain: '#dba94f',
}

const backgrounds: Record<SegmentLabel, string> = {
  ai: '#fff0eb',
  human: '#e8f5f1',
  uncertain: '#fff4d8',
}

const labels: Record<SegmentLabel, string> = {
  ai: 'AI 倾向',
  human: '人工倾向',
  uncertain: '不确定',
}

interface PdfRenderOptions {
  generatePdf?: (html: string) => Promise<Buffer>
}

export async function renderPdfReport(report: DetectionReport, options: PdfRenderOptions = {}): Promise<Buffer> {
  if (options.generatePdf) return options.generatePdf(renderHtmlReport(report))

  return withPdfSlot(async () => {
    loadPdfMakeFonts()
    const docDefinition = buildDocDefinition(report)
    const buffer = await pdfMake.createPdf(docDefinition).getBuffer()
    return Buffer.from(buffer)
  })
}

function loadPdfMakeFonts(): void {
  pdfMake.addVirtualFileSystem(pdfMakeVfs())
  pdfMake.fonts = pdfMakeFonts()
}

function buildDocDefinition(report: DetectionReport): TDocumentDefinitions {
  const content: Content[] = [
    { text: 'CHINESE TEXT LAB / READING REPORT', style: 'eyebrow' },
    { text: report.sourceName, style: 'title' },
    { text: `生成时间：${report.generatedAt} · 有效字符：${report.summary.scoredCharacters.toLocaleString('zh-CN')}`, style: 'meta' },
    { text: modeLabel(report.mode), style: 'badge' },
    { text: '' },
    {
      columns: [
        { text: [{ text: 'AI 倾向\n', fontSize: 9, color: '#17232a' }, { text: `${report.summary.aiRate}%`, fontSize: 24, color: colors.ai }] },
        { text: [{ text: '人工倾向\n', fontSize: 9, color: '#17232a' }, { text: `${report.summary.humanRate}%`, fontSize: 24, color: colors.human }] },
        { text: [{ text: '不确定\n', fontSize: 9, color: '#17232a' }, { text: `${report.summary.uncertainRate}%`, fontSize: 24, color: colors.uncertain }] },
      ],
      margin: [0, 20, 0, 6],
    },
    { text: '三项比例按有效检测文本的片段覆盖比例统计，结果是语言线索，不是作者身份的绝对证明。', style: 'note' },
    ...(report.warnings.length > 0 ? [{ text: report.warnings.join(' '), style: 'warning' }] : []),
    { text: '文档', style: 'h2' },
    { text: annotatedContent(report), fontSize: 11, lineHeight: 1.8 },
    ...(scoredInsights(report).length > 0 ? [{ text: '片段说明', style: 'h2' }, ...scoredInsights(report)] : []),
    { text: '文脉校阅台 · 首版检测结果仅用于功能演示', style: 'footer' },
  ]

  return {
    pageSize: 'A4',
    pageMargins: [40, 45, 40, 50],
    defaultStyle: { font: FONT, fontSize: 10, color: '#17232a', lineHeight: 1.5 },
    styles: {
      eyebrow: { fontSize: 8, color: '#dc624b', characterSpacing: 1, bold: true },
      title: { fontSize: 22, bold: true, margin: [0, 6, 0, 4] },
      meta: { fontSize: 9, color: '#526067' },
      badge: { fontSize: 9, color: '#815d1e', margin: [0, 12, 0, 0] },
      warning: { fontSize: 9, color: '#815d1e', margin: [0, 10, 0, 0] },
      note: { fontSize: 9, color: '#526067', margin: [0, 10, 0, 0] },
      h2: { fontSize: 13, bold: true, margin: [0, 22, 0, 8] },
      footer: { fontSize: 8, color: '#526067', margin: [0, 20, 0, 0] },
    },
    content,
  }
}

function annotatedContent(report: DetectionReport): Content[] {
  let cursor = 0
  const content: Content[] = []

  for (const segment of [...report.segments].sort((left, right) => left.start - right.start)) {
    if (segment.start > cursor) {
      content.push(report.text.slice(cursor, segment.start))
    }
    const slice = report.text.slice(segment.start, segment.end)
    if (segment.scored === false) {
      content.push(slice)
    } else {
      content.push({
        text: slice,
        color: colors[segment.label],
        background: backgrounds[segment.label],
      } as Content)
    }
    cursor = segment.end
  }

  if (cursor < report.text.length) {
    content.push(report.text.slice(cursor))
  }

  return content.length > 0 ? content : [report.text]
}

function scoredInsights(report: DetectionReport): Content[] {
  return report.segments
    .filter((segment) => segment.scored !== false)
    .map((segment) => ({
      margin: [0, 6, 0, 0],
      color: colors[segment.label],
      text: [
        { text: `${labels[segment.label]} · ${Math.round(segment.confidence * 100)}%\n`, bold: true },
        { text: `片段：${segment.text}\n` },
        { text: `语言特征：${segment.reasons.join('；')}\n` },
        { text: `修改方向：${segment.suggestions.join('；')}` },
      ],
    } as Content))
}

const maxConcurrentPdfJobs = 2
const maxPendingPdfJobs = 4
let activePdfJobs = 0
let pendingPdfJobs = 0
const pdfWaiters: Array<() => void> = []

async function withPdfSlot<T>(operation: () => Promise<T>): Promise<T> {
  if (pendingPdfJobs >= maxPendingPdfJobs) {
    throw new AppError('EXPORT_BUSY', 'PDF 报告正在生成，请稍后重试。', 503)
  }

  pendingPdfJobs += 1

  try {
    await new Promise<void>((resolve) => {
      if (activePdfJobs < maxConcurrentPdfJobs) {
        activePdfJobs += 1
        resolve()
      } else {
        pdfWaiters.push(resolve)
      }
    })

    return await withOperationTimeout(operation, 60_000)
  } finally {
    activePdfJobs -= 1
    pendingPdfJobs -= 1
    const next = pdfWaiters.shift()
    if (next) {
      activePdfJobs += 1
      next()
    }
  }
}

async function withOperationTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new AppError('EXPORT_TIMEOUT', 'PDF 生成超时，请稍后重试。', 503))
    }, timeoutMs)
  })

  try {
    return await Promise.race([operation(), timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
