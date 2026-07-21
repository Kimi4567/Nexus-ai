import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildLandingPageMetadata, landingPageCanonicalUrl } from '@/lib/landingPageSeo'
import type { PublicLandingPageSnapshot } from '@/lib/landingPageContract'

const snapshot: PublicLandingPageSnapshot = {
  schemaVersion: 1,
  publicId: 'public-page-1',
  locale: 'EN',
  headline: 'Published offer headline',
  subheadline: 'Published offer summary',
  body: null,
  benefits: [],
  proof: null,
  primaryCta: { label: 'Start', href: 'https://example.com/', kind: 'EXTERNAL', captureFormPublicId: null },
  theme: { variant: 'IVORY' },
  seo: {
    title: 'Reviewed search title',
    description: 'A reviewed description of this campaign page, its intended audience, and the next step a visitor can take.',
    indexable: true,
  },
}

afterEach(() => vi.unstubAllEnvs())

describe('landing-page SEO metadata', () => {
  it('builds a canonical, indexable metadata contract only from the published snapshot', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://preview.nexus.example/')
    const metadata = buildLandingPageMetadata(snapshot, snapshot.publicId)
    expect(metadata.title).toEqual({ absolute: 'Reviewed search title' })
    expect(metadata.alternates).toEqual({ canonical: 'https://preview.nexus.example/lp/public-page-1' })
    expect(metadata.robots).toMatchObject({ index: true, follow: true })
    expect(metadata.openGraph).toMatchObject({ url: 'https://preview.nexus.example/lp/public-page-1', type: 'website' })
  })

  it('fails closed to noindex for legacy or non-indexable snapshots', () => {
    const metadata = buildLandingPageMetadata({ ...snapshot, seo: undefined }, snapshot.publicId)
    expect(metadata.robots).toMatchObject({ index: false, follow: false, nocache: true })
    expect(metadata.title).toEqual({ absolute: 'Published offer headline' })
  })

  it('refuses an unsafe configured canonical origin', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'javascript:alert(1)')
    expect(landingPageCanonicalUrl('page one')).toBe('https://nexus-grow.com/lp/page%20one')
  })
})
