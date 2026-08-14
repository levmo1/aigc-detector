interface RateLimitOptions {
  limit: number
  windowMs: number
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

export function createRateLimiter({ limit, windowMs }: RateLimitOptions) {
  const entries = new Map<string, RateLimitEntry>()

  return {
    check(key: string, now = Date.now()): RateLimitResult {
      for (const [entryKey, entry] of entries) {
        if (entry.resetAt <= now) entries.delete(entryKey)
      }

      const current = entries.get(key)
      if (!current || current.resetAt <= now) {
        entries.set(key, { count: 1, resetAt: now + windowMs })
        return { allowed: true, retryAfterSeconds: 0 }
      }

      if (current.count >= limit) {
        return {
          allowed: false,
          retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000),
        }
      }

      current.count += 1
      return { allowed: true, retryAfterSeconds: 0 }
    },
  }
}
