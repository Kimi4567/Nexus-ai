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
  reviewQuality: vi.fn(),
  videoProviderReady: vi.fn(),
  storageReady: vi.fn(),
  prisma: {
    campaign: { findFirst: vi.fn() },
    socialPost: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    generation: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    media: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
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
  buildCreditChargeReceipt: (_action: string, deduction: any) => ({ action: 'VIDEO_GENERATION', cost: 18, ...deduction }),
}))
vi.mock('@/lib/ai/provider', () => ({
  isVideoProviderConfigured: mocks.videoProviderReady,
  isMediaStorageConfigured: mocks.storageReady,
  getVideoProviderUnavailablePayload: () => ({ code: 'VIDEO_PROVIDER_UNAVAILABLE', creditsCharged: false }),
  getMediaStorageUnavailablePayload: () => ({ code: 'MEDIA_STORAGE_UNAVAILABLE', creditsCharged: false }),
}))
vi.mock('@/lib/ai/runway', () => ({
  createRunwayProductAdTask: mocks.createTask,
  retrieveRunwayTask: mocks.retrieveTask,
  uploadRunwayVideoToCloudinary: mocks.uploadVideo,
  cancelRunwayTask: vi.fn(),
}))
vi.mock('@/lib/ai/generatedMediaQuality', () => ({
  cloudinaryVideoReviewFrames: (url: string, duration = 5) => [`${url}#frame-0`, `${url}#frame-${Math.floor(duration / 2)}`, `${url}#frame-${duration - 1}`],
  reviewGeneratedMediaQuality: mocks.reviewQuality,
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
  acknowledgedCreditCost: 18,
  acknowledgedDurationSeconds: 8,
  acknowledgedNoPublishOrSchedule: true,
  acknowledgedReviewRequired: true,
  acknowledgedAssetRights: true,
  referenceMediaIds: ['product-front', 'product-side'],
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

const productReference = (id: string) => ({
  id,
  url: `https://res.cloudinary.com/demo/image/upload/${id}.png`,
  fileName: `${id}.png`,
  type: 'IMAGE',
  width: 1600,
  height: 1200,
  intelligenceStatus: 'READY',
  intelligence: {
    version: 1,
    visibleSummary: 'Isolated NEXUS product on a neutral background',
    assetKind: 'PRODUCT',
    language: 'NONE',
    products: ['NEXUS Bottle'],
    visibleObjects: ['bottle'],
    visibleActions: [],
    visibleText: [],
    safeThemes: ['product'],
    possibleUseCases: ['product ad'],
    recommendedPlatforms: ['INSTAGRAM'],
    funnelStages: ['AWARENESS'],
    evidenceLimits: ['No performance claim is verified.'],
    qualityScore: 92,
    qualityIssues: [],
    rightsStatus: 'UNCONFIRMED',
    audioStatus: 'NOT_ANALYZED',
    sourceFrames: [],
  },
})

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
    params: { postId: 'post-1', postUpdatedAt: post.updatedAt.toISOString(), durationSeconds: 8 },
  })
  mocks.prisma.generation.update.mockResolvedValue({ id: 'generation-1' })
  mocks.prisma.generation.updateMany.mockResolvedValue({ count: 1 })
  mocks.prisma.socialPost.update.mockResolvedValue({ updatedAt: new Date('2026-07-17T08:01:00.000Z') })
  mocks.prisma.$transaction.mockImplementation(async (callback: (tx: any) => unknown) => callback({
    socialPost: mocks.prisma.socialPost,
    postStatusHistory: mocks.prisma.postStatusHistory,
  }))
  mocks.deduct.mockResolvedValue({
    ok: true,
    creditsUsed: 18,
    creditsRemaining: 42,
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
    duration: 8,
    format: 'mp4',
  })
  mocks.reviewQuality.mockResolvedValue({
    version: 1,
    passed: true,
    mediaType: 'VIDEO',
    referenceRequired: false,
    referencePreservationScore: null,
    semanticAlignmentScore: 94,
    professionalQualityScore: 92,
    technicalIntegrity: true,
    noNewRasterText: true,
    noInventedClaims: true,
    issues: [],
    summary: 'Passed',
    reviewedAt: '2026-07-17T00:00:00.000Z',
    providerUsage: {},
  })
  mocks.prisma.media.findFirst.mockResolvedValue(null)
  mocks.prisma.media.findMany.mockResolvedValue([
    productReference('product-front'),
    productReference('product-side'),
  ])
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

  it('starts one multi-reference product-ad task, settles eighteen credits, and only marks media as generating', async () => {
    const response = await POST(request(confirmedBody), {
      params: Promise.resolve({ id: 'campaign-1', postId: 'post-1' }),
    })
    const payload = await response.json()

    expect(response.status).toBe(202)
    expect(mocks.createTask).toHaveBeenCalledWith(expect.objectContaining({
      duration: 8,
      ratio: '720:1280',
      productImages: [
        'https://res.cloudinary.com/demo/image/upload/product-front.png',
        'https://res.cloudinary.com/demo/image/upload/product-side.png',
      ],
    }))
    expect(mocks.createTask).toHaveBeenCalledTimes(1)
    expect(mocks.prisma.generation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        params: expect.objectContaining({
          durationSeconds: 8,
          referenceMediaIds: ['product-front', 'product-side'],
          pricingVersion: '2026-07-18-v1',
          providerCostEstimate: { currency: 'USD', amount: 3.44, providerCredits: 344 },
          automaticProviderRetries: 0,
        }),
      }),
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
    expect(payload).toMatchObject({ creditsUsed: 18, durationSeconds: 8, productionRoute: 'CINEMATIC_PRODUCT_AD', reviewRequired: true, published: false, scheduled: false })
  })

  it('blocks screens and UI captures before any provider spend or debit', async () => {
    const screen = productReference('product-front')
    screen.intelligence.assetKind = 'SCREEN'
    screen.intelligence.products = ['NEXUS Dashboard']
    const second = productReference('product-side')
    second.intelligence.products = ['NEXUS Dashboard']
    mocks.prisma.media.findMany.mockResolvedValue([screen, second])

    const response = await POST(request(confirmedBody), {
      params: Promise.resolve({ id: 'campaign-1', postId: 'post-1' }),
    })

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ code: 'MOTION_DESIGN_REQUIRED', creditsCharged: false })
    expect(mocks.deduct).not.toHaveBeenCalled()
    expect(mocks.createTask).not.toHaveBeenCalled()
  })

  it('blocks visible creator references before debit or provider execution', async () => {
    const creator = productReference('creator-front')
    creator.intelligence.visibleSummary = 'A woman wearing the product in a studio portrait.'
    creator.intelligence.visibleObjects = ['woman', 'abaya']
    const second = productReference('creator-side')
    second.intelligence.visibleSummary = 'A side portrait of the same woman wearing the product.'
    second.intelligence.visibleObjects = ['woman', 'abaya']
    mocks.prisma.media.findMany.mockResolvedValue([creator, second])

    const response = await POST(request({
      ...confirmedBody,
      referenceMediaIds: ['creator-front', 'creator-side'],
    }), {
      params: Promise.resolve({ id: 'campaign-1', postId: 'post-1' }),
    })

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({
      code: 'VIDEO_ASSET_PREFLIGHT_FAILED',
      creditsCharged: false,
      preflight: {
        eligible: false,
        issues: expect.arrayContaining([
          expect.objectContaining({ code: 'CREATOR_REFERENCE_UNSUPPORTED' }),
        ]),
      },
    })
    expect(mocks.deduct).not.toHaveBeenCalled()
    expect(mocks.createTask).not.toHaveBeenCalled()
  })

  it('pauses before debit when recent workspace failures exceed the provider loss limit', async () => {
    mocks.prisma.generation.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { status: 'COMPLETED', externalId: 't1', params: { productionRoute: 'CINEMATIC_PRODUCT_AD' }, metadata: { qualityStatus: 'PASSED' } },
        { status: 'FAILED', externalId: 't2', params: { productionRoute: 'CINEMATIC_PRODUCT_AD' }, metadata: { qualityStatus: 'REJECTED' } },
        { status: 'COMPLETED', externalId: 't3', params: { productionRoute: 'CINEMATIC_PRODUCT_AD' }, metadata: { qualityStatus: 'PASSED' } },
        { status: 'FAILED', externalId: 't4', params: { productionRoute: 'CINEMATIC_PRODUCT_AD' }, metadata: { qualityStatus: 'REJECTED' } },
        { status: 'COMPLETED', externalId: 't5', params: { productionRoute: 'CINEMATIC_PRODUCT_AD' }, metadata: { qualityStatus: 'PASSED' } },
      ])

    const response = await POST(request(confirmedBody), {
      params: Promise.resolve({ id: 'campaign-1', postId: 'post-1' }),
    })

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ code: 'VIDEO_ECONOMICS_PAUSED', creditsCharged: false })
    expect(mocks.deduct).not.toHaveBeenCalled()
    expect(mocks.createTask).not.toHaveBeenCalled()
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
      reason: 'NEXUS Video Studio could not start production. Reserved credits will be restored.',
    }))
    expect(await response.json()).toMatchObject({ refunded: true, refundPending: false })
  })
})

