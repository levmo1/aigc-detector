import { createCanvas } from '@napi-rs/canvas'
import path from 'node:path'
import { createWorker } from 'tesseract.js'
import { AppError } from '@/lib/errors'
import type { PdfDocumentLike, PdfPageLike } from './parse-pdf'

async function renderPage(page: PdfPageLike): Promise<Buffer> {
  if (!page.getViewport || !page.render) {
    throw new AppError('PDF_PAGE_RENDER_UNSUPPORTED', '当前 PDF 页面无法转换为图片进行 OCR。', 422)
  }

  const viewport = page.getViewport({ scale: 2 })
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
  const context = canvas.getContext('2d')

  await page.render({ canvasContext: context, viewport }).promise
  return canvas.toBuffer('image/png')
}

export async function ocrPdfPages(
  document: PdfDocumentLike,
  pageNumbers?: number[],
): Promise<string[]> {
  const pagesToRecognize = pageNumbers ?? Array.from({ length: document.numPages }, (_, index) => index + 1)
  const langPath = process.env.TESSERACT_LANG_PATH
    ?? path.join(process.cwd(), 'node_modules/@tesseract.js-data/chi_sim/4.0.0_best_int')
  const worker = await createWorker('chi_sim', undefined, { langPath })

  try {
    const results: string[] = []

    for (const pageNumber of pagesToRecognize) {
      const page = await document.getPage(pageNumber)
      const image = await renderPage(page)
      const result = await worker.recognize(image)
      results.push(result.data.text)
    }

    return results
  } finally {
    await worker.terminate()
  }
}
