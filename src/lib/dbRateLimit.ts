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
import { randomUUID } from 'node:crypto'

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
    // One atomic UPSERT avoids the read-then-write race where two serverless
    // instances could both reset a new window to count=1 and under-count abuse.
    const db = prisma as any
    const windowThreshold = new Date(now - windowMs)
    const records: Array<{ count: number; windowStart: Date }> = await db.$queryRawUnsafe(
      `INSERT INTO "RateLimitRecord" ("id", "key", "windowStart", "count", "updatedAt")
       VALUES ($1, $2, $3, 1, $3)
       ON CONFLICT ("key") DO UPDATE SET
         "count" = CASE
           WHEN "RateLimitRecord"."windowStart" < $4 THEN 1
           ELSE "RateLimitRecord"."count" + 1
         END,
         "windowStart" = CASE
           WHEN "RateLimitRecord"."windowStart" < $4 THEN $3
           ELSE "RateLimitRecord"."windowStart"
         END,
         "updatedAt" = $3
       RETURNING "count", "windowStart"`,
      randomUUID(),
      key,
      windowStart,
      windowThreshold,
    )
    const record = records[0]
    if (!record) throw new Error('rate_limit_upsert_returned_no_row')
    const newCount = record.count
    const recordWindowStart = new Date(record.windowStart)

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

/** Signed upload sessions — limits orphaned Cloudinary assets and DB spam. */
export async function uploadSessionRateLimitDb(userId: string) {
  return dbRateLimit(`upload-session:${userId}`, { limit: 30, windowMs: 60 * 60_000 })
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
