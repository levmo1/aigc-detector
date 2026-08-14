import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HomePage from '@/frontend/pages/home'
import { describe, expect, it, vi } from 'vitest'

describe('home page', () => {
  it('shows both text and file entry points', () => {
    render(<HomePage />)

    expect(screen.getByRole('tab', { name: '粘贴文字' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '上传文件' })).toBeInTheDocument()
  })

  it('keeps a processing error visible after returning to the form', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: RequestInfo | URL) => {
      if (String(input).includes('/api/status')) {
        return Promise.resolve(new Response(JSON.stringify({ label: 'Mock 演示模式' }), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({ error: { message: '样例错误' } }), { status: 400 }))
    }))

    render(<HomePage />)
    await user.type(screen.getByRole('textbox', { name: '论文正文' }), '这是一段用于错误提示测试的正文。'.repeat(12))
    await user.click(screen.getByRole('button', { name: '开始检测' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('样例错误'))
  })
})
