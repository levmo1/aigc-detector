import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AnnotatedText } from '@/frontend/components/annotated-text'

const sourceText = '前缀第一句。中间第二句。后缀'
const segments = [
  { id: 's-1', text: '第一句。', start: 2, end: 6, paragraphIndex: 0, label: 'ai' as const, confidence: 0.8, reasons: ['结构规整'], suggestions: ['补充细节'] },
  { id: 's-2', text: '第二句。', start: 8, end: 12, paragraphIndex: 0, label: 'human' as const, confidence: 0.8, reasons: ['节奏自然'], suggestions: ['保留细节'] },
]

describe('AnnotatedText', () => {
  it('filters segments and reports the selected segment', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<AnnotatedText text={sourceText} segments={segments} selectedId={null} onSelect={onSelect} />)

    expect(screen.getByText('前缀')).toBeInTheDocument()
    expect(screen.getByText('中间')).toBeInTheDocument()
    expect(screen.getByText('后缀')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'AI 倾向' }))
    expect(screen.getByText('第一句。')).toBeInTheDocument()
    expect(screen.queryByText('第二句。')).not.toBeInTheDocument()

    await user.click(screen.getByText('第一句。'))
    expect(onSelect).toHaveBeenCalledWith(segments[0])
  })
})
