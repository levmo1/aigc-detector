import { Document, Packer, Paragraph } from 'docx'
import { describe, expect, it } from 'vitest'
import { parseDocx } from '@/lib/documents/parse-docx'

describe('parseDocx', () => {
  it('extracts body paragraphs and creates text segments', async () => {
    const document = new Document({
      sections: [
        {
          children: [new Paragraph({ text: '第一段。' }), new Paragraph({ text: '第二段。' })],
        },
      ],
    })
    const buffer = await Packer.toBuffer(document)

    const parsed = await parseDocx(buffer)

    expect(parsed.sourceType).toBe('docx')
    expect(parsed.text).toContain('第一段。')
    expect(parsed.text).toContain('第二段。')
    expect(parsed.segments.map((segment) => segment.text)).toEqual(['第一段。', '第二段。'])
    expect(parsed.usedOcr).toBe(false)
  })
})
