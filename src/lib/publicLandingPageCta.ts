import type { PublicLandingPageSnapshot } from '@/lib/landingPageContract'

export function trustedPublishedCtaHref(
  page: PublicLandingPageSnapshot,
  landingPagePublicId: string,
): string {
  const captureFormPublicId = page.primaryCta.captureFormPublicId?.trim()
  if (page.primaryCta.kind === 'LEAD_FORM' && captureFormPublicId) {
    return `/lead-form/${encodeURIComponent(captureFormPublicId)}?lp=${encodeURIComponent(landingPagePublicId)}`
  }

  try {
    const href = page.primaryCta.href.trim()
    const target = new URL(href, 'https://www.nexus-grow.com')
    const isTrustedNexusTarget = href.startsWith('/')
      || ['nexus-grow.com', 'www.nexus-grow.com'].includes(target.hostname)
    if (isTrustedNexusTarget && /^\/lead-form\/[^/]+$/.test(target.pathname)) {
      target.searchParams.set('lp', landingPagePublicId)
      return `${target.pathname}${target.search}${target.hash}`
    }
  } catch {
    // Preserve malformed legacy values so rendering remains fail-safe.
  }

  return page.primaryCta.href
}
