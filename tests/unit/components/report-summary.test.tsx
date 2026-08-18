import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ReportSummary } from '@/frontend/components/report-summary'

describe('ReportSummary', () => {
  it('shows the three coverage rates and demo disclaimer', async () => {
    render(<ReportSummary summary={{ aiRate: 42, humanRate: 38, uncertainRate: 20, scoredCharacters: 1200 }} mode="mock" />)

    await waitFor(() => expect(screen.getByText('42%')).toBeInTheDocument(), { timeout: 2000 })
    await waitFor(() => expect(screen.getByText('38%')).toBeInTheDocument(), { timeout: 2000 })
    await waitFor(() => expect(screen.getByText('20%')).toBeInTheDocument(), { timeout: 2000 })
    expect(screen.getByText('Mock 演示模式')).toBeInTheDocument()
  })

  it('shows when the report received an LLM review', () => {
    render(<ReportSummary summary={{ aiRate: 42, humanRate: 38, uncertainRate: 20, scoredCharacters: 1200 }} mode="rule" llmAssisted />)

    expect(screen.getByText('本地规则检测 + 单模型复核')).toBeInTheDocument()
  })
})
