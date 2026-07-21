import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ gate: vi.fn(), pages: vi.fn() }))
vi.mock('@/lib/landingPageAccess', () => ({ getLandingPageGate: mocks.gate }))
vi.mock('@/lib/prisma', () => ({ prisma: { landingPage: { findMany: mocks.pages } } }))

import sitemap from '@/app/sitemap'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://preview.nexus.example')
  mocks.gate.mockResolvedValue({ ready: true })
  mocks.pages.mockResolvedValue([
    {
      publicId: 'index-me',
      publishedAt: new Date('2026-07-20T12:00:00Z'),
      publishedSnapshot: { seo: { indexable: true } },
    },
    {
      publicId: 'stale-flag',
      publishedAt: new Date('2026-07-20T12:00:00Z'),
      publishedSnapshot: { seo: { indexable: false } },
    },
  ])
})

describe('public sitemap', () => {
  it('includes only pages whose denormalized flag and immutable snapshot both allow indexing', async () => {
    const entries = await sitemap()
    expect(entries.some(entry => entry.url === 'https://preview.nexus.example/lp/index-me')).toBe(true)
    expect(entries.some(entry => entry.url.includes('stale-flag'))).toBe(false)
    expect(mocks.pages).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'PUBLISHED', publishedSeoIndexable: true, publishedHash: { not: null } },
    }))
  })

  it('returns only the static safe sitemap while Landing Pages are gated', async () => {
    mocks.gate.mockResolvedValue({ ready: false })
    const entries = await sitemap()
    expect(entries.every(entry => !entry.url.includes('/lp/'))).toBe(true)
    expect(mocks.pages).not.toHaveBeenCalled()
  })
})
