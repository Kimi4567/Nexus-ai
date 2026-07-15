import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import {
  CAMPAIGN_SNAPSHOT_SCOPE,
  buildContentApprovalSnapshotPayload,
  buildStrategyApprovalSnapshotPayload,
  hashCampaignSnapshotPayload,
} from '@/lib/campaignSnapshots'

const mocks = vi.hoisted(() => ({
  getUserId: vi.fn(),
  campaignFindFirst: vi.fn(),
  campaignSnapshotFindFirst: vi.fn(),
  socialPostFindMany: vi.fn(),
  campaignUpdate: vi.fn(),
  campaignSnapshotCreate: vi.fn(),
  socialPostUpdateMany: vi.fn(),
  postStatusHistoryCreateMany: vi.fn(),
  campaignActivityCreate: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.getUserId }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    campaign: { findFirst: mocks.campaignFindFirst },
    campaignSnapshot: { findFirst: mocks.campaignSnapshotFindFirst },
    socialPost: { findMany: mocks.socialPostFindMany },
    $transaction: (callback: (tx: any) => unknown) => callback({
      campaign: { update: mocks.campaignUpdate },
      campaignSnapshot: { create: mocks.campaignSnapshotCreate },
      socialPost: { updateMany: mocks.socialPostUpdateMany },
      postStatusHistory: { createMany: mocks.postStatusHistoryCreateMany },
      campaignActivity: { create: mocks.campaignActivityCreate },
    }),
  },
}))

import { POST } from '@/app/api/campaigns/[id]/approve-media-plan/route'

const campaign = {
  id: 'campaign-1',
  workspaceId: 'workspace-1',
  name: 'Reviewed launch',
  description: null,
  status: 'ACTIVE',
  goal: 'LEADS',
  audience: 'Business buyers',
  tone: 'PROFESSIONAL',
  platforms: ['INSTAGRAM'],
  aiOutput: { strategy: { positioning: 'Reviewed offer for operators' } },
  workspace: { brandProfile: { brandName: 'Reviewed Brand', primaryOffer: 'Reviewed offer' } },
}

const strategyPayload = buildStrategyApprovalSnapshotPayload({
  campaign,
  brandProfile: campaign.workspace.brandProfile,
})
const strategySnapshot = {
  id: 'strategy-snapshot-1',
  version: 1,
  scope: CAMPAIGN_SNAPSHOT_SCOPE.STRATEGY_APPROVAL,
  payloadHash: hashCampaignSnapshotPayload(strategyPayload),
}

function reviewedPost() {
  const post = {
    id: 'post-1',
    platform: 'META',
    publishTarget: 'INSTAGRAM',
    caption: 'A reviewed launch message for operators.',
    imagePrompt: 'Product workflow on a clean desk',
    videoPrompt: null,
    imageUrl: 'https://cdn.example.com/final.png',
    link: 'https://example.com/offer',
    uploadedMediaId: 'media-1',
    sourceMediaId: null,
    mediaSource: 'UPLOAD',
    generationStatus: 'DONE',
    isVideoPost: false,
    contentPlanIndex: 0,
    variantGroup: null,
    variantLabel: null,
    scheduledAt: new Date('2026-07-20T10:00:00.000Z'),
    approvedSnapshotId: 'copy-snapshot-2',
    mediaApprovalSnapshot: null,
    updatedAt: new Date('2026-07-15T08:00:00.000Z'),
  }
  return {
    ...post,
    approvedSnapshot: {
      scope: CAMPAIGN_SNAPSHOT_SCOPE.CONTENT_APPROVAL,
      payload: buildContentApprovalSnapshotPayload({
        campaignId: campaign.id,
        strategySnapshot,
        posts: [post],
      }),
    },
  }
}

function request() {
  return new NextRequest('http://localhost/api/campaigns/campaign-1/approve-media-plan', {
    method: 'POST',
    headers: { Authorization: 'Bearer session' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUserId.mockResolvedValue('user-1')
  mocks.campaignFindFirst.mockResolvedValue(campaign)
  mocks.campaignSnapshotFindFirst.mockResolvedValue(strategySnapshot)
  mocks.socialPostFindMany.mockResolvedValue([reviewedPost()])
  mocks.campaignUpdate.mockResolvedValue({ snapshotVersion: 3 })
  mocks.campaignSnapshotCreate.mockResolvedValue({
    id: 'media-snapshot-3', version: 3, scope: CAMPAIGN_SNAPSHOT_SCOPE.CONTENT_MEDIA_APPROVAL, payloadHash: 'media-hash',
  })
  mocks.socialPostUpdateMany.mockResolvedValue({ count: 1 })
  mocks.postStatusHistoryCreateMany.mockResolvedValue({ count: 1 })
  mocks.campaignActivityCreate.mockResolvedValue({ id: 'activity-1' })
})

describe('POST approve-media-plan', () => {
  it('records final media separately without scheduling or spending credits', async () => {
    const response = await POST(request(), { params: Promise.resolve({ id: campaign.id }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ success: true, approved: 1, unchanged: false })
    expect(mocks.campaignSnapshotCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ scope: CAMPAIGN_SNAPSHOT_SCOPE.CONTENT_MEDIA_APPROVAL }),
      select: expect.any(Object),
    })
    expect(mocks.socialPostUpdateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'post-1', status: 'APPROVED', approvedSnapshotId: 'copy-snapshot-2',
      }),
      data: { mediaApprovalSnapshotId: 'media-snapshot-3', scheduledSnapshotId: null },
    })
    expect(mocks.postStatusHistoryCreateMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        socialPostId: 'post-1', fromStatus: 'APPROVED', toStatus: 'APPROVED', actor: 'USER',
      })],
    })
  })

  it('fails closed when copy changed after its approval', async () => {
    const post = reviewedPost()
    mocks.socialPostFindMany.mockResolvedValue([{ ...post, caption: 'Changed after copy approval' }])

    const response = await POST(request(), { params: Promise.resolve({ id: campaign.id }) })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('COPY_APPROVAL_REVIEW_REQUIRED')
    expect(mocks.campaignSnapshotCreate).not.toHaveBeenCalled()
  })

  it('fails closed until every approved post has final media', async () => {
    mocks.socialPostFindMany.mockResolvedValue([{ ...reviewedPost(), imageUrl: null, uploadedMediaId: null, generationStatus: 'PENDING' }])

    const response = await POST(request(), { params: Promise.resolve({ id: campaign.id }) })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('MEDIA_REVIEW_REQUIRED')
    expect(mocks.campaignSnapshotCreate).not.toHaveBeenCalled()
  })
})
