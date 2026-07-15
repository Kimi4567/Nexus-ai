import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    workspace: { findFirst: vi.fn() },
    campaign: { findMany: vi.fn() },
    brandProfile: { findUnique: vi.fn() },
    socialPost: { groupBy: vi.fn() },
    marketingLearningEvent: { findMany: vi.fn() },
    adCampaign: { groupBy: vi.fn() },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import { getWorkspaceExecutionTruth } from '@/lib/executionTruthService'

const campaignBase = {
  goal: 'LEADS',
  audience: 'Founders',
  platforms: ['META'],
  updatedAt: new Date('2026-07-12T12:00:00.000Z'),
  aiOutput: {
    strategy: { positioning: 'Clear value' },
    qualityGate: {
      schemaVersion: 1,
      status: 'passed',
      score: 100,
      blockers: [],
      warnings: [],
      checkedAt: '2026-07-14T00:00:00.000Z',
    },
    sentinelReview: { status: 'passed' },
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.workspace.findFirst.mockResolvedValue({ id: 'w1' })
  prismaMock.brandProfile.findUnique.mockResolvedValue({
    workspaceId: 'w1',
    brandName: 'Reviewed Brand',
    industry: 'Consulting',
    description: 'Advisory services for growing businesses.',
    primaryOffer: 'Marketing advisory',
    targetAudience: 'Founders',
  })
  prismaMock.socialPost.groupBy
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
  prismaMock.marketingLearningEvent.findMany.mockResolvedValue([])
  prismaMock.adCampaign.groupBy.mockResolvedValue([])
})

describe('execution truth service', () => {
  it('aggregates campaign and post states into one queue without loading post bodies', async () => {
    prismaMock.campaign.findMany.mockResolvedValue([
      { ...campaignBase, id: 'c1', name: 'Draft strategy', status: 'DRAFT' },
      { ...campaignBase, id: 'c2', name: 'Content ready', status: 'ACTIVE' },
    ])
    prismaMock.socialPost.groupBy
      .mockReset()
      .mockResolvedValueOnce([
        { campaignId: 'c2', status: 'DRAFT', _count: { _all: 2 } },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const result = await getWorkspaceExecutionTruth('u1')

    expect(result.campaigns).toHaveLength(2)
    expect(result.campaigns.find((campaign) => campaign.campaignId === 'c1')?.stage).toBe('STRATEGY_REVIEW')
    expect(result.campaigns.find((campaign) => campaign.campaignId === 'c2')?.stage).toBe('CONTENT_REVIEW')
    expect(prismaMock.socialPost.groupBy).toHaveBeenCalledTimes(5)
    expect(prismaMock.campaign.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }))
  })

  it('counts approved posts missing media as a media-review action', async () => {
    prismaMock.campaign.findMany.mockResolvedValue([
      { ...campaignBase, id: 'c2', name: 'Content ready', status: 'ACTIVE' },
    ])
    prismaMock.socialPost.groupBy
      .mockReset()
      .mockResolvedValueOnce([
        { campaignId: 'c2', status: 'APPROVED', _count: { _all: 3 } },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { campaignId: 'c2', _count: { _all: 3 } },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const result = await getWorkspaceExecutionTruth('u1')

    expect(result.campaigns[0].stage).toBe('MEDIA_REVIEW')
    expect(result.queue[0].kind).toBe('REVIEW_MEDIA')
  })

  it('surfaces a scheduled post whose publish time passed without publication', async () => {
    prismaMock.campaign.findMany.mockResolvedValue([
      { ...campaignBase, id: 'c2', name: 'Overdue schedule', status: 'ACTIVE' },
    ])
    prismaMock.socialPost.groupBy
      .mockReset()
      .mockResolvedValueOnce([
        { campaignId: 'c2', status: 'SCHEDULED', _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { campaignId: 'c2', _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([])

    const result = await getWorkspaceExecutionTruth('u1')

    expect(result.campaigns[0].stage).toBe('NEEDS_ATTENTION')
    expect(result.campaigns[0].posts.overdueScheduled).toBe(1)
    expect(result.queue[0].kind).toBe('RESOLVE_OVERDUE_SCHEDULE')
  })

  it('treats missing copy approval evidence as more urgent than media readiness', async () => {
    prismaMock.campaign.findMany.mockResolvedValue([
      { ...campaignBase, id: 'c2', name: 'Legacy approval', status: 'ACTIVE' },
    ])
    prismaMock.socialPost.groupBy
      .mockReset()
      .mockResolvedValueOnce([{ campaignId: 'c2', status: 'APPROVED', _count: { _all: 1 } }])
      .mockResolvedValueOnce([{ campaignId: 'c2', _count: { _all: 1 } }])
      .mockResolvedValueOnce([{ campaignId: 'c2', _count: { _all: 1 } }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const result = await getWorkspaceExecutionTruth('u1')

    expect(result.campaigns[0].stage).toBe('CONTENT_REVIEW')
    expect(result.campaigns[0].posts.approvedMissingApproval).toBe(1)
    expect(result.queue[0]).toMatchObject({ kind: 'REVIEW_CONTENT', priority: 'critical' })
  })

  it('scopes a campaign truth request to the requested owned campaign', async () => {
    prismaMock.campaign.findMany.mockResolvedValue([
      { ...campaignBase, id: 'c2', name: 'Content ready', status: 'ACTIVE' },
    ])

    await getWorkspaceExecutionTruth('u1', { campaignId: 'c2' })

    expect(prismaMock.campaign.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId: 'w1', id: 'c2' },
      take: 1,
    }))
  })

  it('returns an empty truth contract when the user has no workspace', async () => {
    prismaMock.workspace.findFirst.mockResolvedValue(null)

    const result = await getWorkspaceExecutionTruth('u1')

    expect(result.summary.campaigns).toBe(0)
    expect(result.queue).toEqual([])
    expect(prismaMock.campaign.findMany).not.toHaveBeenCalled()
  })
})
