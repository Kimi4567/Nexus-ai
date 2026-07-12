import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetServerUserId, mockPrisma } = vi.hoisted(() => ({
  mockGetServerUserId: vi.fn(),
  mockPrisma: {
    campaign: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    socialPost: {
      count: vi.fn(),
    },
  },
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mockGetServerUserId }))
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

import { DELETE, GET } from '../route'

describe('GET /api/campaigns/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServerUserId.mockResolvedValue('user-1')
    mockPrisma.campaign.findFirst.mockResolvedValue({
      id: 'campaign-1',
      name: 'Read-only campaign',
      activities: [],
    })
    mockPrisma.socialPost.count.mockResolvedValue(7)
  })

  it('loads campaign detail without mutating the campaign row', async () => {
    const response = await GET({} as never, { params: Promise.resolve({ id: 'campaign-1' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.campaign).toMatchObject({ id: 'campaign-1', socialPostCount: 7 })
    expect(mockPrisma.campaign.update).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/campaigns/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServerUserId.mockResolvedValue('user-1')
    mockPrisma.campaign.findFirst.mockResolvedValue({ id: 'campaign-1' })
    mockPrisma.socialPost.count.mockResolvedValue(0)
    mockPrisma.campaign.delete.mockResolvedValue({ id: 'campaign-1' })
  })

  const request = (confirmation?: string) => ({
    headers: new Headers(confirmation
      ? { 'x-nexus-confirm-campaign-delete': confirmation }
      : undefined),
  }) as never

  it('requires an explicit campaign-id confirmation before permanent deletion', async () => {
    const response = await DELETE(request(), { params: Promise.resolve({ id: 'campaign-1' }) })

    expect(response.status).toBe(400)
    expect(mockPrisma.campaign.delete).not.toHaveBeenCalled()
  })

  it('blocks permanent deletion when Content Hub posts exist', async () => {
    mockPrisma.socialPost.count.mockResolvedValue(3)

    const response = await DELETE(request('campaign-1'), { params: Promise.resolve({ id: 'campaign-1' }) })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body).toMatchObject({ error: 'CAMPAIGN_HAS_CONTENT', socialPostCount: 3 })
    expect(mockPrisma.campaign.delete).not.toHaveBeenCalled()
  })

  it('deletes an early empty campaign only after explicit confirmation', async () => {
    const response = await DELETE(request('campaign-1'), { params: Promise.resolve({ id: 'campaign-1' }) })

    expect(response.status).toBe(200)
    expect(mockPrisma.campaign.delete).toHaveBeenCalledWith({ where: { id: 'campaign-1' } })
  })
})
