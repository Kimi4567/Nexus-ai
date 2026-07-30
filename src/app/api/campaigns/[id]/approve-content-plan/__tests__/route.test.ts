import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getUserId: vi.fn(),
  campaignFindFirst: vi.fn(),
  snapshotFindFirst: vi.fn(),
  integrationFindMany: vi.fn(),
  postFindMany: vi.fn(),
  postUpdateMany: vi.fn(),
  campaignUpdate: vi.fn(),
  snapshotCreate: vi.fn(),
  historyCreateMany: vi.fn(),
  automationJobUpdateMany: vi.fn(),
  learningCreateMany: vi.fn(),
  refreshApprovalPreferences: vi.fn(),
  reviewBrandTruth: vi.fn(),
  reviewStrategy: vi.fn(),
  reviewContent: vi.fn(),
  buildStrategyPayload: vi.fn(),
  buildContentPayload: vi.fn(),
  hashPayload: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.getUserId }))
vi.mock('@/lib/ai/marketingQualityGate', () => ({
  reviewBrandTruthConsistency: mocks.reviewBrandTruth,
  reviewStrategyGrounding: mocks.reviewStrategy,
}))
vi.mock('@/lib/contentPlanApprovalGuard', () => ({
  buildContentPlanTruthContext: vi.fn(() => ({})),
  reviewContentPlanForApproval: mocks.reviewContent,
}))
vi.mock('@/lib/approvalPreferenceLearning', () => ({
  refreshApprovalPreferenceProposals: mocks.refreshApprovalPreferences,
}))
vi.mock('@/lib/campaignSnapshots', () => ({
  CAMPAIGN_SNAPSHOT_SCOPE: {
    STRATEGY_APPROVAL: 'STRATEGY_APPROVAL',
    CONTENT_APPROVAL: 'CONTENT_APPROVAL',
  },
  buildStrategyApprovalSnapshotPayload: mocks.buildStrategyPayload,
  buildContentApprovalSnapshotPayload: mocks.buildContentPayload,
  hashCampaignSnapshotPayload: mocks.hashPayload,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    campaign: { findFirst: mocks.campaignFindFirst },
    campaignSnapshot: { findFirst: mocks.snapshotFindFirst },
    integration: { findMany: mocks.integrationFindMany },
    socialPost: { findMany: mocks.postFindMany },
    postStatusHistory: { createMany: mocks.historyCreateMany },
    marketingLearningEvent: { createMany: mocks.learningCreateMany },
    $transaction: (callback: (tx: any) => unknown) => callback({
      socialPost: { updateMany: mocks.postUpdateMany },
      campaign: { update: mocks.campaignUpdate },
      campaignSnapshot: { create: mocks.snapshotCreate },
      postStatusHistory: { createMany: mocks.historyCreateMany },
      automationJob: { updateMany: mocks.automationJobUpdateMany },
    }),
  },
}))

import { DELETE, POST } from '@/app/api/campaigns/[id]/approve-content-plan/route'

const reviewedAt = new Date('2026-07-20T10:00:00.000Z')

