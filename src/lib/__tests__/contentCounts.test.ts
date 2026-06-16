/**
 * PR-1J — honest content/publishing count model.
 * Core invariant: approved/draft content is never counted as scheduled or published.
 */
import { describe, it, expect } from 'vitest'
import { getPublishingStateSummary } from '@/lib/contentCounts'

describe('getPublishingStateSummary (PR-1J — one count truth)', () => {
  it('approved content does NOT count as scheduled or published', () => {
    const s = getPublishingStateSummary([
      { status: 'APPROVED', platform: 'META' },
      { status: 'APPROVED', scheduledAt: null, platform: 'META' },
    ])
    expect(s.approved).toBe(2)
    expect(s.scheduled).toBe(0)
    expect(s.published).toBe(0)
    expect(s.notScheduled).toBe(2)
  })

  it('scheduled count only includes status SCHEDULED', () => {
    const s = getPublishingStateSummary([
      { status: 'SCHEDULED', scheduledAt: '2026-06-20T10:00:00Z', platform: 'META' },
      { status: 'DRAFT', platform: 'META' },
      { status: 'APPROVED', platform: 'META' },
    ])
    expect(s.scheduled).toBe(1)
  })

  it('published count only includes status PUBLISHED (a scheduled post is never published)', () => {
    const s = getPublishingStateSummary([
      { status: 'PUBLISHED', publishedAt: '2026-06-01T10:00:00Z', platform: 'META' },
      { status: 'SCHEDULED', scheduledAt: '2026-06-20T10:00:00Z', platform: 'META' },
    ])
    expect(s.published).toBe(1)
    expect(s.scheduled).toBe(1)
  })

  it('notScheduled = draft + approved', () => {
    const s = getPublishingStateSummary([
      { status: 'DRAFT' },
      { status: 'DRAFT' },
      { status: 'APPROVED' },
      { status: 'SCHEDULED', scheduledAt: '2026-06-20T10:00:00Z' },
    ])
    expect(s.draft).toBe(2)
    expect(s.approved).toBe(1)
    expect(s.notScheduled).toBe(3)
  })

  it('unknown/legacy status falls back to draft — never false published/scheduled', () => {
    const s = getPublishingStateSummary([{ status: 'WEIRD' }, { status: null }, {}])
    expect(s.draft).toBe(3)
    expect(s.scheduled).toBe(0)
    expect(s.published).toBe(0)
  })

  it('platform summary is distinct and case-normalized', () => {
    const s = getPublishingStateSummary([
      { status: 'SCHEDULED', platform: 'meta' },
      { status: 'SCHEDULED', platform: 'META' },
      { status: 'PUBLISHED', platform: 'tiktok' },
    ])
    expect(s.platforms.sort()).toEqual(['META', 'TIKTOK'])
  })

  it('status matching is case/whitespace insensitive', () => {
    const s = getPublishingStateSummary([
      { status: ' published ' },
      { status: 'Scheduled' },
    ])
    expect(s.published).toBe(1)
    expect(s.scheduled).toBe(1)
  })

  it('empty / null input yields all-zero summary without crashing', () => {
    for (const input of [[], null, undefined]) {
      const s = getPublishingStateSummary(input as never)
      expect(s.total).toBe(0)
      expect(s.notScheduled).toBe(0)
      expect(s.platforms).toEqual([])
    }
  })
})
