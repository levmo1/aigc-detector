import { describe, expect, it, vi } from 'vitest'
import { parsePdf, joinPdfItems, type PdfDocumentLike } from '@/lib/documents/parse-pdf'

describe('joinPdfItems', () => {
  it('preserves line breaks marked by hasEOL', () => {
    expect(joinPdfItems([
      { str: '一、引言', hasEOL: true },
      { str: '正文第一句。', hasEOL: true },
      { str: '正文第二句。' },
    ])).toBe('一、引言\n正文第一句。\n正文第二句。')
  })
})

const pageWithText = (text: string) => ({
  getTextContent: async () => ({ items: text ? [{ str: text }] : [] }),
})

const loadAs = (document: PdfDocumentLike, destroy = vi.fn().mockResolvedValue(undefined)) => ({
  document,
  destroy,
})

describe('parsePdf', () => {
  it('extracts text from a PDF document without OCR when enough text exists', async () => {
    const source = '这是一段足够长的文本，用来验证文本型 PDF 的提取流程。'.repeat(12)
    const document: PdfDocumentLike = {
      numPages: 1,
      getPage: async () => pageWithText(source),
    }

    const parsed = await parsePdf(Buffer.from('pdf'), {
      loadDocument: async () => loadAs(document),
    })

    expect(parsed.text).toContain(source)
    expect(parsed.pageCount).toBe(1)
    expect(parsed.usedOcr).toBe(false)
  })

  it('falls back to OCR when every page lacks a text layer', async () => {
    const document: PdfDocumentLike = {
      numPages: 1,
      getPage: async () => pageWithText(''),
    }

    const parsed = await parsePdf(Buffer.from('scanned-pdf'), {
      loadDocument: async () => loadAs(document),
      ocrPages: async () => ['扫描 PDF 中识别出的文字。'],
    })

    expect(parsed.text).toContain('扫描 PDF 中识别出的文字。')
    expect(parsed.usedOcr).toBe(true)
    expect(parsed.warnings).toContain('部分页面没有可提取的文本，已尝试 OCR。')
  })

  it('recognizes only the pages without a text layer', async () => {
    const fullText = '这一页有完整的文本层。'.repeat(30)
    const document: PdfDocumentLike = {
      numPages: 3,
      getPage: async (pageNumber) => (
        pageNumber === 2 ? pageWithText('') : pageWithText(fullText)
      ),
    }
    const ocrPages = vi.fn().mockResolvedValue(['第二页 OCR 结果。'])

    const parsed = await parsePdf(Buffer.from('mixed-pdf'), {
      loadDocument: async () => loadAs(document),
      ocrPages,
    })

    expect(ocrPages).toHaveBeenCalledWith(document, [2])
    expect(parsed.text).toContain(fullText)
    expect(parsed.text).toContain('第二页 OCR 结果。')
    expect(parsed.usedOcr).toBe(true)
  })

  it('destroys the loaded document after parsing', async () => {
    const document: PdfDocumentLike = {
      numPages: 1,
      getPage: async () => pageWithText('字'.repeat(200)),
    }
    const destroy = vi.fn().mockResolvedValue(undefined)

    await parsePdf(Buffer.from('pdf'), {
      loadDocument: async () => ({ document, destroy }),
    })

    expect(destroy).toHaveBeenCalledOnce()
  })

  it('reports PDF_TEXT_EMPTY when OCR returns no text', async () => {
    const document: PdfDocumentLike = {
      numPages: 1,
      getPage: async () => pageWithText(''),
    }

    await expect(parsePdf(Buffer.from('blank-pdf'), {
      loadDocument: async () => loadAs(document),
      ocrPages: async () => [''],
    })).rejects.toMatchObject({ code: 'PDF_TEXT_EMPTY' })
  })
})

describe('parsePdf with real pdfjs', () => {
  it('releases the loading task after parsing a real PDF', async () => {
    const pdf = makeMinimalPdf()
    const parsed = await parsePdf(pdf, {
      ocrPages: async () => ['识别出的文字'.repeat(10)],
    })

    expect(parsed.pageCount).toBe(1)
    expect(parsed.usedOcr).toBe(true)
  })

  it('uses loadingTask.destroy to release pdfjs resources', async () => {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const loadingTask = getDocument({ data: new Uint8Array(makeMinimalPdf()) })
    const document = await loadingTask.promise

    expect((document as unknown as { destroy?: unknown }).destroy).toBeUndefined()
    await loadingTask.destroy()
    expect(loadingTask.destroyed).toBe(true)
  })
})

function makeMinimalPdf(): Buffer {
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Contents 4 0 R >>\nendobj\n',
    '4 0 obj\n<< /Length 0 >>\nstream\n\nendstream\nendobj\n',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  for (const object of objects) {
    offsets.push(pdf.length)
    pdf += object
  }
  const xrefPosition = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPosition}\n%%EOF\n`
  return Buffer.from(pdf, 'ascii')
}

it('keeps sparse text and warns when OCR misses a page in a mixed PDF', async () => {
  const document: PdfDocumentLike = {
    numPages: 2,
    getPage: async (page) => pageWithText(page === 1 ? '正文内容。'.repeat(40) : '图表说明'),
  }
  const parsed = await parsePdf(Buffer.from('mixed'), {
    loadDocument: async () => loadAs(document), ocrPages: async () => [''],
  })
  expect(parsed.text).toContain('图表说明')
  expect(parsed.warnings.join('')).toContain('第 2 页 OCR 未识别到文字')
})
