import { normalizeText, splitIntoSegments } from './normalize'
import { ocrPdfPages } from './ocr'
import type { ParsedDocument } from './types'
import { AppError } from '@/lib/errors'
import { countInputCharacters, limits } from '@/lib/validation/input'

export interface PdfTextItem {
  str?: string
  hasEOL?: boolean
}

export function joinPdfItems(items: PdfTextItem[]): string {
  let output = ''

  for (const item of items) {
    output += item.str ?? ''
    if (item.hasEOL) output += '\n'
  }

  return output
}

export interface PdfPageLike {
  getTextContent(): Promise<{ items: PdfTextItem[] }>
  getViewport?(options: { scale: number }): { width: number; height: number }
  render?(options: { canvasContext: unknown; viewport: unknown }): { promise: Promise<void> }
}

export interface PdfDocumentLike {
  numPages: number
  getPage(pageNumber: number): Promise<PdfPageLike>
}

export interface LoadedPdfDocument {
  document: PdfDocumentLike
  destroy(): Promise<void>
}

export interface PdfParserOptions {
  loadDocument?: (buffer: Buffer) => Promise<LoadedPdfDocument>
  ocrPages?: (document: PdfDocumentLike, pageNumbers?: number[]) => Promise<string[]>
  textThreshold?: number
  perPageTextThreshold?: number
  maxPages?: number
}

const perPageTextThreshold = 20

async function loadPdfDocument(buffer: Buffer): Promise<LoadedPdfDocument> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loadingTask = getDocument({ data: new Uint8Array(buffer) })
  const document = (await loadingTask.promise) as unknown as PdfDocumentLike

  return {
    document,
    destroy: async () => {
      await loadingTask.destroy()
    },
  }
}

export async function parsePdf(buffer: Buffer, options: PdfParserOptions = {}): Promise<ParsedDocument> {
  const loaded = await (options.loadDocument ?? loadPdfDocument)(buffer)
  const { document } = loaded
  const pageThreshold = options.perPageTextThreshold ?? perPageTextThreshold

  try {
    if (options.maxPages && document.numPages > options.maxPages) {
      throw new AppError('PDF_TOO_MANY_PAGES', `PDF 超过 ${options.maxPages} 页限制。`, 413)
    }

    const perPageExtracted: string[] = []
    const emptyPageNumbers: number[] = []

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      const pageText = normalizeText(joinPdfItems(content.items))
      perPageExtracted.push(pageText)
      if (countInputCharacters(pageText) < pageThreshold) {
        emptyPageNumbers.push(pageNumber)
      }
    }

    const extractedText = normalizeText(perPageExtracted.join('\n\n'))
    const threshold = options.textThreshold ?? 100
    const extractedCharacters = countInputCharacters(extractedText)

    if (extractedCharacters > limits.maxDocumentCharacters) {
      throw new AppError('TEXT_TOO_LONG', `正文超过 ${limits.maxDocumentCharacters} 字的限制。`)
    }
    if (extractedCharacters >= threshold && emptyPageNumbers.length === 0) {
      return {
        sourceType: 'pdf',
        text: extractedText,
        segments: splitIntoSegments(extractedText),
        pageCount: document.numPages,
        usedOcr: false,
        warnings: [],
      }
    }

    let finalPages: string[]
    let warning: string
    const incompletePages: number[] = []

    if (emptyPageNumbers.length === 0) {
      const ocrTexts = await (options.ocrPages ?? ocrPdfPages)(document)
      finalPages = ocrTexts.map((pageText) => normalizeText(pageText))
      warning = '文本层可提取内容过少，已尝试 OCR。'
    } else {
      const ocrTexts = await (options.ocrPages ?? ocrPdfPages)(document, emptyPageNumbers)
      let ocrIndex = 0
      finalPages = perPageExtracted.map((pageText, index) => {
        if (emptyPageNumbers.includes(index + 1)) {
          const recognized = normalizeText(ocrTexts[ocrIndex++] ?? '')
          if (!recognized) incompletePages.push(index + 1)
          return recognized || pageText
        }
        return pageText
      })
      warning = '部分页面没有可提取的文本，已尝试 OCR。'
    }

    const ocrText = normalizeText(finalPages.join('\n\n'))

    if (!ocrText) {
      throw new AppError('PDF_TEXT_EMPTY', 'PDF 中没有识别到可检测的文字。', 422)
    }

    if (countInputCharacters(ocrText) > limits.maxDocumentCharacters) {
      throw new AppError('TEXT_TOO_LONG', `正文超过 ${limits.maxDocumentCharacters} 字的限制。`)
    }

    return {
      sourceType: 'pdf',
      text: ocrText,
      segments: splitIntoSegments(ocrText),
      pageCount: document.numPages,
      usedOcr: true,
      warnings: [warning, ...(incompletePages.length ? [`第 ${incompletePages.join('、')} 页 OCR 未识别到文字，请核对原文是否完整。`] : [])],
    }
  } finally {
    await loaded.destroy()
  }
}
