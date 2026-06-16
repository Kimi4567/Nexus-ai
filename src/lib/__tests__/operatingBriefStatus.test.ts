/**
 * PR-1N — Operating Brief status-truth helpers. Verifies the publishing tile and
 * the Brand memory status check can never claim "live"/"published"/"complete" work
 * that does not exist.
 */
import { describe, it, expect } from 'vitest'
import {
  derivePublishingState,
  getPublishingStatusCopy,
  getBrandMemoryStatusCopy,
} from '@/lib/operatingBriefStatus'

describe('derivePublishingState (PR-1N)', () => {
  it('published > 0 → live (wins over scheduled/pending)', () => {
    expect(derivePublishingState({ published: 2, scheduled: 5, pending: 9 })).toBe('live')
  })
  it('scheduled > 0 and published 0 → scheduled (NOT live)', () => {
    expect(derivePublishingState({ published: 0, scheduled: 3, pending: 4 })).toBe('scheduled')
  })
  it('only drafts/approved → pending', () => {
    expect(derivePublishingState({ published: 0, scheduled: 0, pending: 6 })).toBe('pending')
  })
  it('nothing anywhere → none', () => {
    expect(derivePublishingState({ published: 0, scheduled: 0, pending: 0 })).toBe('none')
    expect(derivePublishingState({})).toBe('none')
  })
  it('a connected channel alone (no posts) is NOT publishing', () => {
    // integration connected but no published/scheduled/draft posts
    expect(derivePublishingState({ published: 0, scheduled: 0, pending: 0 })).toBe('none')
  })
  it('ignores negative / non-integer noise', () => {
    expect(derivePublishingState({ published: -3, scheduled: 1.9, pending: 0 })).toBe('scheduled')
    expect(derivePublishingState({ published: null, scheduled: null, pending: null })).toBe('none')
  })
})

describe('getPublishingStatusCopy (PR-1N)', () => {
  it('only the live state is isLive / good and may say "live"', () => {
    const live = getPublishingStatusCopy('live')
    expect(live.isLive).toBe(true)
    expect(live.severity).toBe('good')
    expect(live.label).toMatch(/live/i)
  })
  it('scheduled says "not live yet" and is never isLive', () => {
    const s = getPublishingStatusCopy('scheduled')
    expect(s.isLive).toBe(false)
    expect(s.severity).toBe('watch')
    expect(s.label).toMatch(/not live yet/i)
  })
  it('pending says approved/not scheduled, not isLive', () => {
    const p = getPublishingStatusCopy('pending')
    expect(p.isLive).toBe(false)
    expect(p.label).toMatch(/not scheduled/i)
  })
  it('none says not scheduled and is risk', () => {
    const n = getPublishingStatusCopy('none')
    expect(n.isLive).toBe(false)
    expect(n.severity).toBe('risk')
  })
  it('no non-live state ever claims published/live (EN + AR)', () => {
    for (const state of ['scheduled', 'pending', 'none'] as const) {
      const c = getPublishingStatusCopy(state)
      expect(c.label.toLowerCase()).not.toMatch(/\bpublished\b/)
      expect(/مباشر(?!اً? ليس)/.test(c.labelAr) && !/ليس مباشر/.test(c.labelAr)).toBe(false)
    }
  })
})

describe('getBrandMemoryStatusCopy (PR-1N)', () => {
  it('active → Active / good', () => {
    const c = getBrandMemoryStatusCopy('active')
    expect(c.value).toBe('Active')
    expect(c.severity).toBe('good')
  })
  it('building → Building / watch (never "100%"/complete)', () => {
    const c = getBrandMemoryStatusCopy('building')
    expect(c.value).toBe('Building')
    expect(c.severity).toBe('watch')
    expect(c.value).not.toMatch(/100%|complete/i)
  })
  it('needs_data / null / undefined → needs more info / risk', () => {
    for (const s of ['needs_data', null, undefined] as const) {
      const c = getBrandMemoryStatusCopy(s)
      expect(c.status).toBe('needs_data')
      expect(c.value).toMatch(/needs more info/i)
      expect(c.severity).toBe('risk')
    }
  })
  it('never emits a percentage as the value', () => {
    for (const s of ['active', 'building', 'needs_data'] as const) {
      expect(getBrandMemoryStatusCopy(s).value).not.toMatch(/%/)
    }
  })
})
