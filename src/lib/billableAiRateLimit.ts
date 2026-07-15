import { NextResponse } from 'next/server'
import { dbRateLimit, type RateLimitResult } from '@/lib/dbRateLimit'
import type { CreditAction } from '@/lib/credits'

const HOUR_MS = 60 * 60_000
const GLOBAL_BILLABLE_AI_LIMIT = 120

const ACTION_LIMITS: Partial<Record<CreditAction, number>> = {
  RUN_FULL_STRATEGY: 20,
  CAMPAIGN_GENERATION: 30,
  CREATIVE_BRIEF: 30,
  SENTINEL_REVIEW: 30,
  IMAGE_GENERATION: 30,
  WEBSITE_SCAN: 20,
  CONTENT_ANALYSIS: 30,
  BRAND_EVIDENCE_ANALYSIS: 30,
  PAID_EXECUTION_PLAN: 30,
  PAID_PACK_GENERATE: 20,
}

function blockedResponse(result: RateLimitResult): NextResponse {
  const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))
  return NextResponse.json({
    error: 'AI_RATE_LIMITED',
    message: result.message || 'Too many AI operations. Try again later. No credits were charged.',
    retryAfterSeconds,
    creditsCharged: false,
  }, {
    status: 429,
    headers: { 'Retry-After': String(retryAfterSeconds) },
  })
}

/**
 * Distributed economic-abuse guard for billable AI work. Call it only after
 * authentication and cheap input/ownership/readiness checks, immediately
 * before the credit reservation. Credits protect margin; this protects the
 * provider and database from burst abuse across serverless instances.
 */
export async function enforceBillableAiRateLimit(
  userId: string,
  action: CreditAction,
): Promise<NextResponse | null> {
  const global = await dbRateLimit(`billable-ai:${userId}`, {
    limit: GLOBAL_BILLABLE_AI_LIMIT,
    windowMs: HOUR_MS,
  })
  if (!global.ok) return blockedResponse(global)

  const actionLimit = await dbRateLimit(`billable-ai:${userId}:${action}`, {
    limit: ACTION_LIMITS[action] ?? 60,
    windowMs: HOUR_MS,
  })
  return actionLimit.ok ? null : blockedResponse(actionLimit)
}
