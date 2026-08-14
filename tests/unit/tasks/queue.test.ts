import { describe, expect, it } from 'vitest'
import { AppError } from '@/lib/errors'
import { enqueueDetectionTask } from '@/lib/tasks/queue'

describe('detection queue', () => {
  it('keeps expensive task concurrency at two or fewer', async () => {
    let active = 0
    let peak = 0

    const runner = async () => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 10))
      active -= 1
    }

    await Promise.all([
      enqueueDetectionTask('one', runner),
      enqueueDetectionTask('two', runner),
      enqueueDetectionTask('three', runner),
      enqueueDetectionTask('four', runner),
    ])

    expect(peak).toBeLessThanOrEqual(2)
  })

  it('throws synchronously when the pending queue is full', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const runner = async () => gate
    const pending = Array.from({ length: 12 }, (_, index) => enqueueDetectionTask(`pending-${index}`, runner))

    expect(() => enqueueDetectionTask('overflow', runner)).toThrowError(AppError)
    release()
    await Promise.all(pending)
  })
})
