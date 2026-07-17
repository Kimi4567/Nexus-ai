/**
 * RF-5 — visuals/generate refund-safety contract.
 *
 * Guarantees:
 *   - auth, workspace, daily cap, prompt/context loading happen before deduction
 *   - single image generation preserves IMAGE_GENERATION cost and response shape
 *   - provider/DB failures after deduction refund the user
 *   - successful generation deducts once and does not refund
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetServerUserId,
  mockCheckAndDeduct,
  mockFinalizeDeduction,
  mockCheckDailyImageCap,
  mockRefund,
  mockRefundForTxn,
  mockBuildImagePrompt,
  mockBuildReferencePrompt,
  mockGenerateWithDallE,
  mockGenerateWithOpenAIImageEdit,
  mockUploadToCloudinary,
  mockReviewGeneratedMediaQuality,
  mockResolvePlatformImageFormat,
  mockBuildPlatformReadyImageUrl,
  mockVerifyPlatformReadyImage,
  mockComposeBrandedPost,
  mockBufferToDataUri,
  mockScheduleAfterResponse,
  pendingAfterTasks,
  mockPrisma,
} = vi.hoisted(() => ({
  mockGetServerUserId: vi.fn(),
  mockCheckAndDeduct: vi.fn(),
  mockFinalizeDeduction: vi.fn(),
  mockCheckDailyImageCap: vi.fn(),
  mockRefund: vi.fn(),
  mockRefundForTxn: vi.fn(),
  mockBuildImagePrompt: vi.fn(),
  mockBuildReferencePrompt: vi.fn(),
  mockGenerateWithDallE: vi.fn(),
  mockGenerateWithOpenAIImageEdit: vi.fn(),
  mockUploadToCloudinary: vi.fn(),
  mockReviewGeneratedMediaQuality: vi.fn(),
  mockResolvePlatformImageFormat: vi.fn(),
  mockBuildPlatformReadyImageUrl: vi.fn(),
  mockVerifyPlatformReadyImage: vi.fn(),
  mockComposeBrandedPost: vi.fn(),
  mockBufferToDataUri: vi.fn(),
  mockScheduleAfterResponse: vi.fn(),
  pendingAfterTasks: [] as Array<() => Promise<void>>,
  mockPrisma: {
    $transaction: vi.fn(),
    workspace: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
    campaign: { findFirst: vi.fn() },
    socialPost: { findFirst: vi.fn(), update: vi.fn() },
    postStatusHistory: { create: vi.fn() },
    generatedVisual: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mockGetServerUserId }))
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/afterResponse', () => ({ scheduleAfterResponse: mockScheduleAfterResponse }))
vi.mock('@/lib/strategyApproval', () => ({ canMutateCampaignExecution: () => true }))
vi.mock('@/lib/contentPlanApprovalGuard', () => ({
  reviewContentPlanForApproval: () => ({ ok: true, issues: [] }),
}))
vi.mock('@/lib/billableAiRateLimit', () => ({
  enforceBillableAiRateLimit: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/lib/credits', () => ({
  CREDIT_COSTS: { IMAGE_GENERATION: 4 },
  checkAndDeductCredits: mockCheckAndDeduct,
  checkDailyImageCap: mockCheckDailyImageCap,
  creditCheckHttpStatus: () => 402,
  finalizeCreditDeduction: mockFinalizeDeduction,
  refundCredits: mockRefund,
  refundCreditsForTransaction: mockRefundForTxn,
  refundCreditDeduction: vi.fn(async ({ userId, action, deduction, reason }) => {
    if (!deduction) return { ok: true, status: 'not-charged' }
    if (deduction.transactionId) {
      return mockRefundForTxn({ userId, transactionId: deduction.transactionId, reason })
    }
    return mockRefund(userId, action, reason)
  }),
  buildCreditChargeReceipt: (action: string, deduction: any) => ({ action, cost: 4, ...deduction }),
}))
vi.mock('@/lib/ai/imageGen', () => ({
  buildImagePrompt: mockBuildImagePrompt,
  buildReferencePreservingEditPrompt: mockBuildReferencePrompt,
  generateWithDallE: mockGenerateWithDallE,
  generateWithOpenAIImageEdit: mockGenerateWithOpenAIImageEdit,
  IMAGE_OUTPUT_CLASSIFICATION: 'draft_background_for_review',
  uploadToCloudinary: mockUploadToCloudinary,
}))
vi.mock('@/lib/ai/generatedMediaQuality', () => ({
  reviewGeneratedMediaQuality: mockReviewGeneratedMediaQuality,
}))
vi.mock('@/lib/platformImageFormat', () => ({
  resolvePlatformImageFormat: mockResolvePlatformImageFormat,
  buildPlatformReadyImageUrl: mockBuildPlatformReadyImageUrl,
}))
vi.mock('@/lib/platformImageDelivery.server', () => ({
  verifyPlatformReadyImage: mockVerifyPlatformReadyImage,
}))
vi.mock('@/lib/ai/falGen', () => ({
  generateWithFlux: vi.fn(),
  platformToFluxAspectRatio: () => '3:2',
  platformToOpenAISize: () => '1536x1024',
}))
vi.mock('@/lib/cloudinaryOverlay', () => ({ platformToOverlay: () => 'square' }))
vi.mock('@/lib/brandComposite', () => ({
  composeBrandedPost: mockComposeBrandedPost,
  bufferToDataUri: mockBufferToDataUri,
}))

import { POST } from '../route'

const makeReq = (body: unknown = {}) => ({ json: async () => body }) as any
const flushScheduledGeneration = async () => {
  while (pendingAfterTasks.length > 0) {
    const task = pendingAfterTasks.shift()
    if (task) await task()
  }
}
const confirmedImageBody = {
  explicitImageGenerationConfirmed: true,
  acknowledgedCreditCost: 4,
  acknowledgedNoPublishOrSchedule: true,
  acknowledgedPostMediaForReview: true,
}

const workspace = { id: 'w1', ownerId: 'u1' }
const campaign = {
  id: 'c1',
  workspaceId: 'w1',
  name: 'Launch',
  goal: 'leads',
  tone: 'premium',
  audience: 'Founders',
  aiOutput: { strategy: { keyMessage: 'Grow faster' } },
  workspace: {
    id: 'w1',
    brandProfile: {
      brandName: 'Nexus',
      primaryOffer: 'AI marketing operator',
      industry: 'SaaS',
      toneKeywords: ['clear'],
      colorPalette: ['#111827'],
      visualStyle: 'Premium',
      uniqueAdvantages: ['fast'],
      logoUrl: null,
    },
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  pendingAfterTasks.length = 0
  mockScheduleAfterResponse.mockImplementation((task: () => Promise<void>) => {
    pendingAfterTasks.push(task)
  })
  mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => unknown) => callback(mockPrisma))
  vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
  vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'test-cloud')
  vi.stubEnv('CLOUDINARY_API_KEY', 'test-key')
  vi.stubEnv('CLOUDINARY_API_SECRET', 'test-secret')
  delete process.env.FAL_KEY
  mockGetServerUserId.mockResolvedValue('u1')
  mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 4, creditsRemaining: 16 })
  mockCheckDailyImageCap.mockResolvedValue({ allowed: true, used: 0, cap: 20, remaining: 20 })
  mockRefund.mockResolvedValue({ ok: true, status: 'refunded' })
  mockRefundForTxn.mockResolvedValue({ ok: true, status: 'refunded' })
  mockFinalizeDeduction.mockResolvedValue({ ok: true, status: 'settled' })
  mockBuildImagePrompt.mockResolvedValue({
    prompt: 'premium text-free ad background',
    language: 'en',
    concept: { headline: 'Grow faster' },
  })
  mockBuildReferencePrompt.mockReturnValue('preserve the exact reference source')
  mockGenerateWithDallE.mockResolvedValue('data:image/png;base64,raw')
  mockGenerateWithOpenAIImageEdit.mockResolvedValue('data:image/png;base64,edited')
  mockUploadToCloudinary.mockReset().mockResolvedValue('https://res.cloudinary.com/demo/raw.jpg')
  mockResolvePlatformImageFormat.mockImplementation((value: string) => {
    const platform = String(value || 'META').toUpperCase()
    return platform === 'LINKEDIN'
      ? { platform, format: 'Professional landscape feed image', aspectRatio: '1.91:1', width: 1200, height: 628 }
      : { platform, format: 'Portrait social feed image', aspectRatio: '4:5', width: 1080, height: 1350 }
  })
  mockBuildPlatformReadyImageUrl.mockImplementation(
    () => 'https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,w_1080,h_1350,q_auto/raw.jpg',
  )
  mockVerifyPlatformReadyImage.mockResolvedValue({
    passed: true,
    width: 1080,
    height: 1350,
    expectedWidth: 1080,
    expectedHeight: 1350,
    aspectRatio: '4:5',
    contentType: 'image/jpeg',
  })
  mockReviewGeneratedMediaQuality.mockResolvedValue({
    version: 1,
    passed: true,
    mediaType: 'IMAGE',
    referenceRequired: false,
    referencePreservationScore: null,
    semanticAlignmentScore: 95,
    professionalQualityScore: 95,
    technicalIntegrity: true,
    noNewRasterText: true,
    noInventedClaims: true,
    issues: [],
    summary: 'Passed',
    reviewedAt: '2026-07-17T00:00:00.000Z',
    providerUsage: {},
  })
  mockComposeBrandedPost.mockResolvedValue(Buffer.from('composite'))
  mockBufferToDataUri.mockReturnValue('data:image/jpeg;base64,composite')
  mockPrisma.workspace.findFirst.mockResolvedValue(workspace)
  mockPrisma.user.findUnique.mockResolvedValue({ subscriptionStatus: 'PRO' })
  mockPrisma.campaign.findFirst.mockResolvedValue(campaign)
  mockPrisma.generatedVisual.findFirst.mockResolvedValue(null)
  mockPrisma.generatedVisual.create.mockResolvedValue({ id: 'visual_1', workspaceId: 'w1' })
  mockPrisma.generatedVisual.update.mockResolvedValue({
    id: 'visual_1',
    status: 'COMPLETED',
    imageUrl: 'https://res.cloudinary.com/demo/final.jpg',
  })
  mockPrisma.socialPost.update.mockResolvedValue({ id: 'post_1', status: 'DRAFT' })
  mockPrisma.postStatusHistory.create.mockResolvedValue({ id: 'history_1' })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('POST /api/visuals/generate — RF-5 refund safety', () => {
  it('missing image providers returns 503 before credit deduction', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')
    vi.stubEnv('FAL_KEY', '')

    const res = await POST(makeReq({ ...confirmedImageBody, campaignId: 'c1' }))
    const json = await res.json()

    expect(res.status).toBe(503)
    expect(json).toMatchObject({ code: 'IMAGE_PROVIDER_UNAVAILABLE', creditsCharged: false })
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockGenerateWithDallE).not.toHaveBeenCalled()
  })

  it('missing permanent media storage returns 503 before credit deduction', async () => {
    vi.stubEnv('CLOUDINARY_CLOUD_NAME', '')
    vi.stubEnv('CLOUDINARY_API_KEY', '')
    vi.stubEnv('CLOUDINARY_API_SECRET', '')

    const res = await POST(makeReq({ ...confirmedImageBody, campaignId: 'c1' }))
    const json = await res.json()

    expect(res.status).toBe(503)
    expect(json).toMatchObject({ code: 'MEDIA_STORAGE_UNAVAILABLE', creditsCharged: false })
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockGenerateWithDallE).not.toHaveBeenCalled()
  })

  it('unauthenticated request does not deduct credits', async () => {
    mockGetServerUserId.mockResolvedValue(null)

    const res = await POST(makeReq())

    expect(res.status).toBe(401)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('missing workspace does not deduct credits', async () => {
    mockPrisma.workspace.findFirst.mockResolvedValue(null)

    const res = await POST(makeReq())

    expect(res.status).toBe(404)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
  })

  it('blocks image generation before deduction when Brand Brain source truth conflicts', async () => {
    mockPrisma.campaign.findFirst.mockResolvedValue({
      ...campaign,
      workspace: {
        ...campaign.workspace,
        brandProfile: {
          ...campaign.workspace.brandProfile,
          brandName: 'Noura Dental Studio',
          industry: 'Health & Beauty',
          description: 'A dental clinic providing consultations and treatment planning.',
          primaryOffer: 'Book a dental consultation',
        },
      },
    })

    const res = await POST(makeReq({ ...confirmedImageBody, campaignId: 'c1' }))
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json).toMatchObject({ code: 'BRAND_TRUTH_REVIEW_REQUIRED', redirectTo: '/brand' })
    expect(mockPrisma.generatedVisual.create).not.toHaveBeenCalled()
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockGenerateWithDallE).not.toHaveBeenCalled()
  })

  it('daily image cap failure does not deduct credits', async () => {
    mockCheckDailyImageCap.mockResolvedValue({ allowed: false, used: 3, cap: 3, remaining: 0 })

    const res = await POST(makeReq(confirmedImageBody))

    expect(res.status).toBe(429)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
  })

  it('missing explicit image confirmation returns 400 before credit deduction', async () => {
    const res = await POST(makeReq({ campaignId: 'c1' }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toMatchObject({
      error: 'IMAGE_GENERATION_CONFIRMATION_REQUIRED',
      message: 'Image generation requires explicit confirmation. No credits were spent.',
      required: {
        explicitImageGenerationConfirmed: true,
        acknowledgedCreditCost: 4,
        acknowledgedNoPublishOrSchedule: true,
      },
    })
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockGenerateWithDallE).not.toHaveBeenCalled()
    expect(mockPrisma.generatedVisual.create).not.toHaveBeenCalled()
  })

  it('wrong acknowledged credit cost returns 400 before credit deduction', async () => {
    const res = await POST(makeReq({
      ...confirmedImageBody,
      acknowledgedCreditCost: 3,
      campaignId: 'c1',
    }))

    expect(res.status).toBe(400)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockGenerateWithDallE).not.toHaveBeenCalled()
    expect(mockPrisma.generatedVisual.create).not.toHaveBeenCalled()
  })

  it('resumes an active durable job without a second charge or provider call', async () => {
    mockPrisma.generatedVisual.findFirst.mockResolvedValue({
      id: 'visual_active',
      workspaceId: 'w1',
      campaignId: 'c1',
      parentId: 'social-post:post_1',
      status: 'GENERATING',
    })

    const res = await POST(makeReq({
      ...confirmedImageBody,
      campaignId: 'c1',
      parentId: 'social-post:post_1',
      assetRole: 'final_composited_ad',
    }))
    const json = await res.json()

    expect(res.status).toBe(202)
    expect(json).toMatchObject({
      accepted: true,
      reused: true,
      visual: { id: 'visual_active', status: 'GENERATING' },
      pollUrl: '/api/visuals/visual_active',
      creditsReserved: 0,
    })
    expect(mockCheckDailyImageCap).not.toHaveBeenCalled()
    expect(mockPrisma.generatedVisual.create).not.toHaveBeenCalled()
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockGenerateWithDallE).not.toHaveBeenCalled()
    expect(mockScheduleAfterResponse).not.toHaveBeenCalled()
  })

  it('blocks immutable published posts before creating or charging a media job', async () => {
    mockPrisma.socialPost.findFirst.mockResolvedValue({
      id: 'post_1',
      workspaceId: 'w1',
      campaignId: 'c1',
      status: 'PUBLISHED',
      caption: 'Published copy',
      imagePrompt: 'Published visual',
      contentPlanIndex: 1,
    })

    const res = await POST(makeReq({
      ...confirmedImageBody,
      campaignId: 'c1',
      parentId: 'social-post:post_1',
    }))
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json).toMatchObject({ code: 'PUBLISHED_POST_IMMUTABLE' })
    expect(mockPrisma.generatedVisual.create).not.toHaveBeenCalled()
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
  })

  it('attaches a completed post visual server-side even if the browser closes', async () => {
    const post = {
      id: 'post_1',
      workspaceId: 'w1',
      campaignId: 'c1',
      status: 'APPROVED',
      caption: 'Nexus explains governed credit operations.',
      imagePrompt: 'A premium governed credit operations scene.',
      videoPrompt: null,
      contentPlanIndex: 10,
    }
    mockPrisma.socialPost.findFirst.mockResolvedValue(post)

    const res = await POST(makeReq({
      ...confirmedImageBody,
      campaignId: 'c1',
      parentId: 'social-post:post_1',
      assetRole: 'post_background',
    }))
    await flushScheduledGeneration()

    expect(res.status).toBe(202)
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
    expect(mockPrisma.socialPost.update).toHaveBeenCalledWith({
      where: { id: 'post_1' },
      data: expect.objectContaining({
        imageUrl: 'https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,w_1080,h_1350,q_auto/raw.jpg',
        uploadedMediaId: null,
        mediaSource: 'GENERATE',
        generationStatus: 'DONE',
        sourceType: 'AI_GENERATED',
        status: 'DRAFT',
        approvedAt: null,
      }),
    })
    expect(mockPrisma.postStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        socialPostId: 'post_1',
        fromStatus: 'APPROVED',
        toStatus: 'DRAFT',
        actor: 'USER',
      }),
    })
    expect(mockFinalizeDeduction).toHaveBeenCalledTimes(1)
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('missing no-publish/no-schedule acknowledgement returns 400 before credit deduction', async () => {
    const res = await POST(makeReq({
      explicitImageGenerationConfirmed: true,
      acknowledgedCreditCost: 4,
      campaignId: 'c1',
    }))

    expect(res.status).toBe(400)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockGenerateWithDallE).not.toHaveBeenCalled()
    expect(mockPrisma.generatedVisual.create).not.toHaveBeenCalled()
  })

  it('insufficient credits does not call image provider or refund', async () => {
    mockCheckAndDeduct.mockResolvedValue({ ok: false, error: 'INSUFFICIENT_CREDITS' })

    const res = await POST(makeReq({ ...confirmedImageBody, campaignId: 'c1' }))

    expect(res.status).toBe(402)
    expect(mockGenerateWithDallE).not.toHaveBeenCalled()
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('provider failure after deduction uses transaction-aware refund', async () => {
    mockCheckAndDeduct.mockResolvedValue({
      ok: true,
      creditsUsed: 4,
      creditsRemaining: 16,
      transactionId: 'txn_img',
    })
    mockGenerateWithDallE.mockRejectedValue(new Error('image provider down'))

    const res = await POST(makeReq({ ...confirmedImageBody, campaignId: 'c1' }))
    const json = await res.json()
    await flushScheduledGeneration()

    expect(res.status).toBe(202)
    expect(json).toMatchObject({ accepted: true, pollUrl: '/api/visuals/visual_1' })
    expect(mockRefundForTxn).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      transactionId: 'txn_img',
      reason: 'NEXUS Image Studio could not create a usable image. Reserved credits will be restored.',
    }))
    expect(mockRefund).not.toHaveBeenCalled()
  })

  it('reports pending reconciliation instead of claiming a failed refund succeeded', async () => {
    mockCheckAndDeduct.mockResolvedValue({
      ok: true,
      creditsUsed: 4,
      creditsRemaining: 16,
      transactionId: 'txn_img',
    })
    mockGenerateWithDallE.mockRejectedValue(new Error('image provider down'))
    mockRefundForTxn.mockResolvedValue({ ok: false, status: 'failed', error: 'db unavailable' })

    const res = await POST(makeReq({ ...confirmedImageBody, campaignId: 'c1' }))
    const json = await res.json()
    await flushScheduledGeneration()

    expect(res.status).toBe(202)
    expect(json).toMatchObject({ accepted: true })
    expect(mockPrisma.generatedVisual.update).toHaveBeenCalledWith({
      where: { id: 'visual_1' },
      data: expect.objectContaining({
        status: 'FAILED',
        errorMessage: 'NEXUS Image Studio could not create a usable image. Reserved credits will be restored.',
        qualityStatus: 'ERROR',
      }),
    })
  })

  it('permanent storage failure never persists a provider URL and refunds exactly once', async () => {
    mockCheckAndDeduct.mockResolvedValue({
      ok: true,
      creditsUsed: 4,
      creditsRemaining: 16,
      transactionId: 'txn_storage',
    })
    mockUploadToCloudinary.mockReset().mockRejectedValue(new Error('Cloudinary upload failed'))

    const res = await POST(makeReq({ ...confirmedImageBody, campaignId: 'c1' }))
    const json = await res.json()
    await flushScheduledGeneration()

    expect(res.status).toBe(202)
    expect(json).toMatchObject({ accepted: true })
    expect(mockPrisma.generatedVisual.update).toHaveBeenCalledWith({
      where: { id: 'visual_1' },
      data: expect.objectContaining({
        status: 'FAILED',
        errorMessage: 'NEXUS Image Studio could not create a usable image. Reserved credits will be restored.',
        qualityStatus: 'ERROR',
      }),
    })
    expect(mockPrisma.generatedVisual.update).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'COMPLETED' }),
    }))
    expect(mockRefundForTxn).toHaveBeenCalledTimes(1)
    expect(mockRefundForTxn).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      transactionId: 'txn_storage',
      reason: 'NEXUS Image Studio could not create a usable image. Reserved credits will be restored.',
    }))
    expect(mockRefund).not.toHaveBeenCalled()
  })

  it('DB create failure occurs before charging and never creates an untracked image', async () => {
    mockCheckAndDeduct.mockResolvedValue({
      ok: true,
      creditsUsed: 4,
      creditsRemaining: 16,
      transactionId: 'txn_temp',
    })
    mockPrisma.generatedVisual.create.mockRejectedValue(new Error('create failed'))

    const res = await POST(makeReq({ ...confirmedImageBody, campaignId: 'c1' }))

    expect(res.status).toBe(500)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockGenerateWithDallE).not.toHaveBeenCalled()
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('DB completion failure after provider success falls back to scalar refund without transactionId', async () => {
    mockPrisma.generatedVisual.update.mockRejectedValue(new Error('update failed'))

    const res = await POST(makeReq({ ...confirmedImageBody, campaignId: 'c1' }))
    await flushScheduledGeneration()

    expect(res.status).toBe(202)
    expect(mockRefund).toHaveBeenCalledWith('u1', 'IMAGE_GENERATION', 'NEXUS Image Studio could not create a usable image. Reserved credits will be restored.')
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('does not refund twice when final DB update fails', async () => {
    mockCheckAndDeduct.mockResolvedValue({
      ok: true,
      creditsUsed: 4,
      creditsRemaining: 16,
      transactionId: 'txn_update',
    })
    mockPrisma.generatedVisual.update.mockRejectedValue(new Error('update failed'))

    const res = await POST(makeReq({ ...confirmedImageBody, campaignId: 'c1' }))
    await flushScheduledGeneration()

    expect(res.status).toBe(202)
    expect(mockRefundForTxn).toHaveBeenCalledTimes(1)
    expect(mockRefund).not.toHaveBeenCalled()
  })

  it('releases an unlimited-plan reservation even when its wallet debit is 0', async () => {
    mockCheckAndDeduct.mockResolvedValue({
      ok: true,
      creditsUsed: 0,
      creditsRemaining: -1,
      isUnlimited: true,
      transactionId: 'txn_unlimited',
    })
    mockGenerateWithDallE.mockRejectedValue(new Error('provider failed'))

    const res = await POST(makeReq({ ...confirmedImageBody, campaignId: 'c1' }))
    await flushScheduledGeneration()

    expect(res.status).toBe(202)
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      transactionId: 'txn_unlimited',
    }))
  })

  it('success deducts once and returns background classification metadata', async () => {
    mockPrisma.generatedVisual.update.mockResolvedValue({
      id: 'visual_1',
      status: 'COMPLETED',
      imageUrl: 'https://res.cloudinary.com/demo/raw.jpg',
    })

    const res = await POST(makeReq({
      ...confirmedImageBody,
      campaignId: 'c1',
      platform: 'META',
      assetRole: 'post_background',
      creativeRequirement: {
        visualConcept: 'Office coffee background',
        objective: 'Support planning',
        aspectRatio: '4:5',
      },
      creativeTemplate: {
        templateName: 'Meta portrait offer card',
        aspectRatio: '4:5',
      },
    }))
    const json = await res.json()
    await flushScheduledGeneration()

    expect(res.status).toBe(202)
    expect(json).toMatchObject({
      accepted: true,
      visual: { id: 'visual_1' },
      pollUrl: '/api/visuals/visual_1',
      creditsReserved: 4,
    })
    expect(json.assetRole).toBe('post_background')
    expect(json.outputClassification).toBe('draft_background_for_review')
    expect(mockBuildImagePrompt).toHaveBeenCalledWith(expect.objectContaining({
      assetRole: 'post_background',
      creativeRequirement: expect.objectContaining({ visualConcept: 'Office coffee background' }),
      creativeTemplate: expect.objectContaining({ templateName: 'Meta portrait offer card' }),
    }))
    expect(mockComposeBrandedPost).not.toHaveBeenCalled()
    expect(mockCheckAndDeduct).toHaveBeenCalledWith(
      'u1',
      'IMAGE_GENERATION',
      undefined,
      expect.objectContaining({
        entityId: 'visual_1',
        entityType: 'generated_visual_image',
        operationKey: expect.any(String),
      }),
    )
    expect(mockCheckAndDeduct).toHaveBeenCalledTimes(1)
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('never burns copy or brand text into generated raster output', async () => {
    const res = await POST(makeReq({
      ...confirmedImageBody,
      campaignId: 'c1',
      platform: 'META',
      assetRole: 'legacy_composited_post',
    }))
    const json = await res.json()
    await flushScheduledGeneration()

    expect(res.status).toBe(202)
    expect(json).toMatchObject({ accepted: true, visual: { id: 'visual_1' } })
    expect(mockComposeBrandedPost).not.toHaveBeenCalled()
  })

  it('uses the owned post destination and exact server format instead of client sizing hints', async () => {
    const post = {
      id: 'post_1',
      workspaceId: 'w1',
      campaignId: 'c1',
      status: 'DRAFT',
      platform: 'META',
      publishTarget: 'LINKEDIN',
      caption: 'A governed LinkedIn message.',
      imagePrompt: 'Professional workspace scene.',
      videoPrompt: null,
      contentPlanIndex: 3,
    }
    mockPrisma.socialPost.findFirst.mockResolvedValue(post)
    mockBuildPlatformReadyImageUrl.mockReturnValue(
      'https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,w_1200,h_628,q_auto/raw.jpg',
    )
    mockVerifyPlatformReadyImage.mockResolvedValue({
      passed: true,
      width: 1200,
      height: 628,
      expectedWidth: 1200,
      expectedHeight: 628,
      aspectRatio: '1.91:1',
      contentType: 'image/jpeg',
    })

    const res = await POST(makeReq({
      ...confirmedImageBody,
      campaignId: 'c1',
      parentId: 'social-post:post_1',
      platform: 'TIKTOK',
      creativeRequirement: { aspectRatio: '9:16', visualConcept: 'Professional workspace' },
      creativeTemplate: { width: 1080, height: 1920, aspectRatio: '9:16' },
    }))
    await flushScheduledGeneration()

    expect(res.status).toBe(202)
    expect(mockResolvePlatformImageFormat).toHaveBeenCalledWith('LINKEDIN')
    expect(mockBuildImagePrompt).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'LINKEDIN',
      creativeRequirement: expect.objectContaining({ aspectRatio: '1.91:1' }),
      creativeTemplate: expect.objectContaining({ width: 1200, height: 628, aspectRatio: '1.91:1' }),
    }))
    expect(mockBuildPlatformReadyImageUrl).toHaveBeenCalledWith(
      'https://res.cloudinary.com/demo/raw.jpg',
      expect.objectContaining({ platform: 'LINKEDIN', width: 1200, height: 628 }),
    )
    expect(mockReviewGeneratedMediaQuality).toHaveBeenCalledWith(expect.objectContaining({
      outputFrames: ['https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,w_1200,h_628,q_auto/raw.jpg'],
      targetFormat: expect.objectContaining({ platform: 'LINKEDIN', aspectRatio: '1.91:1' }),
      formatValidation: expect.objectContaining({ passed: true, width: 1200, height: 628 }),
    }))
  })

  it('rejects a failed visual review, restores credits, and never attaches the image', async () => {
    mockCheckAndDeduct.mockResolvedValue({
      ok: true,
      creditsUsed: 4,
      creditsRemaining: 16,
      transactionId: 'txn_quality',
    })
    mockReviewGeneratedMediaQuality.mockResolvedValue({
      version: 1,
      passed: false,
      mediaType: 'IMAGE',
      referenceRequired: false,
      referencePreservationScore: null,
      semanticAlignmentScore: 40,
      professionalQualityScore: 62,
      technicalIntegrity: true,
      noNewRasterText: false,
      noInventedClaims: true,
      issues: ['Generated raster text is malformed.'],
      summary: 'Rejected',
      reviewedAt: '2026-07-17T00:00:00.000Z',
      providerUsage: {},
    })

    const res = await POST(makeReq({ ...confirmedImageBody, campaignId: 'c1' }))
    await flushScheduledGeneration()

    expect(res.status).toBe(202)
    expect(mockPrisma.generatedVisual.update).toHaveBeenCalledWith({
      where: { id: 'visual_1' },
      data: expect.objectContaining({
        status: 'FAILED',
        imageUrl: 'https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,w_1080,h_1350,q_auto/raw.jpg',
        qualityStatus: 'REJECTED',
      }),
    })
    expect(mockFinalizeDeduction).not.toHaveBeenCalled()
    expect(mockRefundForTxn).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      transactionId: 'txn_quality',
    }))
    expect(mockPrisma.socialPost.update).not.toHaveBeenCalled()
  })
})
