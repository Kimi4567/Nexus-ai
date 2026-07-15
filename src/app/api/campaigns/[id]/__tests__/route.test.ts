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
    campaignActivity: { create: vi.fn() },
  },
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mockGetServerUserId }))
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

import { DELETE, GET, PATCH } from '../route'

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

describe('PATCH /api/campaigns/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServerUserId.mockResolvedValue('user-1')
    mockPrisma.campaign.findFirst.mockResolvedValue({ id: 'campaign-1', status: 'DRAFT' })
    mockPrisma.campaign.update.mockResolvedValue({ id: 'campaign-1', status: 'DRAFT', favorite: true })
    mockPrisma.campaignActivity.create.mockResolvedValue({})
  })

  const request = (body: Record<string, unknown>) => ({ json: async () => body }) as never
  const params = { params: Promise.resolve({ id: 'campaign-1' }) }

  it('blocks client replacement of server-validated AI output', async () => {
    const response = await PATCH(request({ aiOutput: { sentinelReview: { status: 'passed' } } }), params)

    expect(response.status).toBe(400)
    expect(mockPrisma.campaign.update).not.toHaveBeenCalled()
  })

  it('blocks approval through the generic edit route', async () => {
    const response = await PATCH(request({ status: 'ACTIVE' }), params)
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toBe('USE_STRATEGY_APPROVAL_WORKFLOW')
    expect(mockPrisma.campaign.update).not.toHaveBeenCalled()
  })

  it('allows safe campaign metadata updates including goal', async () => {
    const response = await PATCH(request({ favorite: true, goal: 'LEADS' }), params)

    expect(response.status).toBe(200)
    expect(mockPrisma.campaign.update).toHaveBeenCalledWith({
      where: { id: 'campaign-1' },
      data: { favorite: true, goal: 'LEADS' },
    })
  })

  it('blocks execution-critical campaign edits while the strategy snapshot is approved', async () => {
    mockPrisma.campaign.findFirst.mockResolvedValue({
      id: 'campaign-1',
      status: 'ACTIVE',
      goal: 'LEADS',
      audience: 'Founders',
      tone: 'PROFESSIONAL',
      platforms: ['LINKEDIN'],
    })

    const response = await PATCH(request({ goal: 'SALES', platforms: ['INSTAGRAM'] }), params)
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body).toMatchObject({
      error: 'REVOKE_STRATEGY_APPROVAL_FIRST',
      fields: ['goal', 'platforms'],
    })
    expect(mockPrisma.campaign.update).not.toHaveBeenCalled()
  })

  it('allows restoring only an archived campaign to draft', async () => {
    mockPrisma.campaign.findFirst.mockResolvedValue({ id: 'campaign-1', status: 'ARCHIVED' })

    const response = await PATCH(request({ status: 'DRAFT' }), params)

    expect(response.status).toBe(200)
    expect(mockPrisma.campaign.update).toHaveBeenCalledWith({
      where: { id: 'campaign-1' },
      data: { status: 'DRAFT' },
    })
  })
})
