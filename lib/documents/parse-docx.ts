import mammoth from 'mammoth'
import { AppError } from '@/lib/errors'
import { countInputCharacters, limits, validateDocxArchive } from '@/lib/validation/input'
import { parseTextDocument } from './normalize'
import type { ParsedDocument } from './types'

export async function parseDocx(buffer: Buffer): Promise<ParsedDocument> {
  await validateDocxArchive(buffer)
  const result = await mammoth.extractRawText({ buffer })
  if (countInputCharacters(result.value) > limits.maxDocumentCharacters) {
    throw new AppError('TEXT_TOO_LONG', `正文超过 ${limits.maxDocumentCharacters} 字的限制。`)
  }
  const parsed = parseTextDocument(result.value, 'docx')
  const warnings = result.messages.map((message) => message.message)

  return {
    ...parsed,
    warnings,
  }
}
