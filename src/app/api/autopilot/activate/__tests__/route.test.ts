import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRawUnsafe: vi.fn(),
    user: { findUnique: vi.fn() },
    subscription: { findUnique: vi.fn() },
    campaign: { updateMany: vi.fn() },
    socialPost: { count: vi.fn(), create: vi.fn() },
    campaignActivity: { create: vi.fn() },
  }
  return {
    tx,
    adminGetUser: vi.fn(),
    workspaceFindFirst: vi.fn(),
    campaignFindFirst: vi.fn(),
    brandFindFirst: vi.fn(),
    queueCount: vi.fn(),
    transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    approval: vi.fn(),
    deduct: vi.fn(),
    refund: vi.fn(),
    refundForTransaction: vi.fn(),
    rateLimit: vi.fn(),
  }
})

vi.mock('@/lib/supabaseAuth', () => ({
  adminClient: { auth: { getUser: mocks.adminGetUser } },
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: { findFirst: mocks.workspaceFindFirst },
    campaign: { findFirst: mocks.campaignFindFirst },
    brandProfile: { findFirst: mocks.brandFindFirst },
    socialPost: { count: mocks.queueCount },
    $transaction: mocks.transaction,
  },
}))
vi.mock('@/lib/strategyApprovalService', () => ({
  getStrategyApprovalContract: mocks.approval,
  StrategyApprovalError: class StrategyApprovalError extends Error {},
}))
vi.mock('@/lib/credits', () => ({
  checkAndDeductCredits: mocks.deduct,
  refundCredits: mocks.refund,
  refundCreditsForTransaction: mocks.refundForTransaction,
}))
vi.mock('@/lib/dbRateLimit', () => ({ aiRateLimitDb: mocks.rateLimit }))

import { POST } from '@/app/api/autopilot/activate/route'

function request() {
  return new NextRequest('http://localhost/api/autopilot/activate', {
    method: 'POST',
    headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaignId: 'c1' }),
  })
}

const workspace = {
  id: 'w1',
  integrations: [{
    id: 'i1',
    type: 'META',
    config: { pages: [{ id: 'p1', name: 'Brand page' }] },
    accountId: 'a1',
    accountName: 'Brand page',
  }],
}

const campaign = {
  id: 'c1',
  name: 'Launch',
  media: [],
  aiOutput: {
    language: 'en',
    strategy: {
      weeklyExecutionPlan: [{
        week: 1,
        objective: 'Awareness',
        keyMessage: 'Clear value',
        cta: 'Learn more',
        platforms: ['instagram'],
        assetsNeeded: [],
      }],
      contentAngles: [{ hook: 'Start here' }],
    },
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.adminGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  mocks.workspaceFindFirst.mockResolvedValue(workspace)
  mocks.campaignFindFirst.mockResolvedValue(campaign)
  mocks.brandFindFirst.mockResolvedValue({ brandName: 'Nexus', visualStyle: 'premium' })
  mocks.approval.mockResolvedValue({ state: 'approved' })
  mocks.queueCount.mockResolvedValue(0)
  mocks.rateLimit.mockResolvedValue({ ok: true })
  mocks.deduct.mockResolvedValue({ ok: true, creditsUsed: 8, creditsRemaining: 92, isUnlimited: false })
  mocks.tx.campaign.updateMany.mockResolvedValue({ count: 1 })
  mocks.tx.$queryRawUnsafe.mockResolvedValue([])
  mocks.tx.user.findUnique.mockResolvedValue({ subscriptionStatus: 'BUSINESS', role: 'USER' })
  mocks.tx.subscription.findUnique.mockResolvedValue(null)
  mocks.tx.socialPost.count.mockResolvedValue(0)
  mocks.tx.socialPost.create.mockImplementation(async ({ data }) => ({ id: 'post-1', ...data }))
  mocks.tx.campaignActivity.create.mockResolvedValue({})
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: async () => ({ choices: [{ message: { content: 'Prepared caption' } }] }),
  }))
})

afterEach(() => vi.unstubAllGlobals())

describe('POST /api/autopilot/activate', () => {
  it('does not charge or generate before strategy approval', async () => {
    mocks.approval.mockResolvedValue({ state: 'ready_for_review' })

    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('STRATEGY_APPROVAL_REQUIRED')
    expect(mocks.deduct).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('checks for an existing queue before charging credits', async () => {
    mocks.queueCount.mockResolvedValue(2)

    const response = await POST(request())

    expect(response.status).toBe(409)
    expect(mocks.deduct).not.toHaveBeenCalled()
  })

  it('atomically prepares drafts without scheduling or publishing', async () => {
    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      postsPrepared: 1,
      postsScheduled: 0,
      requiresApproval: true,
      publishingEnabled: false,
    })
    expect(mocks.transaction).toHaveBeenCalledTimes(2)
    expect(mocks.tx.socialPost.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'DRAFT', publishMode: 'MANUAL' }),
    })
    expect(mocks.tx.campaign.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'c1', workspaceId: 'w1', status: 'ACTIVE' }),
    }))
  })
})
