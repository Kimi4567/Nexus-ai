import type { PublicLandingPageSnapshot } from '@/lib/landingPageContract'

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

export function trustedPublishedCaptureFormPublicId(value: unknown): string | null {
  const snapshot = record(value)
  const primaryCta = record(snapshot?.primaryCta)
  if (!primaryCta) return null

  const typedPublicId = typeof primaryCta.captureFormPublicId === 'string'
    ? primaryCta.captureFormPublicId.trim()
    : ''
  if (primaryCta.kind === 'LEAD_FORM' && typedPublicId) return typedPublicId

  const href = typeof primaryCta.href === 'string' ? primaryCta.href.trim() : ''
  if (!href) return null
  try {
    const target = new URL(href, 'https://www.nexus-grow.com')
    const isTrustedNexusTarget = href.startsWith('/')
      || ['nexus-grow.com', 'www.nexus-grow.com'].includes(target.hostname)
    const match = isTrustedNexusTarget
      ? target.pathname.match(/^\/lead-form\/([^/]+)$/)
      : null
    return match?.[1] ? decodeURIComponent(match[1]).trim() || null : null
  } catch {
    return null
  }
}

export function trustedPublishedCtaHref(
  page: PublicLandingPageSnapshot,
  landingPagePublicId: string,
): string {
  const captureFormPublicId = trustedPublishedCaptureFormPublicId(page)
  if (captureFormPublicId) {
    return `/lead-form/${encodeURIComponent(captureFormPublicId)}?lp=${encodeURIComponent(landingPagePublicId)}`
  }

  return page.primaryCta.href
}
