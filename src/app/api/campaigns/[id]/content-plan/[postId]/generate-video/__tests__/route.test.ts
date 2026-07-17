import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUserId: vi.fn(),
  deduct: vi.fn(),
  finalize: vi.fn(),
  refund: vi.fn(),
  rateLimit: vi.fn(),
  createTask: vi.fn(),
  retrieveTask: vi.fn(),
  uploadVideo: vi.fn(),
  videoProviderReady: vi.fn(),
  storageReady: vi.fn(),
  prisma: {
    campaign: { findFirst: vi.fn() },
    socialPost: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    generation: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    media: { findFirst: vi.fn(), create: vi.fn() },
    postStatusHistory: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.getUserId }))
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('@/lib/billableAiRateLimit', () => ({ enforceBillableAiRateLimit: mocks.rateLimit }))
vi.mock('@/lib/credits', () => ({
  checkAndDeductCredits: mocks.deduct,
  creditCheckHttpStatus: () => 402,
  finalizeCreditDeduction: mocks.finalize,
  refundCreditDeduction: mocks.refund,
  buildCreditChargeReceipt: (_action: string, deduction: any) => ({ action: 'VIDEO_GENERATION', cost: 6, ...deduction }),
}))
vi.mock('@/lib/ai/provider', () => ({
  isVideoProviderConfigured: mocks.videoProviderReady,
  isMediaStorageConfigured: mocks.storageReady,
  getVideoProviderUnavailablePayload: () => ({ code: 'VIDEO_PROVIDER_UNAVAILABLE', creditsCharged: false }),
  getMediaStorageUnavailablePayload: () => ({ code: 'MEDIA_STORAGE_UNAVAILABLE', creditsCharged: false }),
}))
vi.mock('@/lib/ai/runway', () => ({
  createRunwayVideoTask: mocks.createTask,
  retrieveRunwayTask: mocks.retrieveTask,
  uploadRunwayVideoToCloudinary: mocks.uploadVideo,
  cancelRunwayTask: vi.fn(),
}))
vi.mock('@/lib/strategyApproval', () => ({ canMutateCampaignExecution: () => true }))
vi.mock('@/lib/ai/marketingQualityGate', () => ({
  reviewBrandTruthConsistency: () => ({ status: 'ready', blockers: [] }),
}))
vi.mock('@/lib/contentPlanApprovalGuard', () => ({
  reviewContentPlanForApproval: () => ({ ok: true, issues: [] }),
}))

import { GET, POST } from '../route'

const confirmedBody = {
  explicitVideoGenerationConfirmed: true,
  acknowledgedCreditCost: 6,
  acknowledgedDurationSeconds: 5,
  acknowledgedNoPublishOrSchedule: true,
  acknowledgedReviewRequired: true,
}

function request(body: unknown) {
  return {
    json: async () => body,
    headers: { get: (name: string) => name.toLowerCase() === 'idempotency-key' ? 'video-operation-123' : null },
  } as any
}

const campaign = {
  id: 'campaign-1',
  name: 'NEXUS Launch',
  status: 'ACTIVE',
  aiOutput: { strategy: { keyMessage: 'Clear marketing execution' } },
  workspaceId: 'workspace-1',
  workspace: {
    brandProfile: {
      brandName: 'NEXUS',
      industry: 'SaaS',
      description: 'Marketing operating system',
      primaryOffer: 'Reviewed marketing execution',
      toneKeywords: ['premium', 'clear'],
      uniqueAdvantages: ['review controls'],
      verifiedProof: [],
      complianceNotes: null,
    },
  },
}

const post = {
  id: 'post-1',
  workspaceId: 'workspace-1',
  campaignId: 'campaign-1',
  caption: 'Build a clear campaign.',
  videoPrompt: 'A premium cinematic reveal.',
  imagePrompt: null,
  contentPlanIndex: 2,
  isVideoPost: true,
  generationStatus: 'PENDING',
  status: 'DRAFT',
  platform: 'INSTAGRAM',
  publishTarget: 'INSTAGRAM',
  updatedAt: new Date('2026-07-17T08:00:00.000Z'),
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUserId.mockResolvedValue('user-1')
  mocks.videoProviderReady.mockReturnValue(true)
  mocks.storageReady.mockReturnValue(true)
  mocks.rateLimit.mockResolvedValue(null)
  mocks.prisma.campaign.findFirst.mockResolvedValue(campaign)
  mocks.prisma.socialPost.findFirst.mockResolvedValue(post)
  mocks.prisma.generation.findMany.mockResolvedValue([])
  mocks.prisma.generation.create.mockResolvedValue({
    id: 'generation-1',
    params: { postId: 'post-1', postUpdatedAt: post.updatedAt.toISOString(), durationSeconds: 5 },
  })
  mocks.prisma.generation.update.mockResolvedValue({ id: 'generation-1' })
  mocks.prisma.socialPost.update.mockResolvedValue({ updatedAt: new Date('2026-07-17T08:01:00.000Z') })
  mocks.prisma.$transaction.mockImplementation(async (callback: (tx: any) => unknown) => callback({
    socialPost: mocks.prisma.socialPost,
    postStatusHistory: mocks.prisma.postStatusHistory,
  }))
  mocks.deduct.mockResolvedValue({
    ok: true,
    creditsUsed: 6,
    creditsRemaining: 54,
    isUnlimited: false,
    transactionId: 'credit-1',
  })
  mocks.createTask.mockResolvedValue({ id: 'runway-task-1', status: 'PENDING' })
  mocks.finalize.mockResolvedValue({ ok: true, status: 'settled' })
  mocks.refund.mockResolvedValue({ ok: true, status: 'refunded' })
  mocks.retrieveTask.mockResolvedValue({
    id: 'runway-task-1',
    status: 'SUCCEEDED',
    output: ['https://runway.example/video.mp4'],
  })
  mocks.uploadVideo.mockResolvedValue({
    url: 'https://res.cloudinary.com/demo/video/upload/final.mp4',
    publicId: 'nexus/videos/video_generation-1',
    bytes: 2048,
    width: 720,
    height: 1280,
    duration: 5,
    format: 'mp4',
  })
  mocks.prisma.media.findFirst.mockResolvedValue(null)
  mocks.prisma.media.create.mockResolvedValue({ id: 'media-1' })
})