function request() {
  return new NextRequest('http://localhost/api/campaigns/campaign-1/approve-content-plan', {
    method: 'POST',
    headers: { Authorization: 'Bearer session', 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'approve' }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUserId.mockResolvedValue('user-1')
  mocks.campaignFindFirst.mockResolvedValue({
    id: 'campaign-1',
    workspaceId: 'workspace-1',
    name: 'Reviewed campaign',
    description: null,
    status: 'ACTIVE',
    goal: 'LEADS',
    audience: 'Founders',
    tone: 'PROFESSIONAL',
    platforms: ['LINKEDIN'],
    aiOutput: {
      strategy: { positioning: 'Reviewed positioning' },
      qualityGate: { schemaVersion: 1, status: 'passed', blockers: [] },
      sentinelReview: { status: 'passed' },
    },
    snapshotVersion: 1,
    workspace: {
      brandProfile: { brandName: 'Reviewed Brand', industry: 'Software' },
    },
  })
  mocks.snapshotFindFirst.mockResolvedValue({
    id: 'strategy-snapshot-1',
    version: 1,
    scope: 'STRATEGY_APPROVAL',
    payloadHash: 'strategy-hash',
  })
  mocks.integrationFindMany.mockResolvedValue([])
  mocks.postFindMany.mockResolvedValue([{
    id: 'post-1',
    platform: 'LINKEDIN',
    publishTarget: 'LINKEDIN',
    caption: 'Reviewed campaign copy tied to the approved positioning.',
    imagePrompt: 'Reviewed product visual',
    videoPrompt: null,
    imageUrl: null,
    link: null,
    uploadedMediaId: null,
    sourceMediaId: null,
    mediaSource: 'GENERATE',
    generationStatus: 'PENDING',
    isVideoPost: false,
    contentPlanIndex: 1,
    variantGroup: null,
    variantLabel: 'A',
    scheduledAt: new Date('2026-07-22T10:00:00.000Z'),
    updatedAt: reviewedAt,
  }])
  mocks.reviewStrategy.mockReturnValue({ status: 'passed', blockers: [], warnings: [] })
  mocks.reviewBrandTruth.mockReturnValue({ status: 'passed', blockers: [], warnings: [] })
  mocks.reviewContent.mockReturnValue({ ok: true, issues: [] })
  mocks.buildStrategyPayload.mockReturnValue({ scope: 'STRATEGY_APPROVAL' })
  mocks.buildContentPayload.mockReturnValue({ scope: 'CONTENT_APPROVAL' })
  mocks.hashPayload.mockImplementation((payload: any) => (
    payload?.scope === 'STRATEGY_APPROVAL' ? 'strategy-hash' : 'content-hash'
  ))
  mocks.postUpdateMany.mockResolvedValue({ count: 1 })
  mocks.campaignUpdate.mockResolvedValue({ snapshotVersion: 2 })
  mocks.snapshotCreate.mockResolvedValue({ id: 'content-snapshot-2', version: 2, payloadHash: 'content-hash' })
  mocks.historyCreateMany.mockResolvedValue({ count: 1 })
  mocks.automationJobUpdateMany.mockResolvedValue({ count: 1 })
  mocks.learningCreateMany.mockResolvedValue({ count: 1 })
  mocks.refreshApprovalPreferences.mockResolvedValue({ created: 1 })
})

describe('POST approve-content-plan', () => {
  it('pins approval to the exact reviewed draft revision', async () => {
    const response = await POST(request(), { params: Promise.resolve({ id: 'campaign-1' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ success: true, approved: 1, learningProposalQueued: true })
    expect(mocks.postUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'post-1', status: 'DRAFT', updatedAt: reviewedAt }),
    }))
    expect(mocks.refreshApprovalPreferences).toHaveBeenCalledWith('workspace-1')
    expect(mocks.automationJobUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        campaignId: 'campaign-1',
        kind: 'CAMPAIGN_APPROVAL_PACKAGE',
        status: 'WAITING_FOR_APPROVAL',
      }),
      data: expect.objectContaining({ status: 'COMPLETED', currentStep: 'approved' }),
    }))
  })

  it('rolls back the batch when any reviewed draft changes concurrently', async () => {
    mocks.postUpdateMany.mockResolvedValueOnce({ count: 0 })

    const response = await POST(request(), { params: Promise.resolve({ id: 'campaign-1' }) })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('CONTENT_APPROVAL_CONCURRENT_CHANGE')
    expect(mocks.campaignUpdate).not.toHaveBeenCalled()
    expect(mocks.snapshotCreate).not.toHaveBeenCalled()
  })
})

describe('DELETE approve-content-plan', () => {
  it('revokes approval only from the exact unpublished revision', async () => {
    mocks.postFindMany.mockResolvedValue([{
      id: 'post-1',
      status: 'APPROVED',
      updatedAt: reviewedAt,
    }])

    const response = await DELETE(request(), { params: Promise.resolve({ id: 'campaign-1' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ success: true, reverted: 1 })
    expect(mocks.postUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'post-1',
        status: 'APPROVED',
        publishedAt: null,
        updatedAt: reviewedAt,
      }),
    }))
  })

  it('does not revoke a post that changed or started publishing concurrently', async () => {
    mocks.postFindMany.mockResolvedValue([{
      id: 'post-1',
      status: 'SCHEDULED',
      updatedAt: reviewedAt,
    }])
    mocks.postUpdateMany.mockResolvedValueOnce({ count: 0 })

    const response = await DELETE(request(), { params: Promise.resolve({ id: 'campaign-1' }) })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('CONTENT_REVERT_CONCURRENT_CHANGE')
  })
})
