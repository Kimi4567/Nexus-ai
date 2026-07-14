import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock, txMock } = vi.hoisted(() => {
  const tx = {
    campaign: { updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    campaignActivity: { create: vi.fn() },
    marketingLearningEvent: { create: vi.fn() },
  }
  return {
    txMock: tx,
    prismaMock: {
      campaign: { findFirst: vi.fn() },
      marketingLearningEvent: { findFirst: vi.fn() },
      socialPost: { count: vi.fn() },
      adCampaign: { count: vi.fn() },
      $transaction: vi.fn(async (callback: (tx: any) => unknown) => callback(tx)),
    },
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import {
  approveCampaignStrategy,
  StrategyApprovalError,
} from '@/lib/strategyApprovalService'

const draft = {
  id: 'c1',
  workspaceId: 'w1',
  name: 'Launch',
  status: 'DRAFT',
  goal: 'LEADS',
  audience: 'Founders',
  platforms: ['INSTAGRAM'],
  aiOutput: {
    strategy: { positioning: 'Controlled automation' },
    qualityGate: { schemaVersion: 1, status: 'passed', blockers: [] },
    sentinelReview: { status: 'passed' },
  },
  updatedAt: new Date('2026-07-12T10:00:00.000Z'),
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.socialPost.count.mockResolvedValue(0)
  prismaMock.adCampaign.count.mockResolvedValue(0)
  prismaMock.marketingLearningEvent.findFirst.mockResolvedValue(null)
  txMock.campaign.updateMany.mockResolvedValue({ count: 1 })
  txMock.campaign.findUniqueOrThrow.mockResolvedValue({ workspaceId: 'w1' })
  txMock.campaignActivity.create.mockResolvedValue({})
  txMock.marketingLearningEvent.create.mockResolvedValue({})
})

describe('strategy approval service', () => {
  it('atomically approves a ready draft and appends decision history', async () => {
    prismaMock.campaign.findFirst
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce({ ...draft, status: 'ACTIVE' })
    prismaMock.marketingLearningEvent.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        eventType: 'STRATEGY_APPROVED',
        createdAt: new Date('2026-07-12T11:00:00.000Z'),
        source: 'CAMPAIGN_REVIEW',
      })

    const result = await approveCampaignStrategy('c1', 'u1')

    expect(result.unchanged).toBe(false)
    expect(result.contract.state).toBe('approved')
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(txMock.campaign.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'c1', status: 'DRAFT' }),
      data: { status: 'ACTIVE' },
    }))
    expect(txMock.campaignActivity.create).toHaveBeenCalledTimes(1)
    expect(txMock.marketingLearningEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ eventType: 'STRATEGY_APPROVED', actor: 'USER' }),
    }))
  })

  it('does not write when the campaign is already approved', async () => {
    prismaMock.campaign.findFirst.mockResolvedValue({ ...draft, status: 'ACTIVE' })

    const result = await approveCampaignStrategy('c1', 'u1')

    expect(result.unchanged).toBe(true)
    expect(result.contract.state).toBe('approved')
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('returns explicit blockers instead of activating an unreviewed strategy', async () => {
    prismaMock.campaign.findFirst.mockResolvedValue({
      ...draft,
      aiOutput: { strategy: { positioning: 'Draft' } },
    })

    await expect(approveCampaignStrategy('c1', 'u1')).rejects.toMatchObject({
      code: 'STRATEGY_APPROVAL_BLOCKED',
      status: 409,
    })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})
