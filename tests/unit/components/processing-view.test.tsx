import { render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProcessingView } from '@/frontend/components/processing-view'

describe('ProcessingView', () => {
  it('calls onReady when the task report is ready', async () => {
    const onReady = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        id: 'det_demo',
        status: 'ready',
        stage: '报告已生成',
        progress: 100,
      }), { status: 200 }),
    ))

    render(<ProcessingView taskId="det_demo" onReady={onReady} onError={vi.fn()} />)

    await waitFor(() => expect(onReady).toHaveBeenCalledWith('det_demo'))
  })
})
