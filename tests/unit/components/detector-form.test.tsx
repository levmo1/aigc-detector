import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DetectorForm } from '@/frontend/components/detector-form'

describe('DetectorForm', () => {
  it('submits pasted text and reports the created task id', async () => {
    const user = userEvent.setup()
    const onSubmitted = vi.fn()
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'det_demo', status: 'queued' }), { status: 202 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<DetectorForm onSubmitted={onSubmitted} />)
    await user.type(screen.getByRole('textbox', { name: '论文正文' }), '这是一段足够长的测试论文正文。'.repeat(12))
    await user.click(screen.getByRole('button', { name: '开始检测' }))

    await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith('det_demo'))
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:3210/api/detections', expect.objectContaining({ method: 'POST' }))
  })

  it('shows the selected file before submitting', async () => {
    const user = userEvent.setup()
    render(<DetectorForm onSubmitted={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: '上传文件' }))

    const file = new File(['%PDF-demo'], '论文样例.pdf', { type: 'application/pdf' })
    await user.upload(screen.getByLabelText('上传 Word 或 PDF'), file)

    expect(screen.getByText('论文样例.pdf')).toBeInTheDocument()
  })

  it('highlights the drop zone while dragging a file over it', async () => {
    const user = userEvent.setup()
    render(<DetectorForm onSubmitted={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: '上传文件' }))

    const dropZone = screen.getByLabelText('上传 Word 或 PDF').closest('label')!
    expect(dropZone.classList.contains('is-dragging')).toBe(false)

    fireEvent.dragOver(dropZone)
    expect(dropZone.classList.contains('is-dragging')).toBe(true)

    fireEvent.dragLeave(dropZone)
    expect(dropZone.classList.contains('is-dragging')).toBe(false)
  })

  it('selects a file dropped onto the drop zone', async () => {
    const user = userEvent.setup()
    render(<DetectorForm onSubmitted={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: '上传文件' }))

    const file = new File(['%PDF-demo'], '拖入样例.pdf', { type: 'application/pdf' })
    const dropZone = screen.getByLabelText('上传 Word 或 PDF').closest('label')!
    fireEvent.drop(dropZone, { dataTransfer: { files: [file], items: [] } })

    expect(screen.getByText('拖入样例.pdf')).toBeInTheDocument()
  })
})
