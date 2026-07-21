import { MetadataRoute } from 'next'
import { getLandingPageGate } from '@/lib/landingPageAccess'
import { publishedSnapshotIsIndexable } from '@/lib/landingPageContract'
import { landingPageCanonicalUrl } from '@/lib/landingPageSeo'
import { prisma } from '@/lib/prisma'

const BASE_URL = 'https://nexus-grow.com'
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseEntries: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/auth/register`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/auth/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/refund`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
  ]

  const gate = await getLandingPageGate()
  if (!gate.ready) return baseEntries

  try {
    const pages = await prisma.landingPage.findMany({
      where: {
        status: 'PUBLISHED',
        publishedSeoIndexable: true,
        publishedHash: { not: null },
      },
      select: { publicId: true, publishedAt: true, publishedSnapshot: true },
      orderBy: { publishedAt: 'desc' },
      take: 5_000,
    })
    return [
      ...baseEntries,
      ...pages
        .filter(page => publishedSnapshotIsIndexable(page.publishedSnapshot))
        .map(page => ({
          url: landingPageCanonicalUrl(page.publicId),
          lastModified: page.publishedAt || undefined,
          changeFrequency: 'monthly' as const,
          priority: 0.7,
        })),
    ]
  } catch (error) {
    console.warn('[Sitemap] Indexable landing pages unavailable; returning the static sitemap.', error)
    return baseEntries
  }
}
