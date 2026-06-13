/**
 * Publishing Sprint PR 4 — manual publishing.
 *
 * Proves a user can honestly mark a SCHEDULED + MANUAL post as published-by-hand
 * (SCHEDULED → PUBLISHED), that DRAFT/APPROVED/AUTO cannot, and that the right
 * timestamps + audit row are produced — without NEXUS ever claiming it auto-published.
 */

import { describe, it, expect } from 'vitest'
import { planManualPublish, type ManualPublishPost } from '@/lib/manualPublish'

const now = new Date('2026-06-13T12:00:00Z')
const post = (over: Partial<ManualPublishPost>): ManualPublishPost => ({ id: 'p1', workspaceId: 'w1', status: 'SCHEDULED', publishMode: 'MANUAL', ...over })

describe('planManualPublish', () => {
  it('1. MANUAL + SCHEDULED can be marked PUBLISHED manually', () => {
    const r = planManualPublish(post({}), { now })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.update.data.status).toBe('PUBLISHED')
  })

  it('2. DRAFT cannot be marked manually published', () => {
    const r = planManualPublish(post({ status: 'DRAFT' }), { now })
    expect(r.ok).toBe(false)
  })

  it('3. APPROVED cannot be marked manually published (must be scheduled first)', () => {
    const r = planManualPublish(post({ status: 'APPROVED' }), { now })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/scheduled/i)
  })

  it('4. sets manuallyPublishedAt', () => {
    const r = planManualPublish(post({}), { now })
    expect(r.ok && r.update.data.manuallyPublishedAt).toEqual(now)
  })

  it('5. sets publishedAt (used by the existing published display logic)', () => {
    const r = planManualPublish(post({}), { now })
    expect(r.ok && r.update.data.publishedAt).toEqual(now)
  })

  it('6. records PostStatusHistory SCHEDULED → PUBLISHED, actor USER, manual note', () => {
    const r = planManualPublish(post({}), { now })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.history).toMatchObject({ fromStatus: 'SCHEDULED', toStatus: 'PUBLISHED', actor: 'USER' })
      expect(r.history.note).toMatch(/manual/i)
    }
  })

  it('7. optional live URL is saved to platformUrl when valid; ignored otherwise', () => {
    const withUrl = planManualPublish(post({}), { now, liveUrl: 'https://facebook.com/p/123' })
    expect(withUrl.ok && withUrl.update.data.platformUrl).toBe('https://facebook.com/p/123')
    if (withUrl.ok) expect(withUrl.history.note).toMatch(/facebook\.com/)

    const noUrl = planManualPublish(post({}), { now })
    expect(noUrl.ok && 'platformUrl' in noUrl.update.data).toBe(false) // confirm-only, allowed

    const badUrl = planManualPublish(post({}), { now, liveUrl: 'not-a-url' })
    expect(badUrl.ok && 'platformUrl' in badUrl.update.data).toBe(false) // invalid ignored, still ok
  })

  it('8. AUTO posts cannot be manually marked', () => {
    const r = planManualPublish(post({ publishMode: 'AUTO' }), { now })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/auto/i)
  })

  it('9. publishMode is never changed by manual publish', () => {
    const r = planManualPublish(post({}), { now })
    expect(r.ok && 'publishMode' in r.update.data).toBe(false) // stays MANUAL (untouched)
  })

  it('10. result copy/note never claims automatic publishing', () => {
    const r = planManualPublish(post({}), { now })
    if (r.ok) {
      expect(r.history.note?.toLowerCase()).toContain('user confirmed')
      expect(r.history.note?.toLowerCase()).not.toContain('auto')
    }
  })

  it('PUBLISHED / FAILED posts cannot be re-marked', () => {
    expect(planManualPublish(post({ status: 'PUBLISHED' }), { now }).ok).toBe(false)
    expect(planManualPublish(post({ status: 'FAILED' }), { now }).ok).toBe(false)
  })
})
