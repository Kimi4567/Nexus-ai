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

/** AI suggest (free ops: ad-suggest, campaign-suggest, brand-suggest) — 30 per hour per user */
export async function suggestRateLimitDb(userId: string) {
  return dbRateLimit(`suggest:${userId}`, { limit: 30, windowMs: 60 * 60_000 })
}

/**
 * Background Brand Brain learning — COGS guard.
 *
 * Brain-learning calls are NOT billed to user credits, so without a cap they
 * are uncovered cost that scales with activity (~$0.015 / gpt-4o call). This
 * limits background learning to a sane number per workspace per day so a busy
 * or abusive workspace can't run unbounded system AI spend.
 *
 * Default: 30 / workspace / day. Adjust BRAIN_LEARNING_DAILY_CAP env to tune
 * without a deploy.
 */
export const BRAIN_LEARNING_DAILY_CAP = (() => {
  const n = parseInt(process.env.BRAIN_LEARNING_DAILY_CAP || '', 10)
  return Number.isFinite(n) && n > 0 ? n : 30
})()

export async function brainLearningCapDb(workspaceId: string) {
  return dbRateLimit(`brainlearn:${workspaceId}`, {
    limit: BRAIN_LEARNING_DAILY_CAP,
    windowMs: 24 * 60 * 60_000,
  })
}

// ── Sync in-memory presets (backward-compat aliases) ─────────────────────────
// Used by routes that need synchronous rate limiting without DB overhead.

interface MemEntry { timestamps: number[] }
const _syncStore = new Map<string, MemEntry>()

function _syncLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const entry = _syncStore.get(key) ?? { timestamps: [] }
  entry.timestamps = entry.timestamps.filter(t => t > now - windowMs)
  if (entry.timestamps.length >= limit) return false
  entry.timestamps.push(now)
  _syncStore.set(key, entry)
  return true
}

/** In-memory sync — AI generation routes (15/min per user) */
export function aiRateLimit(userId: string): boolean {
  return _syncLimit(`sync_ai:${userId}`, 15, 60_000)
}

/** In-memory sync — Checkout (5/min per user) */
export function checkoutRateLimit(userId: string): boolean {
  return _syncLimit(`sync_checkout:${userId}`, 5, 60_000)
}

/** In-memory sync — Auth routes (10/min per IP) */
export function authRateLimit(ip: string): boolean {
  return _syncLimit(`sync_auth:${ip}`, 10, 60_000)
}

/** Factory — creates a reusable in-memory limiter (for upload routes) */
export function createInMemoryRateLimiter(windowMs: number, maxHits: number) {
  return function limit(key: string) {
    const ok = _syncLimit(`factory:${key}`, maxHits, windowMs)
    return { ok, message: ok ? '' : 'Rate limit exceeded', status: ok ? 200 : 429 }
  }
}

/** Factory — uses in-memory (Redis stub kept for future upgrade) */
export function createRateLimiter(windowMs: number, maxHits: number) {
  return createInMemoryRateLimiter(windowMs, maxHits)
}
