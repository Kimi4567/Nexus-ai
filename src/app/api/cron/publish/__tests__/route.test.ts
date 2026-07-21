import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  historyCreate: vi.fn(),
  learningCreate: vi.fn(),
  publish: vi.fn(),
  retryable: vi.fn(),
  decrypt: vi.fn(),
  campaignFindMany: vi.fn(),
  brandFindMany: vi.fn(),
  snapshotFindMany: vi.fn(),
  reviewStrategyGrounding: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    socialPost: {
      findMany: mocks.findMany,
      count: mocks.count,
      update: mocks.update,
      updateMany: mocks.updateMany,
    },
    postStatusHistory: { create: mocks.historyCreate },
    marketingLearningEvent: { create: mocks.learningCreate },
    campaign: { findMany: mocks.campaignFindMany },
    brandProfile: { findMany: mocks.brandFindMany },
    campaignSnapshot: { findMany: mocks.snapshotFindMany },
  },
}))
vi.mock('@/lib/socialPublishers', () => ({
  publishSocialPost: mocks.publish,
  isRetryableSocialPublishError: mocks.retryable,
}))
vi.mock('@/lib/tokenCrypto', () => ({ decryptToken: mocks.decrypt }))
vi.mock('@/lib/ai/marketingQualityGate', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/ai/marketingQualityGate')>(),
  reviewStrategyGrounding: mocks.reviewStrategyGrounding,
}))

import { GET } from '@/app/api/cron/publish/route'
import {
  CAMPAIGN_SNAPSHOT_SCOPE,
  buildContentApprovalSnapshotPayload,
  buildMediaApprovalSnapshotPayload,
  buildStrategyApprovalSnapshotPayload,
  hashCampaignSnapshotPayload,
} from '@/lib/campaignSnapshots'

const originalSecret = process.env.CRON_SECRET

function request(token = 'cron-secret') {
  return new NextRequest('http://localhost/api/cron/publish', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

const campaign = {
  id: 'campaign-1',
  workspaceId: 'workspace-1',
  name: 'Reviewed campaign',
  description: null,
  aiOutput: { strategy: { positioning: 'Reviewed offer' } },
  goal: 'LEADS',
  audience: null,
  tone: null,
  platforms: ['LINKEDIN', 'PINTEREST'],
}

const brand = {
  workspaceId: 'workspace-1', brandName: 'Reviewed Brand', industry: 'Services',
  primaryOffer: 'A reviewed service', targetAudience: 'Business buyers',
}

function withApprovalSnapshot<T extends { id: string }>(value: T): T & {
  approvedSnapshot: { scope: string; payload: unknown }
  mediaApprovalSnapshot: { scope: string; payload: unknown }
  mediaApprovalSnapshotId: string
} {
  const strategySnapshot = {
    id: 'strategy-snapshot-1',
    version: 1,
    scope: CAMPAIGN_SNAPSHOT_SCOPE.STRATEGY_APPROVAL,
    payloadHash: hashCampaignSnapshotPayload(buildStrategyApprovalSnapshotPayload({ campaign, brandProfile: brand })),
  }
  const approvedSnapshot = {
      scope: CAMPAIGN_SNAPSHOT_SCOPE.CONTENT_APPROVAL,
      payload: buildContentApprovalSnapshotPayload({ campaignId: campaign.id, strategySnapshot, posts: [value] }),
  }
  return {
    ...value,
    approvedSnapshot,
    mediaApprovalSnapshotId: 'media-snapshot-3',
    mediaApprovalSnapshot: {
      scope: CAMPAIGN_SNAPSHOT_SCOPE.CONTENT_MEDIA_APPROVAL,
      payload: buildMediaApprovalSnapshotPayload({
        campaignId: campaign.id,
        strategySnapshot,
        copyApprovalSnapshotIds: ['content-snapshot-2'],
        posts: [value],
      }),
    },
  }
}

function duePost() {
  const value = {
    id: 'post-1',
    workspaceId: 'workspace-1',
    campaignId: 'campaign-1',
    platform: 'LINKEDIN',
    caption: 'Approved copy',
    imageUrl: 'https://cdn.example.com/approved.jpg',
    generationStatus: 'DONE',
    mediaSource: 'GENERATE',
    pageId: null,
    status: 'SCHEDULED',
    publishMode: 'AUTO',
    autoPublishConsentAt: new Date(Date.now() - 60_000),
    approvedAt: new Date(Date.now() - 60_000),
    approvedSnapshotId: 'content-snapshot-2',
    scheduledSnapshotId: 'schedule-snapshot-3',
    scheduledAt: new Date(Date.now() - 1_000),
    integration: {
      accessToken: 'encrypted-token',
      accountId: 'person-1',
      config: { personId: 'person-1', scopeEvidence: 'provider_response', scopes: ['w_member_social'] },
    },
    statusHistory: [],
  }
  return withApprovalSnapshot(value)
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'cron-secret'
  mocks.findMany.mockResolvedValue([duePost()])
  mocks.count.mockResolvedValue(0)
  mocks.update.mockResolvedValue({})
  mocks.updateMany.mockResolvedValue({ count: 1 })
  mocks.historyCreate.mockResolvedValue({})
  mocks.learningCreate.mockResolvedValue({})
  mocks.decrypt.mockReturnValue('plain-token')
  mocks.publish.mockResolvedValue({ platformPostId: 'urn:li:share:1' })
  mocks.retryable.mockImplementation((error: Error) => /429|rate limit/i.test(error.message))
  mocks.campaignFindMany.mockResolvedValue([campaign])
  mocks.brandFindMany.mockResolvedValue([brand])
  mocks.snapshotFindMany.mockResolvedValue([{
    id: 'strategy-snapshot-1',
    campaignId: campaign.id,
    version: 1,
    scope: CAMPAIGN_SNAPSHOT_SCOPE.STRATEGY_APPROVAL,
    payloadHash: hashCampaignSnapshotPayload(buildStrategyApprovalSnapshotPayload({ campaign, brandProfile: brand })),
  }])
  mocks.reviewStrategyGrounding.mockReturnValue({
    schemaVersion: 1, status: 'passed', score: 100, blockers: [], warnings: [], checkedAt: '2026-07-14T00:00:00.000Z',
  })
})

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = originalSecret
})

