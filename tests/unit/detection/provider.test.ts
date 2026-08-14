import { describe, expect, it } from 'vitest'
import { getDetectorProvider } from '@/lib/detection/provider'

describe('getDetectorProvider', () => {
  it('uses the mock provider by default', () => {
    expect(getDetectorProvider('mock').mode).toBe('mock')
  })
})
