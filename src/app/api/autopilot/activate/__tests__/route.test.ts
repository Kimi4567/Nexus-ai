import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => {
  const tx = {
    campaign: { updateMany: vi.fn() },
    campaignActivity: { create: vi.fn() },
  }
  return {
    tx,
    adminGetUser: vi.fn(),
    workspaceFindFirst: vi.fn(),
    campaignFindFirst: vi.fn(),
    brandFindUnique: vi.fn(),
    socialPostFindMany: vi.fn(),
    approval: vi.fn(),
    reviewStrategyGrounding: vi.fn(),
    transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  }
})

vi.mock('@/lib/supabaseAuth', () => ({
  adminClient: { auth: { getUser: mocks.adminGetUser } },
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: { findFirst: mocks.workspaceFindFirst },
    campaign: { findFirst: mocks.campaignFindFirst },
    brandProfile: { findUnique: mocks.brandFindUnique },
    socialPost: { findMany: mocks.socialPostFindMany },
    $transaction: mocks.transaction,
  },
}))
vi.mock('@/lib/strategyApprovalService', () => ({
  getStrategyApprovalContract: mocks.approval,
  StrategyApprovalError: class StrategyApprovalError extends Error {},
}))
vi.mock('@/lib/ai/marketingQualityGate', () => ({
  reviewStrategyGrounding: mocks.reviewStrategyGrounding,
}))

import { POST } from '@/app/api/autopilot/activate/route'

function request(explicitAutopilotConfirmed = true) {
  return new NextRequest('http://localhost/api/autopilot/activate', {
    method: 'POST',
    headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaignId: 'c1', explicitAutopilotConfirmed }),
  })
}

const campaign = {
  id: 'c1',
  name: 'Launch',
  status: 'ACTIVE',
  goal: 'LEADS',
  platforms: ['INSTAGRAM'],
  aiOutput: { strategy: { positioning: 'A reviewed service offer for local business owners' } },
}

const autoPost = {
  id: 'post-1',
  campaignId: 'c1',
  workspaceId: 'w1',
  status: 'SCHEDULED',
  approvedAt: new Date('2026-07-14T08:45:00.000Z'),
  publishMode: 'AUTO',
  autoPublishConsentAt: new Date('2026-07-14T09:00:00.000Z'),
  scheduledAt: new Date('2026-07-15T09:00:00.000Z'),
  integrationId: 'integration-1',
  integration: { status: 'CONNECTED' },
  caption: 'A practical review of the saved service offer for local business owners.',
  imageUrl: 'https://cdn.example.com/reviewed.jpg',
  generationStatus: 'DONE',
  mediaSource: 'GENERATE',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.adminGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  mocks.workspaceFindFirst.mockResolvedValue({ id: 'w1' })
  mocks.campaignFindFirst.mockResolvedValue(campaign)
  mocks.brandFindUnique.mockResolvedValue({
    workspaceId: 'w1', brandName: 'Nexus', industry: 'Services',
    primaryOffer: 'A reviewed service', targetAudience: 'Local business owners',
  })
  mocks.approval.mockResolvedValue({ state: 'approved' })
  mocks.reviewStrategyGrounding.mockReturnValue({
    schemaVersion: 1, status: 'passed', score: 100, blockers: [], warnings: [], checkedAt: '2026-07-14T00:00:00.000Z',
  })
  mocks.socialPostFindMany.mockResolvedValue([autoPost])
  mocks.tx.campaign.updateMany.mockResolvedValue({ count: 1 })
  mocks.tx.campaignActivity.create.mockResolvedValue({})
})

describe('POST /api/autopilot/activate', () => {
  it('requires explicit activation consent and performs no mutation without it', async () => {
    const response = await POST(request(false))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('EXPLICIT_AUTOPILOT_CONFIRMATION_REQUIRED')
    expect(body.creditsUsed).toBe(0)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('requires an approved strategy', async () => {
    mocks.approval.mockResolvedValue({ state: 'ready_for_review' })

    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('STRATEGY_APPROVAL_REQUIRED')
    expect(mocks.socialPostFindMany).not.toHaveBeenCalled()
  })

  it('requires at least one explicitly consented AUTO schedule', async () => {
    mocks.socialPostFindMany.mockResolvedValue([])

    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('AUTO_SCHEDULE_REQUIRED')
    expect(body.creditsUsed).toBe(0)
  })

  it('revalidates Brand Brain grounding before enablement', async () => {
    mocks.reviewStrategyGrounding.mockReturnValue({
      schemaVersion: 1,
      status: 'blocked',
      score: 70,
      blockers: [{ code: 'strategy_missing_brand_relevance', severity: 'blocker', path: 'strategy', message: 'Drifted.' }],
      warnings: [],
      checkedAt: '2026-07-14T00:00:00.000Z',
    })

    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('MARKETING_QUALITY_GATE_FAILED')
    expect(mocks.socialPostFindMany).not.toHaveBeenCalled()
  })

  it('fails closed when an AUTO destination is no longer connected', async () => {
    mocks.socialPostFindMany.mockResolvedValue([{
      ...autoPost,
      integration: { status: 'EXPIRED' },
    }])

    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('AUTOPILOT_QUEUE_REVIEW_REQUIRED')
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('enables monitoring atomically with zero AI calls and zero credits', async () => {
    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      autopilotEnabled: true,
      monitoredPosts: 1,
      creditsUsed: 0,
      providerCalls: 0,
    })
    expect(mocks.tx.campaign.updateMany).toHaveBeenCalledWith({
      where: { id: 'c1', workspaceId: 'w1', status: 'ACTIVE' },
      data: { autopilotEnabled: true, autopilotActivatedAt: expect.any(Date) },
    })
    expect(mocks.tx.campaignActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        campaignId: 'c1',
        type: 'autopilot_enabled',
        metadata: expect.objectContaining({ contentGenerated: false, creditsUsed: 0 }),
      }),
    })
  })
})
