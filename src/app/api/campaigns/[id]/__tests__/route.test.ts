import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetServerUserId, mockPrisma } = vi.hoisted(() => ({
  mockGetServerUserId: vi.fn(),
  mockPrisma: {
    campaign: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    socialPost: {
      count: vi.fn(),
    },
  },
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mockGetServerUserId }))
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

import { GET } from '../route'

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
    const response = await GET({} as never, { params: { id: 'campaign-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.campaign).toMatchObject({ id: 'campaign-1', socialPostCount: 7 })
    expect(mockPrisma.campaign.update).not.toHaveBeenCalled()
  })
})
