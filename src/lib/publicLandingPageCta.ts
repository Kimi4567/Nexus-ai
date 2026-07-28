import type { PublicLandingPageSnapshot } from '@/lib/landingPageContract'

export function trustedPublishedCtaHref(
  page: PublicLandingPageSnapshot,
  landingPagePublicId: string,
): string {
  const captureFormPublicId = page.primaryCta.captureFormPublicId?.trim()
  if (page.primaryCta.kind === 'LEAD_FORM' && captureFormPublicId) {
    return `/lead-form/${encodeURIComponent(captureFormPublicId)}?lp=${encodeURIComponent(landingPagePublicId)}`
  }

  return page.primaryCta.href
}
