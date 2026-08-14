import { AppError } from '@/lib/errors'
import JSZip from 'jszip'

export const limits = {
  maxUploadBytes: positiveEnv('MAX_UPLOAD_BYTES', 20 * 1024 * 1024),
  maxRequestBytes: positiveEnv('MAX_REQUEST_BYTES', 21 * 1024 * 1024),
  maxDocxExpandedBytes: positiveEnv('MAX_DOCX_EXPANDED_BYTES', 50 * 1024 * 1024),
  maxDocumentCharacters: positiveEnv('MAX_DOCUMENT_CHARACTERS', 100_000),
  maxPdfPages: positiveEnv('MAX_PDF_PAGES', 50),
  minimumCharacters: 100,
  recommendedCharacters: 300,
}

function positiveEnv(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export interface FileInput {
  filename: string
  mimeType: string
  buffer: Buffer
}

export type DetectionInput =
  | { kind: 'text'; text: string; sourceName: string; warnings: string[] }
  | ({ kind: 'file'; sourceName: string; warnings: string[] } & FileInput)

export function countInputCharacters(text: string): number {
  return Array.from(text).filter((character) => !/\s/u.test(character)).length
}

export function validateRequestSize(request: Request): void {
  const contentLength = Number(request.headers.get('content-length'))

  if (Number.isFinite(contentLength) && contentLength > limits.maxRequestBytes) {
    throw new AppError('FILE_TOO_LARGE', `请求体超过 ${formatBytes(limits.maxRequestBytes)} 大小限制。`)
  }
}

export async function readRequestWithinLimit(request: Request): Promise<Request> {
  validateRequestSize(request)
  if (!request.body) return request

  const reader = request.body.getReader()
  const chunks: Buffer[] = []
  let total = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      total += value.byteLength
      if (total > limits.maxRequestBytes) {
        await reader.cancel()
        throw new AppError('FILE_TOO_LARGE', `请求体超过 ${formatBytes(limits.maxRequestBytes)} 大小限制。`)
      }
      chunks.push(Buffer.from(value))
    }
  } finally {
    reader.releaseLock()
  }

  const requestInit = {
    method: request.method,
    headers: request.headers,
    body: Buffer.concat(chunks),
    duplex: 'half',
  } as RequestInit & { duplex: 'half' }

  return new Request(request.url, requestInit)
}

export function validateTextInput(text: string): { warnings: string[] } {
  const characterCount = countInputCharacters(text)

  if (characterCount === 0) {
    throw new AppError('TEXT_REQUIRED', '请输入或粘贴需要检测的正文。')
  }

  if (characterCount < limits.minimumCharacters) {
    throw new AppError('TEXT_TOO_SHORT', '正文少于 100 字，暂时无法进行检测。')
  }

  if (characterCount > limits.maxDocumentCharacters) {
    throw new AppError('TEXT_TOO_LONG', `正文超过 ${limits.maxDocumentCharacters} 字的限制。`)
  }

  return {
    warnings: characterCount < limits.recommendedCharacters
      ? ['样本较短，结果参考价值有限。']
      : [],
  }
}

function hasZipSignature(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
}

function hasPdfSignature(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString('ascii') === '%PDF-'
}

export function validateUpload(input: FileInput): { warnings: string[] } {
  if (input.buffer.length === 0) {
    throw new AppError('FILE_REQUIRED', '上传的文件为空。')
  }

  if (input.buffer.length > limits.maxUploadBytes) {
    throw new AppError('FILE_TOO_LARGE', `文件超过 ${formatBytes(limits.maxUploadBytes)} 大小限制。`)
  }

  const extension = input.filename.toLowerCase().split('.').pop()

  if (extension !== 'docx' && extension !== 'pdf') {
    throw new AppError('UNSUPPORTED_FILE', '只支持 Word（.docx）和 PDF 文件。')
  }

  const validSignature = extension === 'pdf'
    ? hasPdfSignature(input.buffer)
    : hasZipSignature(input.buffer)

  if (!validSignature) {
    throw new AppError('FILE_SIGNATURE_INVALID', '文件内容与扩展名不匹配，无法安全解析。')
  }

  return { warnings: [] }
}

export async function validateDocxArchive(buffer: Buffer): Promise<void> {
  const endSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06])
  const endOffset = buffer.lastIndexOf(endSignature)
  if (endOffset < 0 || endOffset + 22 > buffer.length) {
    throw new AppError('FILE_SIGNATURE_INVALID', 'Word 文件结构不完整，无法安全解析。')
  }

  const entryCount = buffer.readUInt16LE(endOffset + 10)
  if (entryCount === 0xffff) {
    throw new AppError('FILE_SIGNATURE_INVALID', '暂不支持 ZIP64 格式的 Word 文件。')
  }
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16)
  let cursor = centralDirectoryOffset
  let expandedBytes = 0

  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new AppError('FILE_SIGNATURE_INVALID', 'Word 文件目录结构不完整，无法安全解析。')
    }

    const compressedBytes = buffer.readUInt32LE(cursor + 20)
    const uncompressedBytes = buffer.readUInt32LE(cursor + 24)
    if (uncompressedBytes === 0xffffffff || compressedBytes === 0xffffffff) {
      throw new AppError('FILE_TOO_LARGE', `Word 文件解压后的内容超过 ${formatBytes(limits.maxDocxExpandedBytes)} 安全限制。`)
    }

    expandedBytes += uncompressedBytes
    if (
      expandedBytes > limits.maxDocxExpandedBytes
      || (compressedBytes > 0 && uncompressedBytes / compressedBytes > 1000)
    ) {
      throw new AppError('FILE_TOO_LARGE', `Word 文件解压后的内容超过 ${formatBytes(limits.maxDocxExpandedBytes)} 安全限制。`)
    }

    const filenameBytes = buffer.readUInt16LE(cursor + 28)
    const extraBytes = buffer.readUInt16LE(cursor + 30)
    const commentBytes = buffer.readUInt16LE(cursor + 32)
    cursor += 46 + filenameBytes + extraBytes + commentBytes
  }

  let archive: JSZip
  try {
    archive = await JSZip.loadAsync(buffer)
  } catch {
    throw new AppError('FILE_SIGNATURE_INVALID', 'Word 文件压缩结构无法读取。')
  }

  let actualExpandedBytes = 0
  for (const file of Object.values(archive.files)) {
    if (file.dir) continue

    const stream = file.nodeStream('nodebuffer')
    try {
      actualExpandedBytes += await countNodeStream(stream, limits.maxDocxExpandedBytes - actualExpandedBytes)
    } finally {
      destroyNodeStream(stream)
    }
  }
}

function countNodeStream(stream: NodeJS.ReadableStream, remainingBytes: number): Promise<number> {
  return new Promise((resolve, reject) => {
    let total = 0
    let settled = false

    const fail = (error: unknown) => {
      if (settled) return
      settled = true
      destroyNodeStream(stream)
      reject(error)
    }

    stream.on('data', (chunk: Buffer | Uint8Array | string) => {
      total += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.byteLength
      if (total > remainingBytes) {
        fail(new AppError('FILE_TOO_LARGE', `Word 文件解压后的内容超过 ${formatBytes(limits.maxDocxExpandedBytes)} 安全限制。`))
      }
    })
    stream.on('end', () => {
      if (settled) return
      settled = true
      resolve(total)
    })
    stream.on('error', fail)
  })
}

function destroyNodeStream(stream: NodeJS.ReadableStream): void {
  ;(stream as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.()
}

function formatBytes(bytes: number): string {
  return `${Math.ceil(bytes / (1024 * 1024))} MB`
}
