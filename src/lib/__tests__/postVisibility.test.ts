/**
 * Publishing Sprint PR 5 — calendar & published visibility honesty.
 *
 * Pins the honest derived display state for every execution state (so the Calendar
 * and Content Hub never claim auto-publishing for a manual post, never show APPROVED
 * as Scheduled, and never invent a "published" state), plus the summary counts that
 * keep manually-published posts visible instead of "disappearing".
 */

import { describe, it, expect } from 'vitest'
import { deriveDisplayState } from '@/lib/postStatus'
import { summarizeByDisplayState, isCompletedState, publicPostUrl } from '@/lib/postVisibility'

describe('derived display state — honest execution states', () => {
  it('1. PUBLISHED + MANUAL → published_manual (published manually)', () => {
    expect(deriveDisplayState({ status: 'PUBLISHED', publishMode: 'MANUAL' })).toBe('published_manual')
  })

  it('2. PUBLISHED + AUTO + platform reference → published_auto (published automatically)', () => {
    expect(deriveDisplayState({ status: 'PUBLISHED', publishMode: 'AUTO', platformPostId: 'fb_1' })).toBe('published_auto')
    // AUTO but NO platform reference must NOT claim an automatic publish
    expect(deriveDisplayState({ status: 'PUBLISHED', publishMode: 'AUTO' })).toBe('published_manual')
  })

  it('3. SCHEDULED + MANUAL → scheduled_manual (manual publishing required), NOT auto', () => {
    const s = deriveDisplayState({ status: 'SCHEDULED', publishMode: 'MANUAL' })
    expect(s).toBe('scheduled_manual')
    expect(s).not.toBe('scheduled_auto')
  })

  it('4. SCHEDULED + AUTO → scheduled_auto', () => {
    expect(deriveDisplayState({ status: 'SCHEDULED', publishMode: 'AUTO' })).toBe('scheduled_auto')
  })

  it('5. APPROVED does not display as Scheduled', () => {
    const s = deriveDisplayState({ status: 'APPROVED' })
    expect(s).toBe('approved')
    expect(s).not.toBe('scheduled_manual')
    expect(s).not.toBe('scheduled_auto')
  })

  it('6. DRAFT does not display as Published', () => {
    const s = deriveDisplayState({ status: 'DRAFT' })
    expect(s).toBe('draft')
    expect(isCompletedState(s)).toBe(false)
  })

  it('7. unknown / legacy states never falsely claim publishing', () => {
    expect(isCompletedState(deriveDisplayState({ status: 'SOMETHING_NEW' as any }))).toBe(false)
    expect(isCompletedState(deriveDisplayState({ status: 'SCHEDULED', publishMode: null }))).toBe(false)
  })
})

describe('publicPostUrl — link only when present and valid', () => {
  it('8. returns the URL only for valid http(s) links', () => {
    expect(publicPostUrl('https://facebook.com/p/1')).toBe('https://facebook.com/p/1')
    expect(publicPostUrl('http://x.com/y')).toBe('http://x.com/y')
    expect(publicPostUrl(null)).toBeNull()
    expect(publicPostUrl(undefined)).toBeNull()
    expect(publicPostUrl('')).toBeNull()
    expect(publicPostUrl('not-a-url')).toBeNull()
    expect(publicPostUrl('  https://a.co/b  ')).toBe('https://a.co/b')
  })
})

describe('summarizeByDisplayState — keep published posts visible', () => {
  it('9. counts a mixed batch honestly so manually-published posts are not lost', () => {
    const posts = [
      { status: 'DRAFT' },
      { status: 'DRAFT' },
      { status: 'APPROVED' },
      { status: 'SCHEDULED', publishMode: 'MANUAL' },
      { status: 'SCHEDULED', publishMode: 'AUTO' },
      { status: 'PUBLISHED', publishMode: 'MANUAL' },                          // manual publish
      { status: 'PUBLISHED', publishMode: 'AUTO', platformPostId: 'fb_9' },    // auto publish
      { status: 'FAILED' },
    ]
    const c = summarizeByDisplayState(posts as any)
    expect(c).toMatchObject({
      draft: 2, approved: 1, scheduledManual: 1, scheduledAuto: 1,
      publishedManual: 1, publishedAuto: 1, failed: 1, published: 2, total: 8,
    })
  })

  it('empty batch → all zeros', () => {
    expect(summarizeByDisplayState([])).toMatchObject({ total: 0, published: 0 })
  })
})
