/**
 * Nexus AI — Production-grade rate limiter backed by PostgreSQL (Supabase).
 *
 * Works across ALL serverless instances — unlike in-memory Maps which are
 * per-process and reset on every cold start.
 *
 * Algorithm: Fixed window with atomic upsert.
 *   - One row per key in RateLimitRecord table.
 *   - On each request: if windowStart is stale, reset count to 1.
 *     Otherwise atomically increment count. Reject if count > limit.
 *
 * Fail-open strategy: if DB is unavailable, the request is allowed
 * (with a warning log) so a DB hiccup doesn't take down the whole app.
 *
 * SETUP: Run `npx prisma db push` once to create the RateLimitRecord table.
 */

import { prisma } from '@/lib/prisma'

// ── In-memory fallback (used only when DB is unavailable) ─────────────────────
const memoryFallback = new Map<string, { count: number; windowStart: number }>()

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetAt: number   // epoch ms
  message: string
}

export interface RateLimitOptions {
  /** Max requests allowed in the window */
  limit: number
  /** Window duration in milliseconds */
  windowMs: number
}

/**
 * Check and increment a rate limit counter.
 * Primary: PostgreSQL via Prisma. Fallback: in-memory.
 */
export async function dbRateLimit(
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const { limit, windowMs } = options
  const now = Date.now()
  const windowStart = new Date(now)

  try {
    // ── Fetch existing record ─────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any

    const existing = await db.rateLimitRecord.findUnique({ where: { key } })
    const windowThreshold = new Date(now - windowMs)

    let newCount: number
    let recordWindowStart: Date

    if (!existing || existing.windowStart < windowThreshold) {
      // New window — upsert with count = 1
      const record = await db.rateLimitRecord.upsert({
        where: { key },
        update: { count: 1, windowStart },
        create: { key, count: 1, windowStart },
      })
      newCount = record.count
      recordWindowStart = record.windowStart
    } else {
      // Increment within the current window
      const record = await db.rateLimitRecord.update({
        where: { key },
        data: { count: { increment: 1 } },
      })
      newCount = record.count
      recordWindowStart = record.windowStart
    }

    const resetAt = recordWindowStart.getTime() + windowMs
    const remaining = Math.max(0, limit - newCount)

    if (newCount > limit) {
      return {
        ok: false,
        remaining: 0,
        resetAt,
        message: `Too many requests. Try again in ${Math.ceil((resetAt - now) / 1000)}s.`,
      }
    }

    return { ok: true, remaining, resetAt, message: '' }

  } catch (err) {
    // ── Fallback: in-memory sliding window ────────────────────────────────────
    console.warn('[dbRateLimit] DB unavailable, using in-memory fallback:', (err as Error).message)

    const entry = memoryFallback.get(key) ?? { count: 0, windowStart: now }
    if (now - entry.windowStart > windowMs) {
      entry.count = 0
      entry.windowStart = now
    }
    entry.count++
    memoryFallback.set(key, entry)

    const resetAt = entry.windowStart + windowMs
    const remaining = Math.max(0, limit - entry.count)

    if (entry.count > limit) {
      return {
        ok: false,
        remaining: 0,
        resetAt,
        message: `Too many requests. Try again in ${Math.ceil((resetAt - now) / 1000)}s.`,
      }
    }

    return { ok: true, remaining, resetAt, message: '' }
  }
}

// ── Preset limiters ────────────────────────────────────────────────────────────

/** AI generation (campaigns, strategy, content) — 20 per hour per user */
export async function aiRateLimitDb(userId: string) {
  return dbRateLimit(`ai:${userId}`, { limit: 20, windowMs: 60 * 60_000 })
}

/** Chat assistant — 60 messages per hour per user */
export async function chatRateLimitDb(userId: string) {
  return dbRateLimit(`chat:${userId}`, { limit: 60, windowMs: 60 * 60_000 })
}

/** Billing checkout — 5 per hour per user (prevent duplicate subscriptions) */
export async function checkoutRateLimitDb(userId: string) {
  return dbRateLimit(`checkout:${userId}`, { limit: 5, windowMs: 60 * 60_000 })
}

/** Image generation — 30 per hour per user */
export async function imageRateLimitDb(userId: string) {
  return dbRateLimit(`image:${userId}`, { limit: 30, windowMs: 60 * 60_000 })
}

/** Social publish — 50 per hour per user */
export async function publishRateLimitDb(userId: string) {
  return dbRateLimit(`publish:${userId}`, { limit: 50, windowMs: 60 * 60_000 })
}
