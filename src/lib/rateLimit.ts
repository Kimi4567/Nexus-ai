/**
 * Nexus AI — In-memory sliding window rate limiter
 *
 * Works per-serverless-instance (sufficient for MVP).
 * Upgrade path: replace store with Upstash Redis for cross-instance limiting.
 *
 * Usage:
 *   const result = rateLimit(identifier, { limit: 10, windowMs: 60_000 })
 *   if (!result.ok) return NextResponse.json({ error: result.message }, { status: 429 })
 */

interface RateLimitStore {
  timestamps: number[]
  blocked: boolean
}

const store = new Map<string, RateLimitStore>()

// Clean stale entries every 5 minutes to avoid memory leaks
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.timestamps.length === 0 || now - entry.timestamps[entry.timestamps.length - 1] > 300_000) {
      store.delete(key)
    }
  }
}, 300_000)

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetAt: number   // epoch ms
  message: string
}

export interface RateLimitOptions {
  /** Max requests in the window */
  limit: number
  /** Window size in ms (default: 60_000 = 1 minute) */
  windowMs?: number
}

export function rateLimit(identifier: string, options: RateLimitOptions): RateLimitResult {
  const { limit, windowMs = 60_000 } = options
  const now = Date.now()
  const windowStart = now - windowMs

  let entry = store.get(identifier)
  if (!entry) {
    entry = { timestamps: [], blocked: false }
    store.set(identifier, entry)
  }

  // Slide the window — drop timestamps older than windowMs
  entry.timestamps = entry.timestamps.filter(t => t > windowStart)

  if (entry.timestamps.length >= limit) {
    const oldestInWindow = entry.timestamps[0]
    const resetAt = oldestInWindow + windowMs
    return {
      ok: false,
      remaining: 0,
      resetAt,
      message: `Too many requests. Try again in ${Math.ceil((resetAt - now) / 1000)} seconds.`,
    }
  }

  entry.timestamps.push(now)
  return {
    ok: true,
    remaining: limit - entry.timestamps.length,
    resetAt: now + windowMs,
    message: '',
  }
}

// ── Preset limiters ────────────────────────────────────────────────────────────

/** AI generation routes — 15 per minute per user */
export function aiRateLimit(userId: string) {
  return rateLimit(`ai:${userId}`, { limit: 15, windowMs: 60_000 })
}

/** Billing checkout — 5 per minute per user (prevent duplicate subscriptions) */
export function checkoutRateLimit(userId: string) {
  return rateLimit(`checkout:${userId}`, { limit: 5, windowMs: 60_000 })
}

/** Auth routes — 10 per minute per IP (prevent brute force) */
export function authRateLimit(ip: string) {
  return rateLimit(`auth:${ip}`, { limit: 10, windowMs: 60_000 })
}

/** Webhook — not rate-limited (Stripe handles that) */
