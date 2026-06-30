/**
 * publishReadiness.test.ts
 *
 * Focused tests for the pure getPublishReadiness helper.
 * No mocks needed — the helper is entirely pure.
 */

import { describe, it, expect } from 'vitest'
import {
  derivePublishTabReadinessSummary,
  getPublishReadiness,
  type PublishReadinessInput,
} from '../publishReadiness'

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
    expect(r.title.en).toBe('Ready for explicit API publish')
    expect(r.title.ar).toBe('جاهز للنشر عبر API بتأكيد صريح')
    expect(r.copy.en).toBe('NEXUS sends this post through the connected platform API only after this explicit click.')
    expect(r.copy.ar).toBe('يرسل NEXUS هذا المنشور عبر API المنصة المتصلة فقط بعد هذه الضغطة الصريحة.')
    expect(r.buttonLabel?.en).toBe('Publish via platform API')
    expect(r.buttonLabel?.ar).toBe('النشر عبر API المنصة')
  })

  it('7. schedule mode with scheduledAt set → READY_SCHEDULE with correct copy', () => {
    const r = getPublishReadiness({ ...base, mode: 'schedule', hasScheduledAt: true })
    expect(r.status).toBe('ready')
    expect(r.reason).toBe('READY_SCHEDULE')
    expect(r.title.en).toBe('Ready to schedule')
    expect(r.title.ar).toBe('جاهز للجدولة')
    expect(r.copy.en).toContain('not published unless')
    expect(r.copy.ar).toContain('لا يتم النشر')
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
    expect(r.reason).toBe('SCHEDULE_TIME_REQUIRED')
    expect(r.copy.en).toBe('Select a scheduled time before scheduling.')
    expect(r.copy.ar).toBe('حدد وقت الجدولة قبل جدولة المنشور.')
  })
})

describe('derivePublishTabReadinessSummary', () => {
  it('no connected accounts + scheduled posts stays locked-sounding and not published', () => {
    const summary = derivePublishTabReadinessSummary({
      posts: [
        { status: 'SCHEDULED', publishMode: 'MANUAL', scheduledAt: '2026-07-01T10:00:00Z' },
        { status: 'SCHEDULED', publishMode: 'MANUAL', scheduledAt: '2026-07-02T10:00:00Z' },
      ],
      hasConnectedPublishingAccount: false,
      hasAutopilotEnabled: false,
    })

    expect(summary.scheduledNotPublished).toBe(2)
    expect(summary.hasConnectedPublishingAccount).toBe(false)
    expect(summary.safeCopy.scheduled.en).toBe('2 scheduled in NEXUS — not published')
    expect(summary.safeCopy.accounts.en).toContain('No connected publishing accounts')
    expect(summary.safeCopy.automation.en).toBe('Publishing automation is not enabled.')
    expect(JSON.stringify(summary.safeCopy)).not.toMatch(/ready to activate|Campaign active|automated publishing/i)
  })

  it('one manual published post without URL is recorded but has no platform proof', () => {
    const summary = derivePublishTabReadinessSummary({
      posts: [
        {
          status: 'PUBLISHED',
          publishMode: 'MANUAL',
          manuallyPublishedAt: '2026-07-01T10:00:00Z',
          publishedAt: '2026-07-01T10:00:00Z',
          platformUrl: null,
          platformPostId: null,
        },
      ],
    })

    expect(summary.manualPublished).toBe(1)
    expect(summary.manualPublishedWithoutUrl).toBe(1)
    expect(summary.apiPublished).toBe(0)
    expect(summary.safeCopy.manual.en).toBe('1 user-confirmed manual publish')
    expect(summary.safeCopy.api.en).toBe('No platform/API publishing has occurred')
  })

  it('connected account is not treated as publish-ready by itself', () => {
    const summary = derivePublishTabReadinessSummary({
      posts: [],
      hasConnectedPublishingAccount: true,
    })

    expect(summary.hasConnectedPublishingAccount).toBe(true)
    expect(summary.safeCopy.accounts.en).toContain('page, permission, media, and explicit confirmation checks')
    expect(summary.safeCopy.accounts.en).not.toMatch(/publish-ready|ready to publish/i)
  })

  it('API published posts are separated from user-confirmed manual publishes', () => {
    const summary = derivePublishTabReadinessSummary({
      posts: [
        { status: 'PUBLISHED', publishMode: 'AUTO', platformPostId: 'platform-1' },
        { status: 'PUBLISHED', publishMode: 'MANUAL', manuallyPublishedAt: '2026-07-01T10:00:00Z' },
      ],
    })

    expect(summary.apiPublished).toBe(1)
    expect(summary.manualPublished).toBe(1)
    expect(summary.safeCopy.api.en).toBe('1 platform/API publish recorded')
  })
})
