import { describe, expect, it } from 'vitest'
import { AppError } from '@/lib/errors'
import { validateDocxArchive, validateRequestSize, validateTextInput, validateUpload } from '@/lib/validation/input'

describe('validateTextInput', () => {
  it('rejects text shorter than the minimum detection length', () => {
    expect(() => validateTextInput('字'.repeat(99))).toThrowError(AppError)

    try {
      validateTextInput('字'.repeat(99))
    } catch (error) {
      expect(error).toMatchObject({ code: 'TEXT_TOO_SHORT' })
    }
  })

  it('warns when text is valid but shorter than the recommended length', () => {
    expect(validateTextInput('字'.repeat(250)).warnings).toContain('样本较短，结果参考价值有限。')
  })
})

describe('validateUpload', () => {
  it('requires a matching PDF signature', () => {
    expect(() => validateUpload({
      filename: 'paper.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('not-a-pdf'),
    })).toThrowError(AppError)
  })

  it('accepts a DOCX zip signature', () => {
    const localHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04])
    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt32LE(1, 20)
    centralHeader.writeUInt32LE(1, 24)
    const endRecord = Buffer.alloc(22)
    endRecord.writeUInt32LE(0x06054b50, 0)
    endRecord.writeUInt16LE(1, 8)
    endRecord.writeUInt16LE(1, 10)
    endRecord.writeUInt32LE(46, 12)
    endRecord.writeUInt32LE(localHeader.length, 16)

    expect(validateUpload({
      filename: 'paper.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: Buffer.concat([localHeader, centralHeader, endRecord]),
    }).warnings).toEqual([])
  })

  it('rejects a request whose declared body exceeds the upload budget', () => {
    const request = new Request('http://localhost/api/detections', {
      headers: { 'content-length': String(25 * 1024 * 1024) },
    })

    expect(() => validateRequestSize(request)).toThrowError(AppError)
    expect(() => validateRequestSize(request)).toThrowError(/21 MB/u)
  })

  it('rejects a DOCX central directory with an unsafe expansion size', async () => {
    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt32LE(1, 20)
    centralHeader.writeUInt32LE(60 * 1024 * 1024, 24)
    const endRecord = Buffer.alloc(22)
    endRecord.writeUInt32LE(0x06054b50, 0)
    endRecord.writeUInt16LE(1, 8)
    endRecord.writeUInt16LE(1, 10)
    endRecord.writeUInt32LE(46, 12)

    await expect(validateDocxArchive(Buffer.concat([centralHeader, endRecord]))).rejects.toThrowError(AppError)
  })
})
