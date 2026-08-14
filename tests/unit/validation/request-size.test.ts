// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { readRequestWithinLimit, validateRequestSize } from '@/lib/validation/input'

describe('request body limits', () => {
  it('counts chunked request bodies without relying on content-length', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(22 * 1024 * 1024))
        controller.close()
      },
    })
    const requestInit = {
      method: 'POST',
      body,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' }
    const request = new Request('http://localhost/api/detections', requestInit)

    expect(() => validateRequestSize(request)).not.toThrow()
    await expect(readRequestWithinLimit(request)).rejects.toThrow(/21 MB/u)
  })
})
