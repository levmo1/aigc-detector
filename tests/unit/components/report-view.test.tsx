import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReportView } from '@/frontend/components/report-view'

describe('ReportView', () => {
  it('renders a ready report with summary and highlighted text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'det_demo',
        status: 'ready',
        stage: '报告已生成',
        progress: 100,
        report: {
          id: 'det_demo',
          mode: 'mock',
          sourceName: '演示论文',
          sourceType: 'text',
          text: '第一句。第二句。',
          segments: [
            { id: 's-1', text: '第一句。', start: 0, end: 4, paragraphIndex: 0, label: 'ai', confidence: 0.8, reasons: ['结构规整'], suggestions: ['补充细节'] },
            { id: 's-2', text: '第二句。', start: 4, end: 8, paragraphIndex: 0, label: 'human', confidence: 0.8, reasons: ['节奏自然'], suggestions: ['保留细节'] },
          ],
          summary: { aiRate: 50, humanRate: 50, uncertainRate: 0, scoredCharacters: 8 },
          warnings: [],
          generatedAt: '2026-08-12T00:00:00.000Z',
        },
      }),
    }))

    render(<ReportView taskId="det_demo" />)

    await waitFor(() => expect(screen.getByText('Mock 演示模式')).toBeInTheDocument())
    expect(screen.getByText('演示论文')).toBeInTheDocument()
    expect(screen.getByText('第一句。')).toBeInTheDocument()
  })

  it('keeps the source text visible when no segments were returned', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'det_empty',
        status: 'ready',
        report: {
          id: 'det_empty',
          mode: 'mock',
          sourceName: '空标注论文',
          sourceType: 'text',
          text: '没有被切成片段的原文',
          segments: [],
          summary: { aiRate: 0, humanRate: 0, uncertainRate: 100, scoredCharacters: 0 },
          warnings: [],
          generatedAt: '2026-08-12T00:00:00.000Z',
        },
      }),
    }))

    render(<ReportView taskId="det_empty" />)

    await waitFor(() => expect(screen.getByText('没有被切成片段的原文')).toBeInTheDocument())
  })
})
