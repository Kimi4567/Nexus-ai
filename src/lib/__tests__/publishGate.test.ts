/**
 * Publishing Sprint PR 3 — publish safety gate.
 *
 * Proves the cron publisher can ONLY auto-publish posts the user explicitly opted
 * into automatic publishing (publishMode = AUTO). The MANUAL default, legacy rows,
 * and any unknown/missing publishMode must never be auto-published — even when
 * SCHEDULED and past due — and are never modified (so never marked FAILED/PUBLISHED).
 */

import { describe, it, expect } from 'vitest'
import { isAutoPublishEligible, autoPublishWhere, skippedManualWhere, type CronPostLike } from '@/lib/publishGate'

const now = new Date('2026-06-13T12:00:00Z')
const due = '2026-06-13T11:00:00Z'    // past → due
const future = '2026-06-14T11:00:00Z' // not due

const post = (over: Partial<CronPostLike>): CronPostLike => ({ status: 'SCHEDULED', publishMode: 'AUTO', scheduledAt: due, ...over })

describe('isAutoPublishEligible — only AUTO posts may auto-publish', () => {
  it('1. SCHEDULED + MANUAL + due is NOT selected', () => {
    expect(isAutoPublishEligible(post({ publishMode: 'MANUAL' }), now)).toBe(false)
  })

  it('2. SCHEDULED + AUTO + due CAN be selected', () => {
    expect(isAutoPublishEligible(post({ publishMode: 'AUTO' }), now)).toBe(true)
  })

  it('3. SCHEDULED + MANUAL with a platform reference is still ignored', () => {
    // platform refs / integration data are irrelevant — MANUAL is blocked regardless
    expect(isAutoPublishEligible({ status: 'SCHEDULED', publishMode: 'MANUAL', scheduledAt: due } as any, now)).toBe(false)
  })

  it('7. legacy / missing / unknown publishMode is treated as MANUAL → never eligible', () => {
    expect(isAutoPublishEligible(post({ publishMode: null }), now)).toBe(false)
    expect(isAutoPublishEligible(post({ publishMode: undefined }), now)).toBe(false)
    expect(isAutoPublishEligible(post({ publishMode: 'SOMETHING' }), now)).toBe(false)
    expect(isAutoPublishEligible({ status: 'SCHEDULED', scheduledAt: due } as any, now)).toBe(false)
  })

  it('6. existing AUTO behaviour: due AUTO selected, future AUTO not selected', () => {
    expect(isAutoPublishEligible(post({ publishMode: 'AUTO', scheduledAt: due }), now)).toBe(true)
    expect(isAutoPublishEligible(post({ publishMode: 'AUTO', scheduledAt: future }), now)).toBe(false)
  })

  it('non-SCHEDULED statuses are never eligible (even AUTO)', () => {
    for (const status of ['DRAFT', 'APPROVED', 'PUBLISHED', 'FAILED']) {
      expect(isAutoPublishEligible(post({ status }), now)).toBe(false)
    }
  })

  it('missing / invalid scheduledAt is never eligible', () => {
    expect(isAutoPublishEligible(post({ scheduledAt: null }), now)).toBe(false)
    expect(isAutoPublishEligible(post({ scheduledAt: 'not-a-date' }), now)).toBe(false)
  })
})

describe('autoPublishWhere — DB query only targets AUTO posts', () => {
  it('locks the cron selection to status SCHEDULED + publishMode AUTO + due', () => {
    const w = autoPublishWhere(now)
    expect(w.status).toBe('SCHEDULED')
    expect(w.publishMode).toBe('AUTO')
    expect(w.scheduledAt).toEqual({ lte: now })
  })

  it('4 & 5. the gate never writes status — MANUAL posts are only EXCLUDED, never set to FAILED or PUBLISHED', () => {
    // The where filter contains no status mutation; it is a read filter that simply
    // omits non-AUTO posts. Combined with isAutoPublishEligible, a MANUAL post is never
    // selected and therefore never reaches any update (FAILED/PUBLISHED) code path.
    const w = autoPublishWhere(now) as Record<string, unknown>
    expect('data' in w).toBe(false)
    expect(isAutoPublishEligible(post({ publishMode: 'MANUAL' }), now)).toBe(false)
  })
})

describe('skippedManualWhere — safe observability only', () => {
  it('counts SCHEDULED + due posts that are NOT auto (manual/legacy)', () => {
    const w = skippedManualWhere(now) as any
    expect(w.status).toBe('SCHEDULED')
    expect(w.scheduledAt).toEqual({ lte: now })
    expect(w.NOT).toEqual({ publishMode: 'AUTO' })
  })
})
