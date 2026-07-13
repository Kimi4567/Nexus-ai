/**
 * Publishing Sprint PR 1 — post status foundation.
 *
 * Pins the honest lifecycle (DRAFT → APPROVED → SCHEDULED → PUBLISHED | FAILED),
 * the manual-vs-auto display logic (never falsely claim a post is published), the
 * status-history shape, and the Brand-Brain learning-event mapping (defined, not run).
 */

import { describe, it, expect } from 'vitest'
import {
  canTransition,
  validateTransition,
  deriveDisplayState,
  displayStateLabelKey,
  statusLabelKey,
  isApiPublished,
  isPublished,
  isScheduledNotPublished,
  buildStatusHistory,
  learningEventForTransition,
  type PostStatus,
} from '@/lib/postStatus'
import { translations } from '@/lib/i18n-context'

const hasArabic = (s: string) => /[؀-ۿ]/.test(s)

describe('status transitions', () => {
  it('1. valid lifecycle transitions pass', () => {
    expect(canTransition('DRAFT', 'APPROVED')).toBe(true)
    expect(canTransition('APPROVED', 'SCHEDULED')).toBe(true)
    expect(canTransition('SCHEDULED', 'PUBLISHED')).toBe(true)
    expect(canTransition('SCHEDULED', 'PROCESSING')).toBe(true)
    expect(canTransition('PROCESSING', 'PUBLISHED')).toBe(true)
    expect(canTransition('SCHEDULED', 'FAILED')).toBe(true)
    expect(canTransition('APPROVED', 'PUBLISHED')).toBe(true) // manual publish-now
    expect(canTransition('FAILED', 'SCHEDULED')).toBe(true)   // retry
    expect(canTransition('APPROVED', 'DRAFT')).toBe(true)     // un-approve / reject
  })

  it('2. invalid transitions fail (with a clear reason)', () => {
    expect(canTransition('DRAFT', 'SCHEDULED')).toBe(false)
    expect(canTransition('DRAFT', 'FAILED')).toBe(false)
    expect(canTransition('PUBLISHED', 'SCHEDULED')).toBe(false)
    expect(canTransition('DRAFT', 'DRAFT')).toBe(false)
    const r = validateTransition('DRAFT', 'PUBLISHED')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Illegal transition/)
    expect(validateTransition('APPROVED', 'SCHEDULED')).toEqual({ ok: true })
  })

  it('3. DRAFT cannot go directly to PUBLISHED', () => {
    expect(canTransition('DRAFT', 'PUBLISHED')).toBe(false)
    expect(validateTransition('DRAFT', 'PUBLISHED').ok).toBe(false)
  })

  it('4. APPROVED can go to SCHEDULED', () => {
    expect(canTransition('APPROVED', 'SCHEDULED')).toBe(true)
  })

  it('unknown source status is rejected safely', () => {
    expect(validateTransition('WAT' as PostStatus, 'PUBLISHED').ok).toBe(false)
  })
})

