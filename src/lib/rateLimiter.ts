export interface RateLimitResult {
  ok: boolean
  message?: string
  status: number
}

export interface RateLimiterOptions {
  windowMs: number
  maxHits: number
}

interface CounterEntry {
  count: number
  windowStart: number
}

const inMemoryStore = new Map<string, CounterEntry>()

export function createInMemoryRateLimiter(windowMs: number, maxHits: number) {
  return function rateLimit(key: string): RateLimitResult {
    const now = Date.now()
    const entry = inMemoryStore.get(key)
    if (!entry || now - entry.windowStart > windowMs) {
      inMemoryStore.set(key, { count: 1, windowStart: now })
      return { ok: true, status: 200 }
    }
    if (entry.count >= maxHits) {
      return { ok: false, message: 'Rate limit exceeded', status: 429 }
    }
    entry.count += 1
    inMemoryStore.set(key, entry)
    return { ok: true, status: 200 }
  }
}

export function createRateLimiter(windowMs: number, maxHits: number) {
  if (process.env.REDIS_URL) {
    // Future Redis-backed implementation stub.
    // Replace with a real Redis rate limiter that supports distributed count and expiry.
    return function rateLimit(key: string): RateLimitResult {
      // eslint-disable-next-line no-console
      console.warn('Redis rate limiter requested but not implemented; falling back to in-memory limiter')
      return createInMemoryRateLimiter(windowMs, maxHits)(key)
    }
  }
  return createInMemoryRateLimiter(windowMs, maxHits)
}
