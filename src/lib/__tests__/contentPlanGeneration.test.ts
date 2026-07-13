/**
 * Trust Sprint #5 — content-plan generation reliability.
 *
 * The bug: the single gpt-4o content-plan call had no HTTP-error handling and no
 * retry. A transient provider hiccup left `choices` undefined, the parse produced
 * [], and the route returned 502 — even though an immediate retry succeeds.
 *
 * These tests pin the new behaviour:
 *  1. a valid response yields the expected number of posts;
 *  2. a transient failure then success retries safely and returns ONE post set
 *     (no duplication / no second charge — posts are written only after success);
 *  3/5. a failed generation produces a clear 502 with the refund flag preserved;
 *  4. malformed / truncated output fails clearly and is NOT retried;
 *  6/7. PR #4's caption + video-slot mapping is intact — no English placeholders.
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import {
  parseContentPlanResponse,
  generateContentPlanWithRetry,
  contentPlanFailureResponse,
  isRetryableFailure,
  extractPostsArray,
  resolveContentPlanSlotScope,
  type FetchLikeResponse,
} from '@/lib/contentPlanGeneration'
import { resolvePostCaption } from '@/lib/contentPlanCaption'

// ── Response builders ─────────────────────────────────────────────────────────

const makePosts = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ index: i, platform: 'META', caption: `post ${i}` }))

const okResp = (posts: any[]): FetchLikeResponse => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ posts }) } }] }),
})

const httpErr = (status = 500): FetchLikeResponse => ({
  ok: false,
  status,
  json: async () => ({ error: { message: 'transient provider error' } }),
})

const truncatedResp = (): FetchLikeResponse => ({
  ok: true,
  status: 200,
  // finish_reason=length + incomplete JSON — the real truncation signature
  json: async () => ({ choices: [{ finish_reason: 'length', message: { content: '{"posts":[{"index":0,' } }] }),
})

const malformedResp = (): FetchLikeResponse => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: 'totally not json' } }] }),
})

const FAST = { sleep: async () => {} }
const PLACEHOLDER = /Post \d+ for|Facebook \/ Instagram/i

// ── 1. Successful generation → expected count ─────────────────────────────────

describe('parseContentPlanResponse', () => {
  it('1. parses a valid wrapped response into the expected number of posts', () => {
    const res = parseContentPlanResponse({
      choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ posts: makePosts(18) }) } }],
    })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.posts).toHaveLength(18)
  })

  it('unwraps the array regardless of the wrapper key', () => {
    expect(extractPostsArray({ anything: makePosts(3) })).toHaveLength(3)
    expect(extractPostsArray(makePosts(2))).toHaveLength(2)
    expect(extractPostsArray({})).toHaveLength(0)
  })

  // ── 4. Malformed / truncated fail clearly ───────────────────────────────────
  it('4a. truncated output (finish_reason=length) fails clearly as "truncated"', () => {
    const res = parseContentPlanResponse({ choices: [{ finish_reason: 'length', message: { content: '{"posts":[{' } }] })
    expect(res).toEqual({ ok: false, reason: 'truncated' })
  })

  it('4b. malformed (non-JSON) content fails clearly as "malformed"', () => {
    const res = parseContentPlanResponse({ choices: [{ finish_reason: 'stop', message: { content: 'not json' } }] })
    expect(res).toEqual({ ok: false, reason: 'malformed' })
  })

  it('4c. missing choices / empty content is classified "empty" (transient)', () => {
    expect(parseContentPlanResponse({})).toEqual({ ok: false, reason: 'empty' })
    expect(parseContentPlanResponse({ choices: [{ message: { content: '   ' } }] })).toEqual({ ok: false, reason: 'empty' })
    expect(parseContentPlanResponse({ choices: [{ message: { content: '{"posts":[]}' } }] })).toEqual({ ok: false, reason: 'empty' })
  })

  it('only transient failures are retryable', () => {
    expect(isRetryableFailure('provider')).toBe(true)
    expect(isRetryableFailure('empty')).toBe(true)
    expect(isRetryableFailure('truncated')).toBe(false)
    expect(isRetryableFailure('malformed')).toBe(false)
  })
})

describe('generateContentPlanWithRetry', () => {
  it('1. succeeds on the first attempt for a healthy provider', async () => {
    const doFetch = vi.fn(async () => okResp(makePosts(18)))
    const { result, attempts } = await generateContentPlanWithRetry(doFetch, FAST)
    expect(attempts).toBe(1)
    expect(doFetch).toHaveBeenCalledTimes(1)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.posts).toHaveLength(18)
  })

  // ── 2. Retry after failure does not duplicate ────────────────────────────────
  it('2. retries a transient failure then succeeds — returns ONE post set, never doubled', async () => {
    const doFetch = vi
      .fn<() => Promise<FetchLikeResponse>>()
      .mockResolvedValueOnce(httpErr(429))     // transient first
      .mockResolvedValueOnce(okResp(makePosts(18)))
    const { result, attempts } = await generateContentPlanWithRetry(doFetch, FAST)
    expect(attempts).toBe(2)
    expect(doFetch).toHaveBeenCalledTimes(2)
    expect(result.ok).toBe(true)
    // Exactly the successful payload — 18, NOT 36. Posts are written only once,
    // after success, so the retry cannot duplicate the plan or re-charge.
    if (result.ok) expect(result.posts).toHaveLength(18)
  })

  it('recovers from a thrown network error on the first attempt', async () => {
    const doFetch = vi
      .fn<() => Promise<FetchLikeResponse>>()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(okResp(makePosts(12)))
    const { result, attempts } = await generateContentPlanWithRetry(doFetch, FAST)
    expect(attempts).toBe(2)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.posts).toHaveLength(12)
  })

  // ── 5. Transient failure returns a clear error after exhausting retries ──────
  it('5. exhausts retries on persistent transient failure and reports "provider"', async () => {
    const doFetch = vi.fn(async () => httpErr(503))
    const { result, attempts } = await generateContentPlanWithRetry(doFetch, { ...FAST, maxAttempts: 2 })
    expect(attempts).toBe(2)
    expect(doFetch).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ ok: false, reason: 'provider' })
  })

  it('4d. does NOT retry deterministic failures (truncated / malformed)', async () => {
    const truncated = vi.fn(async () => truncatedResp())
    const t = await generateContentPlanWithRetry(truncated, FAST)
    expect(t.attempts).toBe(1)
    expect(truncated).toHaveBeenCalledTimes(1)
    expect(t.result).toEqual({ ok: false, reason: 'truncated' })

    const malformed = vi.fn(async () => malformedResp())
    const m = await generateContentPlanWithRetry(malformed, FAST)
    expect(malformed).toHaveBeenCalledTimes(1)
    expect(m.result).toEqual({ ok: false, reason: 'malformed' })
  })
})

// ── 3 & 5. Clear, refund-preserving HTTP failure ──────────────────────────────

describe('contentPlanFailureResponse', () => {
  it('3. always 502 and passes the refund flag through unchanged', () => {
    expect(contentPlanFailureResponse('provider', true)).toEqual({
      status: 502,
      body: { error: expect.any(String), reason: 'provider', refunded: true },
    })
    expect(contentPlanFailureResponse('provider', false).body.refunded).toBe(false)
  })

  it('5. transient + truncated give clear, distinct, user-safe messages', () => {
    const provider = contentPlanFailureResponse('provider', true)
    const truncated = contentPlanFailureResponse('truncated', true)
    expect(provider.body.error).toMatch(/no posts were produced/i)
    expect(truncated.body.error).toMatch(/incomplete output/i)
    expect(provider.body.error).not.toEqual(truncated.body.error)
  })
})

// ── 6 & 7. PR #4 caption + video mapping still intact ─────────────────────────

describe('PR#4 caption integrity remains intact', () => {
  const arOpts = { isArabic: true, brand: 'عيادة ابتسامة', hint: 'احصل على ابتسامة مشرقة' }

  it('6. video slots still use videoCaption; non-video still use caption', () => {
    expect(resolvePostCaption({ videoCaption: 'شاهد الفيديو الجديد' }, arOpts)).toBe('شاهد الفيديو الجديد')
    expect(resolvePostCaption({ caption: 'منشور تعليمي' }, arOpts)).toBe('منشور تعليمي')
  })

  it('7. a missing caption never returns the old English placeholder', () => {
    const out = resolvePostCaption({}, arOpts)
    expect(out).not.toMatch(PLACEHOLDER)
    expect(out).toContain('عيادة ابتسامة')
    expect(/[؀-ۿ]/.test(out)).toBe(true)
  })
})

describe('resolveContentPlanSlotScope', () => {
  it('uses the saved strategy deliverables count instead of the plan default', () => {
    const scope = resolveContentPlanSlotScope(
      {
        strategyType: 'organic',
        strategyOrder: { strategyType: 'organic' },
        strategyDeliverables: { organicPostCount: 7 },
      },
      { postsPerCampaign: 16, videoSlotsPerMonth: 2 },
    )

    expect(scope).toMatchObject({
      canGenerate: true,
      source: 'strategy-deliverables',
      imagePosts: 5,
      videoSlots: 2,
      totalSlots: 7,
    })
  })

  it('falls back to plan quota only for legacy campaigns without a saved order', () => {
    const scope = resolveContentPlanSlotScope({}, { postsPerCampaign: 8, videoSlotsPerMonth: 0 })

    expect(scope).toMatchObject({
      canGenerate: true,
      source: 'plan-quota',
      imagePosts: 8,
      videoSlots: 0,
      totalSlots: 8,
    })
  })

  it('blocks paid planning-only strategies before content-plan generation', () => {
    const scope = resolveContentPlanSlotScope(
      {
        strategyType: 'paid',
        strategyOrder: { strategyType: 'paid' },
        strategyDeliverables: { organicPostCount: 0 },
      },
      { postsPerCampaign: 8, videoSlotsPerMonth: 0 },
    )

    expect(scope).toMatchObject({
      canGenerate: false,
      source: 'strategy-deliverables',
      blockedReason: 'paid-planning-only',
      totalSlots: 0,
    })
  })

  it('blocks order-bound strategies with no organic post-count scope', () => {
    const scope = resolveContentPlanSlotScope(
      {
        strategyType: 'organic',
        strategyOrder: { strategyType: 'organic' },
        strategyDeliverables: { organicPostCount: 0 },
      },
      { postsPerCampaign: 8, videoSlotsPerMonth: 0 },
    )

    expect(scope).toMatchObject({
      canGenerate: false,
      source: 'strategy-deliverables',
      blockedReason: 'no-organic-post-count',
      totalSlots: 0,
    })
  })

  it('keeps paid-only/no-scope route blocking before credit deduction', () => {
    const routeSource = readFileSync('src/app/api/campaigns/[id]/generate-content-plan/route.ts', 'utf8')
    const scopeIndex = routeSource.indexOf('const slotScope = resolveContentPlanSlotScope')
    const creditIndex = routeSource.indexOf("checkAndDeductCredits(userId, 'CONTENT_PLAN_GENERATION')")

    expect(scopeIndex).toBeGreaterThan(-1)
    expect(creditIndex).toBeGreaterThan(-1)
    expect(scopeIndex).toBeLessThan(creditIndex)
  })

  it('returns the complete credit shortfall contract to the Content Hub', () => {
    const routeSource = readFileSync('src/app/api/campaigns/[id]/generate-content-plan/route.ts', 'utf8')

    expect(routeSource).toContain('...creditCheck')
    expect(routeSource).toContain("code: creditCheck.error ?? 'INSUFFICIENT_CREDITS'")
  })

  it('refunds wallet deductions to their source transaction on generation failure', () => {
    const routeSource = readFileSync('src/app/api/campaigns/[id]/generate-content-plan/route.ts', 'utf8')

    expect(routeSource).toContain('refundCreditsForTransaction')
    expect(routeSource).toContain('transactionId: charge.transactionId')
    expect(routeSource).toContain('refundContentPlanCharge(userId, contentPlanCharge')
  })
})
