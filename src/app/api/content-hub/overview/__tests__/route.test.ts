import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getUserId: vi.fn(),
  workspaceFindFirst: vi.fn(),
  campaignFindMany: vi.fn(),
  postFindMany: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.getUserId }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: { findFirst: mocks.workspaceFindFirst },
    campaign: { findMany: mocks.campaignFindMany },
    socialPost: { findMany: mocks.postFindMany },
  },
}))

import { GET } from '@/app/api/content-hub/overview/route'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUserId.mockResolvedValue('user-1')
  mocks.workspaceFindFirst.mockResolvedValue({ id: 'workspace-1' })
  mocks.campaignFindMany.mockResolvedValue([
    { id: 'campaign-1', name: 'Launch', platforms: ['LINKEDIN'], updatedAt: new Date() },
  ])
  mocks.postFindMany.mockResolvedValue([
    { id: 'post-1', campaignId: 'campaign-1', platform: 'META', publishTarget: 'INSTAGRAM', caption: 'Draft' },
  ])
})

describe('GET /api/content-hub/overview', () => {
  it('fails closed without authentication', async () => {
    mocks.getUserId.mockResolvedValue(null)

    const response = await GET(new NextRequest('http://localhost/api/content-hub/overview'))

    expect(response.status).toBe(401)
    expect(mocks.workspaceFindFirst).not.toHaveBeenCalled()
  })

  it('returns one workspace-consistent campaign and post snapshot', async () => {
    const response = await GET(new NextRequest('http://localhost/api/content-hub/overview'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(mocks.campaignFindMany).toHaveBeenCalledTimes(1)
    expect(mocks.postFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId: 'workspace-1', campaignId: { in: ['campaign-1'] } },
    }))
    expect(body.posts).toEqual([
      expect.objectContaining({
        id: 'post-1',
        campaignName: 'Launch',
        providerPlatform: 'META',
        platform: 'INSTAGRAM',
      }),
    ])
  })
})
