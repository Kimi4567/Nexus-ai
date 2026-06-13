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
import { summarizeByDisplayState, isCompletedState, publicPostUrl, isAutoPublished } from '@/lib/postVisibility'

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

describe('isAutoPublished — Published Queue counts integration/auto publishes only (PR7)', () => {
  it('10. a manually-published post is NOT counted as auto-published', () => {
    // PUBLISHED + MANUAL, even with a live URL the user pasted, is a manual publish.
    expect(isAutoPublished({ status: 'PUBLISHED', publishMode: 'MANUAL', platformUrl: 'https://fb.com/p/1' })).toBe(false)
    expect(isAutoPublished({ status: 'PUBLISHED', publishMode: 'MANUAL' })).toBe(false)
  })

  it('11. an auto/integration-published post (AUTO + platform proof) IS counted', () => {
    expect(isAutoPublished({ status: 'PUBLISHED', publishMode: 'AUTO', platformPostId: 'fb_9' })).toBe(true)
    expect(isAutoPublished({ status: 'PUBLISHED', publishMode: 'AUTO', platformUrl: 'https://fb.com/p/9' })).toBe(true)
  })

  it('12. AUTO without any platform proof is NOT claimed as auto-published (legacy safe)', () => {
    expect(isAutoPublished({ status: 'PUBLISHED', publishMode: 'AUTO' })).toBe(false)
  })

  it('13. non-published states are never auto-published', () => {
    expect(isAutoPublished({ status: 'SCHEDULED', publishMode: 'AUTO' })).toBe(false)
    expect(isAutoPublished({ status: 'SCHEDULED', publishMode: 'MANUAL' })).toBe(false)
    expect(isAutoPublished({ status: 'APPROVED' })).toBe(false)
    expect(isAutoPublished({ status: 'DRAFT' })).toBe(false)
    expect(isAutoPublished({ status: 'FAILED' })).toBe(false)
  })

  it('14. the auto-published count excludes manual publishes (no contradiction with Content Hub)', () => {
    const posts = [
      { status: 'PUBLISHED', publishMode: 'MANUAL', platformUrl: 'https://x.co/a' }, // manual → Content Hub
      { status: 'PUBLISHED', publishMode: 'MANUAL' },                                 // manual → Content Hub
      { status: 'PUBLISHED', publishMode: 'AUTO', platformPostId: 'fb_1' },           // auto  → this queue
      { status: 'SCHEDULED', publishMode: 'AUTO' },
      { status: 'DRAFT' },
    ]
    const autoCount = posts.filter(p => isAutoPublished(p as any)).length
    expect(autoCount).toBe(1)
    // the two manual publishes are still honestly "published" overall (Content Hub view)
    expect(summarizeByDisplayState(posts as any).published).toBe(3)
  })
})