describe('GET /api/cron/publish', () => {
  it('fails closed before querying posts', async () => {
    delete process.env.CRON_SECRET
    const response = await GET(request())
    expect(response.status).toBe(500)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it('persists PUBLISHED only after the platform adapter succeeds', async () => {
    const response = await GET(request())
    const body = await response.json()

    expect(body).toMatchObject({ ok: true, processed: 1, succeeded: 1, failed: 0 })
    expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'LINKEDIN',
      caption: 'Approved copy',
      accessToken: 'plain-token',
    }))
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      data: {
        status: 'PUBLISHED',
        publishedAt: expect.any(Date),
        publishAttemptedAt: expect.any(Date),
        platformPostId: 'urn:li:share:1',
        platformUrl: null,
        errorMessage: null,
        publishLeaseToken: null,
        publishLeaseUntil: null,
      },
    })
  })

  it('claims a due post atomically and skips a post already leased by another worker', async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 })

    const response = await GET(request())
    const body = await response.json()

    expect(body).toMatchObject({
      ok: true,
      processed: 0,
      succeeded: 0,
      failed: 0,
      skippedByLease: 1,
    })
    expect(mocks.publish).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'post-1',
        status: 'SCHEDULED',
        publishMode: 'AUTO',
        OR: expect.arrayContaining([
          { publishLeaseUntil: null },
          { publishLeaseUntil: expect.objectContaining({ lt: expect.any(Date) }) },
        ]),
      }),
      data: expect.objectContaining({
        publishLeaseToken: expect.any(String),
        publishLeaseUntil: expect.any(Date),
      }),
    }))
  })

  it('blocks automatic provider delivery when Brand Brain and strategy no longer agree', async () => {
    mocks.reviewStrategyGrounding.mockReturnValue({
      schemaVersion: 1,
      status: 'blocked',
      score: 70,
      blockers: [{ code: 'strategy_missing_brand_relevance', severity: 'blocker', path: 'strategy', message: 'Drifted.' }],
      warnings: [],
      checkedAt: '2026-07-14T00:00:00.000Z',
    })

    const response = await GET(request())
    const body = await response.json()

    expect(body).toMatchObject({ ok: true, processed: 1, succeeded: 0, failed: 1 })
    expect(mocks.publish).not.toHaveBeenCalled()
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        errorMessage: expect.stringContaining('MARKETING_QUALITY_GATE_FAILED'),
      }),
    })
  })

  it('does not call the platform adapter when media readiness is incomplete', async () => {
    mocks.findMany.mockResolvedValue([{ ...duePost(), generationStatus: 'PENDING' }])

    const response = await GET(request())
    const body = await response.json()

    expect(body).toMatchObject({ ok: true, processed: 0, succeeded: 0 })
    expect(mocks.publish).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('fails closed before provider delivery when scheduled legacy copy is generic', async () => {
    mocks.findMany.mockResolvedValue([withApprovalSnapshot({
      ...duePost(),
      caption: 'Did you know analytics can transform your business?',
    })])

    const response = await GET(request())
    const body = await response.json()

    expect(body).toMatchObject({ ok: true, processed: 1, succeeded: 0, failed: 1 })
    expect(mocks.publish).not.toHaveBeenCalled()
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        errorMessage: expect.stringContaining('CONTENT_REVIEW_REQUIRED'),
      }),
    })
  })

  it('records provider failure without claiming publication', async () => {
    mocks.publish.mockRejectedValue(new Error('LinkedIn publish failed: permission denied'))
    const response = await GET(request())
    const body = await response.json()

    expect(body).toMatchObject({ ok: true, processed: 1, succeeded: 0, failed: 1 })
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      data: {
        status: 'FAILED',
        errorMessage: 'LinkedIn publish failed: permission denied',
        publishLeaseToken: null,
        publishLeaseUntil: null,
      },
    })
  })

  it('keeps transient provider failures scheduled for a bounded retry', async () => {
    mocks.publish.mockRejectedValue(new Error('LinkedIn publish failed: HTTP 429 rate limit'))
    const response = await GET(request())
    const body = await response.json()

    expect(body).toMatchObject({
      ok: true,
      processed: 1,
      succeeded: 0,
      failed: 0,
      retriesScheduled: 1,
    })
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      data: {
        errorMessage: 'LinkedIn publish failed: HTTP 429 rate limit',
        publishLeaseToken: null,
        publishLeaseUntil: null,
      },
    })
    expect(mocks.historyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        socialPostId: 'post-1',
        fromStatus: 'SCHEDULED',
        toStatus: 'SCHEDULED',
        actor: 'CRON',
        note: expect.stringContaining('[PUBLISH_RETRY]'),
      }),
    })
  })

  it('publishes scheduled Pinterest posts only with Standard access and verified scopes', async () => {
    mocks.findMany.mockResolvedValue([withApprovalSnapshot({
      ...duePost(),
      id: 'pinterest-post',
      platform: 'PINTEREST',
      publishTarget: 'PINTEREST',
      pageId: '12345',
      caption: 'A reviewed Pinterest description tied to the approved campaign offer.',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/pin.jpg',
      isVideoPost: false,
      platformOptions: {
        boardId: '12345', title: 'Reviewed Pin', altText: 'Approved campaign product visual.',
        destinationLink: null, aiDisclosureReviewed: true, aiDisclosureValues: [], explicitConsent: true,
      },
      integration: {
        accessToken: 'encrypted-pinterest-token',
        accountId: 'p-user-1',
        config: {
          accessTier: 'STANDARD', boards: [{ id: '12345', name: 'Launches' }],
          scopeEvidence: 'provider_response', scopes: ['boards:read', 'boards:write', 'pins:read', 'pins:write'],
        },
      },
    })])
    mocks.publish.mockResolvedValue({ platformPostId: '998877', platformUrl: 'https://www.pinterest.com/pin/998877/' })

    const response = await GET(request())
    const body = await response.json()

    expect(body).toMatchObject({ ok: true, processed: 1, succeeded: 1, failed: 0 })
    expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'PINTEREST', pageId: '12345', accessToken: 'plain-token',
    }))
  })
})
