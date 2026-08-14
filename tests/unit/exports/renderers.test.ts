import { describe, expect, it } from 'vitest'
import { renderDocxReport } from '@/lib/exports/render-docx'
import { renderHtmlReport } from '@/lib/exports/render-html'
import { renderPdfReport } from '@/lib/exports/render-pdf'
import type { DetectionReport } from '@/lib/domain/report'

const report: DetectionReport = {
  id: 'det_demo',
  mode: 'mock',
  sourceName: '演示论文',
  sourceType: 'text',
  text: '第一句。第二句。',
  segments: [
    { id: 's-1', text: '第一句。', start: 0, end: 4, paragraphIndex: 0, label: 'ai', confidence: 0.8, reasons: ['结构规整'], suggestions: ['补充细节'] },
  ],
  summary: { aiRate: 42, humanRate: 38, uncertainRate: 20, scoredCharacters: 1200 },
  warnings: ['样本较短，结果参考价值有限。'],
  generatedAt: '2026-08-12T00:00:00.000Z',
}

describe('report renderers', () => {
  it('renders a standalone HTML report with escaped text and summary', () => {
    const html = renderHtmlReport({
      ...report,
      text: '<论文>第一句。',
      segments: [{ ...report.segments[0], start: 4, end: 8 }],
    })

    expect(html).toContain('42%')
    expect(html).toContain('&lt;论文&gt;')
    expect(html).toContain('第一句。')
    expect(html).toContain('Mock 演示模式')
    expect(html).toContain('结构规整')
    expect(html).toContain('补充细节')
  })

  it('renders a valid DOCX zip buffer', async () => {
    const buffer = await renderDocxReport(report)

    expect(buffer.subarray(0, 2).toString('ascii')).toBe('PK')
  })

  it('passes the same report HTML to the PDF generator', async () => {
    const generator = async (html: string) => {
      expect(html).toContain('演示论文')
      return Buffer.from('%PDF-test')
    }

    await expect(renderPdfReport(report, { generatePdf: generator })).resolves.toEqual(Buffer.from('%PDF-test'))
  })
})
