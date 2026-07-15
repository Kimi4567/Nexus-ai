import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getServerUserId: vi.fn(),
  workspaceFindFirst: vi.fn(),
  mediaFindMany: vi.fn(),
  mediaCount: vi.fn(),
  visualFindMany: vi.fn(),
  visualCount: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.getServerUserId }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: { findFirst: mocks.workspaceFindFirst },
    media: { findMany: mocks.mediaFindMany, count: mocks.mediaCount },
    generatedVisual: { findMany: mocks.visualFindMany, count: mocks.visualCount },
  },
}))

import { GET } from '@/app/api/media/route'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getServerUserId.mockResolvedValue('u1')
  mocks.workspaceFindFirst.mockResolvedValue({ id: 'w1' })
  mocks.mediaFindMany.mockResolvedValue([{
    id: 'm1', fileName: 'brief.png', mimeType: 'image/png', type: 'IMAGE',
    url: 'https://cdn.example/brief.png', createdAt: new Date('2026-07-14T09:00:00Z'),
  }])
  mocks.mediaCount.mockResolvedValue(1)
  mocks.visualFindMany.mockResolvedValue([{
    id: 'v1', imageUrl: 'https://cdn.example/generated.png', thumbnailUrl: null,
    campaignName: 'Launch', brandName: 'Nexus', visualType: 'SOCIAL_POST',
    createdAt: new Date('2026-07-15T09:00:00Z'),
  }])
  mocks.visualCount.mockResolvedValue(1)
})

describe('GET /api/media unified asset library', () => {
  it('returns generated and uploaded assets in one newest-first page', async () => {
    const response = await GET(new Request('http://localhost/api/media?page=1&limit=24'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.media).toHaveLength(2)
    expect(body.media[0]).toMatchObject({
      id: 'generated:v1',
      generatedVisualId: 'v1',
      assetKind: 'GENERATED_VISUAL',
      readOnly: true,
      type: 'IMAGE',
    })
    expect(body.media[1]).toMatchObject({ id: 'm1', assetKind: 'UPLOADED_MEDIA', readOnly: false })
    expect(body.pagination).toMatchObject({ total: 2, pages: 1 })
  })

  it('does not query image-only generated visuals for a video filter', async () => {
    const response = await GET(new Request('http://localhost/api/media?type=VIDEO'))
    expect(response.status).toBe(200)
    expect(mocks.visualFindMany).not.toHaveBeenCalled()
    expect(mocks.visualCount).not.toHaveBeenCalled()
  })

  it('can return uploaded assets only for metadata-sensitive paid creative flows', async () => {
    const response = await GET(new Request('http://localhost/api/media?source=UPLOADED_MEDIA'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.media).toHaveLength(1)
    expect(body.media[0]).toMatchObject({ id: 'm1', assetKind: 'UPLOADED_MEDIA' })
    expect(mocks.visualFindMany).not.toHaveBeenCalled()
    expect(mocks.visualCount).not.toHaveBeenCalled()
  })

  it('limits campaign pickers to global uploads and generated visuals from that campaign', async () => {
    const response = await GET(new Request('http://localhost/api/media?campaignId=c1'))

    expect(response.status).toBe(200)
    expect(mocks.mediaFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        workspaceId: 'w1',
        AND: [{ OR: [{ campaignId: null }, { campaignId: 'c1' }] }],
      }),
    }))
    expect(mocks.visualFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId: 'w1', campaignId: 'c1' }),
    }))
  })
})