describe('derived display state — honest publishing', () => {
  it('5. SCHEDULED + MANUAL derives "scheduled_manual", NOT published', () => {
    const s = deriveDisplayState({ status: 'SCHEDULED', publishMode: 'MANUAL' })
    expect(s).toBe('scheduled_manual')
    expect(isPublished(s)).toBe(false)
    expect(isScheduledNotPublished(s)).toBe(true)
  })

  it('SCHEDULED + AUTO derives "scheduled_auto", still NOT published', () => {
    const s = deriveDisplayState({ status: 'SCHEDULED', publishMode: 'AUTO' })
    expect(s).toBe('scheduled_auto')
    expect(isPublished(s)).toBe(false)
  })

  it('6. PUBLISHED + MANUAL derives "published_manual"', () => {
    const s = deriveDisplayState({ status: 'PUBLISHED', publishMode: 'MANUAL' })
    expect(s).toBe('published_manual')
    expect(isPublished(s)).toBe(true)
    expect(isApiPublished(s)).toBe(false)
  })

  it('7. PUBLISHED + AUTO derives "published_auto" ONLY with a real platform reference', () => {
    expect(deriveDisplayState({ status: 'PUBLISHED', publishMode: 'AUTO', platformPostId: 'fb_123' }))
      .toBe('published_auto')
    expect(deriveDisplayState({ status: 'PUBLISHED', publishMode: 'AUTO', platformUrl: 'https://fb.com/x' }))
      .toBe('published_auto')
    // AUTO but no platform reference → never claim an API publish
    expect(deriveDisplayState({ status: 'PUBLISHED', publishMode: 'AUTO' }))
      .toBe('published_manual')
    expect(isApiPublished(deriveDisplayState({ status: 'PUBLISHED', publishMode: 'AUTO', platformPostId: 'x' }))).toBe(true)
  })

  it('8. FAILED derives "failed"; the reason rides on the history note', () => {
    expect(deriveDisplayState({ status: 'FAILED' })).toBe('failed')
    const row = buildStatusHistory({
      socialPostId: 'p1', workspaceId: 'w1', fromStatus: 'SCHEDULED', toStatus: 'FAILED',
      actor: 'CRON', note: 'Meta API: token expired',
    })
    expect(row.toStatus).toBe('FAILED')
    expect(row.note).toBe('Meta API: token expired')
  })

  it('provider processing is not displayed as published', () => {
    const state = deriveDisplayState({ status: 'PROCESSING', publishMode: 'AUTO', platformPostId: 'ticket-1' })
    expect(state).toBe('processing')
    expect(isPublished(state)).toBe(false)
  })

  it('10. legacy / unknown statuses derive safely — never a false "published"', () => {
    // legacy PUBLISHED with no publishMode → MANUAL, honest "published_manual"
    expect(deriveDisplayState({ status: 'PUBLISHED' })).toBe('published_manual')
    // legacy DRAFT/SCHEDULED keep working
    expect(deriveDisplayState({ status: 'DRAFT' })).toBe('draft')
    expect(deriveDisplayState({ status: 'SCHEDULED' })).toBe('scheduled_manual')
    // unknown value → safe default, never "published"
    const s = deriveDisplayState({ status: 'SOMETHING_NEW' })
    expect(s).toBe('draft')
    expect(isPublished(s)).toBe(false)
  })

  it('label keys map every display state and statusLabelKey resolves from raw fields', () => {
    expect(displayStateLabelKey('published_manual')).toBe('status.publishedManually')
    expect(statusLabelKey({ status: 'SCHEDULED', publishMode: 'AUTO' })).toBe('status.scheduledAuto')
  })
})

describe('9. i18n status labels exist in ar + en', () => {
  const KEYS = ['draft','approved','scheduledManual','scheduledAuto','processing','publishedManually','publishedAuto','failed','readyToPublish','manualPublishing','autoPublishing']

  it('every status key is a non-empty string in BOTH locales', () => {
    for (const k of KEYS) {
      expect(typeof translations.ar.status?.[k], `ar.status.${k}`).toBe('string')
      expect((translations.ar.status[k] as string).length).toBeGreaterThan(0)
      expect(typeof translations.en.status?.[k], `en.status.${k}`).toBe('string')
      expect((translations.en.status[k] as string).length).toBeGreaterThan(0)
    }
  })

  it('ar and en status key sets are identical (no raw-key fallback)', () => {
    expect(Object.keys(translations.ar.status).sort()).toEqual(Object.keys(translations.en.status).sort())
  })

  it('Arabic labels are Arabic; English are English', () => {
    expect(hasArabic(translations.ar.status.publishedManually)).toBe(true)
    expect(translations.en.status.publishedManually).toBe('Published manually')
  })
})

describe('Brand Brain learning-event mapping (defined, not executed in PR 1)', () => {
  it('maps each lifecycle transition to a learning event', () => {
    expect(learningEventForTransition('DRAFT', 'APPROVED')).toBe('post_approved')
    expect(learningEventForTransition('APPROVED', 'DRAFT')).toBe('post_rejected')
    expect(learningEventForTransition('APPROVED', 'SCHEDULED')).toBe('post_scheduled')
    expect(learningEventForTransition('SCHEDULED', 'PUBLISHED', 'MANUAL')).toBe('post_published_manual')
    expect(learningEventForTransition('SCHEDULED', 'PUBLISHED', 'AUTO')).toBe('post_published_auto')
    expect(learningEventForTransition('SCHEDULED', 'FAILED')).toBe('post_failed')
    expect(learningEventForTransition('FAILED', 'DRAFT')).toBe('post_reset')
  })
})
