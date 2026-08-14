import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HistoryView } from '@/frontend/components/history-view'

const historyResponse = {
  maxCount: 50,
  items: [
    {
      id: 'det_1',
      status: 'ready',
      sourceName: '人工智能在医疗领域的应用研究.pdf',
      sourceType: 'pdf',
      mode: 'rule',
      summary: { aiRate: 11, humanRate: 83, uncertainRate: 6, scoredCharacters: 3389 },
      error: null,
      createdAt: 1786550000000,
      updatedAt: 1786550030000,
    },
    {
      id: 'det_2',
      status: 'error',
      sourceName: '粘贴文本',
      sourceType: 'text',
      mode: 'rule',
      summary: null,
      error: { code: 'PDF_TEXT_EMPTY', message: 'PDF 中没有识别到可检测的文字。' },
      createdAt: 1786549000000,
      updatedAt: 1786549005000,
    },
  ],
}

const itemByPath = (id: string) => historyResponse.items.find((item) => item.id === id)!

describe('HistoryView', () => {
  it('lists past detections with summary and source names', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => historyResponse }))

    render(<HistoryView />)

    await waitFor(() => expect(screen.getByText('人工智能在医疗领域的应用研究.pdf')).toBeInTheDocument())
    expect(screen.getByText(/AI 11%/)).toBeInTheDocument()
    expect(screen.getByText('PDF 中没有识别到可检测的文字。')).toBeInTheDocument()
    console.log('LIST HTML:', document.querySelector('.history-list')?.innerHTML.slice(0, 800))
  })

  it('updates the max count via PUT', async () => {
    const user = userEvent.setup()
    const putMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ maxCount: 20 }) })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => historyResponse })
      .mockImplementationOnce(putMock)
    vi.stubGlobal('fetch', fetchMock)

    render(<HistoryView />)
    await waitFor(() => expect(screen.getByText('人工智能在医疗领域的应用研究.pdf')).toBeInTheDocument())

    await user.clear(screen.getByLabelText('保存记录数'))
    await user.type(screen.getByLabelText('保存记录数'), '20')
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(putMock).toHaveBeenCalled())
    const body = JSON.parse(putMock.mock.calls[0][1].body as string)
    expect(body.maxCount).toBe(20)
  })

  it('deletes an entry via the delete button', async () => {
    const user = userEvent.setup()
    const deleteMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => historyResponse })
      .mockImplementationOnce(deleteMock)
    vi.stubGlobal('fetch', fetchMock)

    render(<HistoryView />)
    await waitFor(() => expect(screen.getByText('人工智能在医疗领域的应用研究.pdf')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: '删除 人工智能在医疗领域的应用研究.pdf' }))

    await waitFor(() => expect(deleteMock).toHaveBeenCalled())
    expect(deleteMock.mock.calls[0][0]).toContain('/api/history/det_1')
  })

  it('links to the report page for ready items', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => historyResponse }))

    render(<HistoryView />)

    await waitFor(() => expect(screen.getByText('人工智能在医疗领域的应用研究.pdf')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /查看报告/ })).toHaveAttribute('href', '/report/det_1')
  })
})
