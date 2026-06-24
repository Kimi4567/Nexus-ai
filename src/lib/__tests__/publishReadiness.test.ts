/**
 * publishReadiness.test.ts
 *
 * Focused tests for the pure getPublishReadiness helper.
 * No mocks needed — the helper is entirely pure.
 */

import { describe, it, expect } from 'vitest'
import { getPublishReadiness, type PublishReadinessInput } from '../publishReadiness'

const base: PublishReadinessInput = {
  contentApproved: true,
  accountCount: 1,
  hasPage: true,
  pageHasIgAccount: true,
  platform: 'FACEBOOK',
  hasImage: false,
  mode: 'now',
  hasScheduledAt: false,
}

describe('getPublishReadiness — locked states', () => {
  it('1. DRAFT / not approved → locked CONTENT_NOT_APPROVED', () => {
    const r = getPublishReadiness({ ...base, contentApproved: false })
    expect(r.status).toBe('locked')
    expect(r.reason).toBe('CONTENT_NOT_APPROVED')
    expect(r.copy.en).toBe('Approve content before publishing.')
    expect(r.copy.ar).toBe('اعتمد المحتوى قبل النشر.')
  })

  it('2. no connected accounts → locked NO_ACCOUNT', () => {
    const r = getPublishReadiness({ ...base, accountCount: 0 })
    expect(r.status).toBe('locked')
    expect(r.reason).toBe('NO_ACCOUNT')
    expect(r.copy.en).toBe('Connect a publishing account before posting.')
    expect(r.copy.ar).toBe('اربط حساب نشر قبل إرسال المنشور.')
  })

  it('3. account connected but no page selected → locked NO_PAGE', () => {
    const r = getPublishReadiness({ ...base, hasPage: false })
    expect(r.status).toBe('locked')
    expect(r.reason).toBe('NO_PAGE')
  })

  it('4. Instagram selected but page has no IG Business link → locked INSTAGRAM_BUSINESS_REQUIRED', () => {
    const r = getPublishReadiness({ ...base, platform: 'INSTAGRAM', pageHasIgAccount: false })
    expect(r.status).toBe('locked')
    expect(r.reason).toBe('INSTAGRAM_BUSINESS_REQUIRED')
    expect(r.copy.en).toContain('Instagram Business account linked')
    expect(r.copy.ar).toContain('Instagram Business')
  })

  it('5. Instagram selected without image → locked INSTAGRAM_IMAGE_REQUIRED', () => {
    const r = getPublishReadiness({ ...base, platform: 'INSTAGRAM', pageHasIgAccount: true, hasImage: false })
    expect(r.status).toBe('locked')
    expect(r.reason).toBe('INSTAGRAM_IMAGE_REQUIRED')
    expect(r.copy.en).toBe('Instagram requires an image.')
    expect(r.copy.ar).toBe('Instagram يتطلب صورة.')
  })
})

describe('getPublishReadiness — ready states', () => {
  it('6. Facebook manual ready → READY_MANUAL with correct copy', () => {
    const r = getPublishReadiness({ ...base, platform: 'FACEBOOK' })
    expect(r.status).toBe('ready')
    expect(r.reason).toBe('READY_MANUAL')
    expect(r.title.en).toBe('Ready for manual publish')
    expect(r.title.ar).toBe('جاهز للنشر اليدوي')
    expect(r.copy.en).toBe('NEXUS will publish only when you click this button.')
    expect(r.copy.ar).toBe('لن ينشر NEXUS إلا عند الضغط على هذا الزر.')
    expect(r.buttonLabel?.en).toBe('Publish now')
    expect(r.buttonLabel?.ar).toBe('انشر الآن')
  })

  it('7. schedule mode with scheduledAt set → READY_SCHEDULE with correct copy', () => {
    const r = getPublishReadiness({ ...base, mode: 'schedule', hasScheduledAt: true })
    expect(r.status).toBe('ready')
    expect(r.reason).toBe('READY_SCHEDULE')
    expect(r.title.en).toBe('Ready to schedule')
    expect(r.title.ar).toBe('جاهز للجدولة')
    expect(r.copy.en).toContain('does not bypass approval')
    expect(r.copy.ar).toContain('لا تتجاوز الاعتماد')
    expect(r.buttonLabel?.en).toBe('Schedule post')
  })
})

describe('getPublishReadiness — gate ordering', () => {
  it('CONTENT_NOT_APPROVED blocks even when all other gates pass', () => {
    const r = getPublishReadiness({
      ...base,
      contentApproved: false,
      accountCount: 3,
      hasPage: true,
      platform: 'FACEBOOK',
    })
    expect(r.reason).toBe('CONTENT_NOT_APPROVED')
  })

  it('NO_ACCOUNT blocks before NO_PAGE check', () => {
    const r = getPublishReadiness({ ...base, accountCount: 0, hasPage: false })
    expect(r.reason).toBe('NO_ACCOUNT')
  })

  it('INSTAGRAM_BUSINESS_REQUIRED blocks before INSTAGRAM_IMAGE_REQUIRED', () => {
    const r = getPublishReadiness({
      ...base,
      platform: 'INSTAGRAM',
      pageHasIgAccount: false,
      hasImage: false,
    })
    expect(r.reason).toBe('INSTAGRAM_BUSINESS_REQUIRED')
  })

  it('schedule mode without scheduledAt is locked', () => {
    const r = getPublishReadiness({ ...base, mode: 'schedule', hasScheduledAt: false })
    expect(r.status).toBe('locked')
  })
})
