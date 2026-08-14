import { describe, expect, it } from 'vitest'
import { createRateLimiter } from '@/lib/tasks/rate-limit'

describe('rate limiter', () => {
  it('blocks requests after the configured window quota', () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 })

    expect(limiter.check('client-a').allowed).toBe(true)
    expect(limiter.check('client-a').allowed).toBe(true)
    expect(limiter.check('client-a').allowed).toBe(false)
    expect(limiter.check('client-b').allowed).toBe(true)
  })
})
