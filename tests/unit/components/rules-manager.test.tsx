import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RulesManager } from '@/frontend/components/rules-manager'

const library = {
  groups: [
    {
      id: 'summary',
      name: '总结套话',
      weight: 3,
      rules: [{ pattern: '综上所述', weight: 3, note: '总结套话' }],
    },
  ],
  thresholds: { segmentAIScore: 3, segmentUncertainScore: 1 },
  features: { sentenceLengthVariance: { weight: 2, note: '句长方差' } },
}

describe('RulesManager', () => {
  it('loads and lists rule groups with their rules', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => library }))

    render(<RulesManager />)

    await waitFor(() => expect(screen.getByRole('heading', { name: '总结套话' })).toBeInTheDocument())
    expect(screen.getByText('综上所述')).toBeInTheDocument()
    expect(screen.getByText(/句长方差/)).toBeInTheDocument()
  })

  it('adds a rule to a group and saves via PUT', async () => {
    const user = userEvent.setup()
    const putMock = vi.fn().mockResolvedValue({ ok: true, json: async () => library })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => library })
      .mockImplementationOnce(putMock)
    vi.stubGlobal('fetch', fetchMock)

    render(<RulesManager />)
    await waitFor(() => expect(screen.getByRole('heading', { name: '总结套话' })).toBeInTheDocument())

    await user.type(screen.getByLabelText('新规则内容'), '不容忽视')
    await user.click(screen.getByRole('button', { name: '添加规则' }))
    await user.click(screen.getByRole('button', { name: '保存规则' }))

    await waitFor(() => expect(putMock).toHaveBeenCalled())
    const putCall = putMock.mock.calls[0]
    const body = JSON.parse(putCall[1].body as string)
    expect(body.groups[0].rules.some((rule: { pattern: string }) => rule.pattern === '不容忽视')).toBe(true)
  })

  it('previews rule hits for a sample text', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => library }))

    render(<RulesManager />)
    await waitFor(() => expect(screen.getByRole('heading', { name: '总结套话' })).toBeInTheDocument())

    await user.type(screen.getByLabelText('预览文本'), '综上所述，这是结论。')
    await user.click(screen.getByRole('button', { name: '预览检测' }))

    await waitFor(() => expect(screen.getByText('总结套话：综上所述')).toBeInTheDocument())
  })
})