describe('POST professional video generation', () => {
  it('requires the full review-only confirmation before any debit', async () => {
    const response = await POST(request({ ...confirmedBody, acknowledgedNoPublishOrSchedule: false }), {
      params: Promise.resolve({ id: 'campaign-1', postId: 'post-1' }),
    })

    expect(response.status).toBe(400)
    expect(mocks.deduct).not.toHaveBeenCalled()
    expect(mocks.createTask).not.toHaveBeenCalled()
  })

  it('checks provider readiness before any debit', async () => {
    mocks.videoProviderReady.mockReturnValue(false)
    const response = await POST(request(confirmedBody), {
      params: Promise.resolve({ id: 'campaign-1', postId: 'post-1' }),
    })

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ code: 'VIDEO_PROVIDER_UNAVAILABLE', creditsCharged: false })
    expect(mocks.deduct).not.toHaveBeenCalled()
  })

  it('starts one Gen-4.5 task, settles six credits, and only marks media as generating', async () => {
    const response = await POST(request(confirmedBody), {
      params: Promise.resolve({ id: 'campaign-1', postId: 'post-1' }),
    })
    const payload = await response.json()

    expect(response.status).toBe(202)
    expect(mocks.createTask).toHaveBeenCalledWith(expect.objectContaining({
      duration: 5,
      ratio: '720:1280',
      promptImage: undefined,
    }))
    expect(mocks.deduct).toHaveBeenCalledWith('user-1', 'VIDEO_GENERATION', undefined, expect.objectContaining({
      entityId: 'post-1',
      entityType: 'social_post_video',
    }))
    expect(mocks.finalize).toHaveBeenCalledWith(expect.objectContaining({ action: 'VIDEO_GENERATION' }))
    expect(mocks.prisma.socialPost.update).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      data: { generationStatus: 'GENERATING', errorMessage: null },
      select: { updatedAt: true },
    })
    expect(payload).toMatchObject({ creditsUsed: 6, reviewRequired: true, published: false, scheduled: false })
  })

  it('restores the exact debit when Runway rejects task creation', async () => {
    mocks.createTask.mockRejectedValue(new Error('provider unavailable'))
    const response = await POST(request(confirmedBody), {
      params: Promise.resolve({ id: 'campaign-1', postId: 'post-1' }),
    })

    expect(response.status).toBe(502)
    expect(mocks.refund).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      action: 'VIDEO_GENERATION',
      reason: 'provider unavailable',
    }))
    expect(await response.json()).toMatchObject({ refunded: true, refundPending: false })
  })
})

describe('GET professional video generation status', () => {
  it('persists a successful provider output and attaches it only as review media', async () => {
    const renderUpdatedAt = new Date('2026-07-17T08:01:00.000Z')
    mocks.prisma.generation.findMany.mockResolvedValue([{
      id: 'generation-1',
      campaignId: 'campaign-1',
      type: 'VIDEO',
      provider: 'runway',
      status: 'PROCESSING',
      progress: 40,
      externalId: 'runway-task-1',
      params: {
        postId: 'post-1',
        postUpdatedAt: renderUpdatedAt.toISOString(),
        durationSeconds: 5,
        credit: { ok: true, creditsUsed: 6, creditsRemaining: 54, transactionId: 'credit-1' },
      },
      metadata: null,
    }])
    mocks.prisma.socialPost.findUnique.mockResolvedValue({ ...post, updatedAt: renderUpdatedAt })

    const response = await GET(request({}), {
      params: Promise.resolve({ id: 'campaign-1', postId: 'post-1' }),
    })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.uploadVideo).toHaveBeenCalledWith('https://runway.example/video.mp4', 'generation-1')
    expect(mocks.prisma.socialPost.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'post-1' },
      data: expect.objectContaining({
        imageUrl: 'https://res.cloudinary.com/demo/video/upload/final.mp4',
        sourceMediaId: 'media-1',
        sourceType: 'AI_GENERATED',
        generationStatus: 'DONE',
      }),
    }))
    expect(payload).toMatchObject({
      status: 'SUCCEEDED',
      attached: true,
      reviewRequired: true,
      published: false,
      scheduled: false,
    })
    expect(mocks.deduct).not.toHaveBeenCalled()
  })
})