describe('GET professional video generation status', () => {
  it('returns a truthful safety category and stores safe provider diagnostics', async () => {
    mocks.prisma.generation.findMany.mockResolvedValue([{
      id: 'generation-1',
      campaignId: 'campaign-1',
      type: 'VIDEO',
      provider: 'runway',
      status: 'PROCESSING',
      progress: 37,
      externalId: 'runway-task-1',
      params: {
        postId: 'post-1',
        credit: { ok: true, creditsUsed: 18, creditsRemaining: 42, transactionId: 'credit-1' },
      },
      metadata: null,
    }])
    mocks.retrieveTask.mockResolvedValue({
      id: 'runway-task-1',
      status: 'FAILED',
      failureCode: 'INPUT_PREPROCESSING.SAFETY.THIRD_PARTY',
      failure: "The request was blocked by this model provider's content moderation system.",
    })

    const response = await GET(request({}), {
      params: Promise.resolve({ id: 'campaign-1', postId: 'post-1' }),
    })
    const payload = await response.json()

    expect(payload).toMatchObject({
      status: 'FAILED',
      failureCategory: 'INPUT_SAFETY_REJECTED',
      refunded: true,
      refundPending: false,
    })
    expect(payload.error).toContain('isolated product-only references')
    expect(mocks.prisma.generation.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          providerFailureCategory: 'INPUT_SAFETY_REJECTED',
          providerFailureCode: 'INPUT_PREPROCESSING.SAFETY.THIRD_PARTY',
          providerOutputCreated: false,
        }),
      }),
    }))
  })

  it('lets only one poller persist and review a completed provider result', async () => {
    mocks.prisma.generation.findMany.mockResolvedValue([{
      id: 'generation-1',
      campaignId: 'campaign-1',
      type: 'VIDEO',
      provider: 'runway',
      status: 'PROCESSING',
      progress: 99,
      externalId: 'runway-task-1',
      params: { postId: 'post-1', durationSeconds: 8, credit: { transactionId: 'credit-1' } },
      metadata: null,
    }])
    mocks.prisma.generation.updateMany.mockResolvedValue({ count: 0 })

    const response = await GET(request({}), {
      params: Promise.resolve({ id: 'campaign-1', postId: 'post-1' }),
    })

    expect(response.status).toBe(202)
    expect(await response.json()).toMatchObject({ status: 'PROCESSING', progress: 99 })
    expect(mocks.uploadVideo).not.toHaveBeenCalled()
    expect(mocks.reviewQuality).not.toHaveBeenCalled()
  })

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
        durationSeconds: 8,
        credit: { ok: true, creditsUsed: 18, creditsRemaining: 42, transactionId: 'credit-1' },
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
    expect(mocks.reviewQuality).toHaveBeenCalledWith(expect.objectContaining({
      mediaType: 'VIDEO',
      targetFormat: expect.objectContaining({
        platform: 'INSTAGRAM',
        aspectRatio: '9:16',
        width: 720,
        height: 1280,
      }),
      formatValidation: expect.objectContaining({
        passed: true,
        width: 720,
        height: 1280,
        durationPassed: true,
      }),
      outputFrames: [
        'https://res.cloudinary.com/demo/video/upload/final.mp4#frame-0',
        'https://res.cloudinary.com/demo/video/upload/final.mp4#frame-4',
        'https://res.cloudinary.com/demo/video/upload/final.mp4#frame-7',
      ],
      requireProductAdStructure: true,
    }))
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

  it('rejects a failed video quality review, restores credits, and does not attach it', async () => {
    const renderUpdatedAt = new Date('2026-07-17T08:01:00.000Z')
    mocks.prisma.generation.findMany.mockResolvedValue([{
      id: 'generation-1',
      campaignId: 'campaign-1',
      type: 'VIDEO',
      provider: 'runway',
      status: 'PROCESSING',
      progress: 90,
      externalId: 'runway-task-1',
      params: {
        postId: 'post-1',
        postUpdatedAt: renderUpdatedAt.toISOString(),
        durationSeconds: 8,
        credit: { ok: true, creditsUsed: 18, creditsRemaining: 42, transactionId: 'credit-1' },
      },
      metadata: null,
    }])
    mocks.reviewQuality.mockResolvedValue({
      version: 1,
      passed: false,
      mediaType: 'VIDEO',
      referenceRequired: false,
      referencePreservationScore: null,
      semanticAlignmentScore: 50,
      professionalQualityScore: 60,
      technicalIntegrity: false,
      noNewRasterText: true,
      noInventedClaims: true,
      issues: ['Unstable geometry between frames.'],
      summary: 'Rejected',
      reviewedAt: '2026-07-17T00:00:00.000Z',
      providerUsage: {},
    })

    const response = await GET(request({}), {
      params: Promise.resolve({ id: 'campaign-1', postId: 'post-1' }),
    })
    const payload = await response.json()

    expect(payload).toMatchObject({ status: 'FAILED', refunded: true, refundPending: false })
    expect(mocks.prisma.media.create).not.toHaveBeenCalled()
    expect(mocks.prisma.socialPost.update).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      data: expect.objectContaining({ generationStatus: 'FAILED' }),
    })
    expect(mocks.refund).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      action: 'VIDEO_GENERATION',
    }))
  })
})
