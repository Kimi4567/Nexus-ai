import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildPublicLandingPageSnapshot,
  conversionDedupeKey,
  conversionFingerprint,
  hashLandingPageSnapshot,
  isPublicLandingPageSnapshot,
  parseLandingPageDraft,
  publishedSnapshotCaptureFormPublicId,
  publishedSnapshotIsIndexable,
} from '@/lib/landingPageContract'

afterEach(() => {
  vi.unstubAllEnvs()
})

function validDraft(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Summer demand page',
    campaignId: 'campaign-1',
    captureFormId: 'form-1',
    locale: 'AR',
    headline: 'عرض واضح لعميل واضح',
    subheadline: 'تفاصيل مختصرة',
    body: 'نص العرض',
    benefits: ['ميزة أولى', 'ميزة ثانية'],
    proof: 'معلومة قدمها النشاط التجاري',
    primaryCtaLabel: 'ابدأ الآن',
    primaryCtaUrl: null,
    theme: { variant: 'MIDNIGHT' },
    seoTitle: null,
    seoDescription: null,
    seoIndexable: false,
    ...overrides,
  }
}

describe('landing page contract', () => {
  it('accepts structured plain text and caps benefit count', () => {
    const parsed = parseLandingPageDraft(validDraft({ benefits: ['1', '2', '3', '4', '5', '6', '7'] }))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.value.benefits).toHaveLength(6)
  })

  it('rejects markup, scripts, and insecure external CTAs', () => {
    expect(parseLandingPageDraft(validDraft({ headline: '<script>alert(1)</script>' }))).toMatchObject({ ok: false })
    expect(parseLandingPageDraft(validDraft({ primaryCtaUrl: 'javascript:alert(1)' }))).toMatchObject({ ok: false })
    vi.stubEnv('NODE_ENV', 'production')
    expect(parseLandingPageDraft(validDraft({ captureFormId: null, primaryCtaUrl: 'http://example.com' }))).toMatchObject({ ok: false })
  })

  it('publishes a form-linked immutable snapshot and hashes it deterministically', () => {
    const parsed = parseLandingPageDraft(validDraft())
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const snapshot = buildPublicLandingPageSnapshot({
      publicId: 'page-public-1',
      draft: parsed.value,
      captureFormPublicId: 'form-public-1',
    })
    expect(snapshot.primaryCta).toEqual({
      label: 'ابدأ الآن',
      href: '/lead-form/form-public-1?lp=page-public-1',
      kind: 'LEAD_FORM',
      captureFormPublicId: 'form-public-1',
    })
    expect(hashLandingPageSnapshot(snapshot)).toBe(hashLandingPageSnapshot(snapshot))
    expect(publishedSnapshotCaptureFormPublicId(snapshot)).toBe('form-public-1')
    expect(snapshot.seo).toEqual({ title: null, description: null, indexable: false })
    expect(publishedSnapshotIsIndexable(snapshot)).toBe(false)
    expect(isPublicLandingPageSnapshot(snapshot, 'page-public-1')).toBe(true)
  })

  it('rejects corrupt or unsafe persisted snapshots at the public rendering boundary', () => {
    const parsed = parseLandingPageDraft(validDraft())
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const snapshot = buildPublicLandingPageSnapshot({
      publicId: 'page-public-1',
      draft: parsed.value,
      captureFormPublicId: 'form-public-1',
    })

    expect(isPublicLandingPageSnapshot({ ...snapshot, primaryCta: undefined }, 'page-public-1')).toBe(false)
    expect(isPublicLandingPageSnapshot({
      ...snapshot,
      primaryCta: { ...snapshot.primaryCta, href: 'javascript:alert(1)' },
    }, 'page-public-1')).toBe(false)
    expect(isPublicLandingPageSnapshot(snapshot, 'different-page')).toBe(false)
  })

  it('requires complete, plain metadata before search indexing can be requested', () => {
    expect(parseLandingPageDraft(validDraft({ seoIndexable: true }))).toMatchObject({ ok: false })
    expect(parseLandingPageDraft(validDraft({
      seoIndexable: true,
      seoTitle: 'Clear campaign offer',
      seoDescription: 'A source-grounded description of the campaign offer, intended audience, and next step.',
    }))).toMatchObject({ ok: true })
    expect(parseLandingPageDraft(validDraft({
      seoIndexable: true,
      seoTitle: '<b>Search title</b>',
      seoDescription: 'A source-grounded description of the campaign offer, intended audience, and next step.',
    }))).toMatchObject({ ok: false })
    expect(parseLandingPageDraft(validDraft({ seoIndexable: 'true' }))).toMatchObject({ ok: false })
  })

  it('refuses publication without a live form or a safe external destination', () => {
    const parsed = parseLandingPageDraft(validDraft({ captureFormId: null, primaryCtaUrl: null }))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(() => buildPublicLandingPageSnapshot({ publicId: 'page-1', draft: parsed.value })).toThrow(/required before publishing/i)
  })

  it('uses keyed pseudonyms and time buckets for browser-event deduplication', () => {
    const fingerprint = conversionFingerprint('a'.repeat(32), ['203.0.113.1', 'browser'])
    expect(fingerprint).toHaveLength(64)
    expect(fingerprint).not.toContain('203.0.113.1')
    const first = conversionDedupeKey({ pageId: 'page-1', eventType: 'PAGE_VIEW', fingerprintHash: fingerprint, occurredAt: new Date('2026-07-20T10:00:00Z') })
    const duplicate = conversionDedupeKey({ pageId: 'page-1', eventType: 'PAGE_VIEW', fingerprintHash: fingerprint, occurredAt: new Date('2026-07-20T10:20:00Z') })
    const later = conversionDedupeKey({ pageId: 'page-1', eventType: 'PAGE_VIEW', fingerprintHash: fingerprint, occurredAt: new Date('2026-07-20T10:31:00Z') })
    expect(first).toBe(duplicate)
    expect(first).not.toBe(later)
  })
})
