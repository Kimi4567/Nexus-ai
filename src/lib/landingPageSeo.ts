import type { Metadata } from 'next'
import { publishedSnapshotIsIndexable, type PublicLandingPageSnapshot } from '@/lib/landingPageContract'

const PRODUCTION_FALLBACK_URL = 'https://nexus-grow.com'

export function landingPageCanonicalUrl(publicId: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '')
  let baseUrl = PRODUCTION_FALLBACK_URL
  if (configured) {
    try {
      const parsed = new URL(configured)
      const localDevelopment = process.env.NODE_ENV !== 'production'
        && parsed.protocol === 'http:'
        && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
      if (parsed.protocol === 'https:' || localDevelopment) baseUrl = parsed.origin
    } catch {
      // Fail closed to the known canonical production origin.
    }
  }
  return `${baseUrl}/lp/${encodeURIComponent(publicId)}`
}

function compact(value: string | null | undefined, maximum: number): string | null {
  if (!value) return null
  const result = value.replace(/\s+/g, ' ').trim()
  return result ? result.slice(0, maximum) : null
}

export function buildLandingPageMetadata(
  snapshot: PublicLandingPageSnapshot,
  publicId: string,
): Metadata {
  const title = compact(snapshot.seo?.title, 70) || compact(snapshot.headline, 70) || 'Campaign landing page'
  const description = compact(snapshot.seo?.description, 180)
    || compact(snapshot.subheadline, 180)
    || compact(snapshot.body, 180)
    || undefined
  const canonical = landingPageCanonicalUrl(publicId)
  const indexable = publishedSnapshotIsIndexable(snapshot)

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: false, nocache: true },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      locale: snapshot.locale === 'EN' ? 'en_US' : 'ar_AR',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export function unavailableLandingPageMetadata(): Metadata {
  return {
    title: { absolute: 'Page unavailable' },
    robots: { index: false, follow: false, nocache: true },
  }
}
