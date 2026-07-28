import { describe, expect, it } from 'vitest'
import type { PublicLandingPageSnapshot } from '@/lib/landingPageContract'
import {
  trustedPublishedCaptureFormPublicId,
  trustedPublishedCtaHref,
} from '@/lib/publicLandingPageCta'

function snapshot(primaryCta: PublicLandingPageSnapshot['primaryCta']): PublicLandingPageSnapshot {
  return {
    schemaVersion: 1,
    publicId: 'stored-page-id',
    locale: 'AR',
    headline: 'Headline',
    subheadline: null,
    body: null,
    benefits: [],
    proof: null,
    primaryCta,
    theme: { variant: 'VIOLET' },
  }
}

describe('trustedPublishedCtaHref', () => {
  it('rebuilds legacy lead-form links from trusted identifiers and preserves attribution', () => {
    const page = snapshot({
      label: 'Book',
      href: 'https://www.nexus-grow.com/lead-form/legacy-without-attribution',
      kind: 'LEAD_FORM',
      captureFormPublicId: 'form/id',
    })

    expect(trustedPublishedCtaHref(page, 'landing/id')).toBe(
      '/lead-form/form%2Fid?lp=landing%2Fid',
    )
  })

  it('keeps approved external CTA links unchanged', () => {
    const page = snapshot({
      label: 'Visit',
      href: 'https://example.com/offer',
      kind: 'EXTERNAL',
      captureFormPublicId: null,
    })

    expect(trustedPublishedCtaHref(page, 'landing-1')).toBe('https://example.com/offer')
  })

  it('repairs legacy NEXUS lead-form URLs that predate typed CTA metadata', () => {
    const page = snapshot({
      label: 'Book',
      href: 'https://www.nexus-grow.com/lead-form/legacy-form?utm_source=saved',
      kind: 'EXTERNAL',
      captureFormPublicId: null,
    })

    expect(trustedPublishedCtaHref(page, 'landing-1')).toBe(
      '/lead-form/legacy-form?lp=landing-1',
    )
    expect(trustedPublishedCaptureFormPublicId(page)).toBe('legacy-form')
  })

  it('does not reinterpret third-party URLs as NEXUS capture forms', () => {
    const page = snapshot({
      label: 'Visit',
      href: 'https://example.com/lead-form/external-form',
      kind: 'EXTERNAL',
      captureFormPublicId: null,
    })

    expect(trustedPublishedCaptureFormPublicId(page)).toBeNull()
    expect(trustedPublishedCtaHref(page, 'landing-1')).toBe(
      'https://example.com/lead-form/external-form',
    )
  })
})
