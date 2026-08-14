import { readFileSync } from 'node:fs'
import path from 'node:path'
import { AppError } from '@/lib/errors'

const FONT_NAME = 'NotoSansSC'
const FONT_FILE = `${FONT_NAME}.ttf`

let vfsCache: Record<string, string> | null = null

function fontPath(): string {
  // 优先使用子集字体（GB2312 常用字，3.6M）；PDF_FONT_PATH 可覆盖
  return (
    process.env.PDF_FONT_PATH
    ?? path.join(process.cwd(), 'assets', 'fonts', 'NotoSansSC-subset.ttf')
  )
}

export function pdfMakeVfs(): Record<string, string> {
  if (vfsCache) return vfsCache
  try {
    vfsCache = { [FONT_FILE]: readFileSync(fontPath()).toString('base64') }
  } catch {
    throw new AppError('PDF_FONT_MISSING', 'PDF 字体文件缺失，无法生成报告。', 500)
  }
  return vfsCache
}

export function pdfMakeFonts(): Record<string, { normal: string; bold: string; italics: string; bolditalics: string }> {
  return {
    [FONT_NAME]: {
      normal: FONT_FILE,
      bold: FONT_FILE,
      italics: FONT_FILE,
      bolditalics: FONT_FILE,
    },
  }
}

export function pdfFontName(): string {
  return FONT_NAME
}
