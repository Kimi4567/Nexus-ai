/**
 * RF-6A — content-plan batch image generation refund-safety contract.
 *
 * Guarantees:
 *   - auth, ownership, and pending-post loading happen before deduction
 *   - each request owns exactly one IMAGE_GENERATION charge
 *   - failed images receive a transaction-aware refund
 *   - no live image provider calls are made in tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetServerUserId,
  mockCheckAndDeduct,
  mockFinalizeDeduction,
  mockCheckDailyImageCap,
  mockRefund,
  mockRefundForTxn,
  mockGenerateWithFlux,
  mockGenerateWithDallE,
  mockUploadToCloudinary,
  mockReviewGeneratedMediaQuality,
  mockResolvePlatformImageFormat,
  mockBuildPlatformReadyImageUrl,
  mockVerifyPlatformReadyImage,
  mockBuildImagePrompt,
  mockPrisma,
} = vi.hoisted(() => ({
  mockGetServerUserId: vi.fn(),
  mockCheckAndDeduct: vi.fn(),
  mockFinalizeDeduction: vi.fn(),
  mockCheckDailyImageCap: vi.fn(),
  mockRefund: vi.fn(),
  mockRefundForTxn: vi.fn(),
  mockGenerateWithFlux: vi.fn(),
  mockGenerateWithDallE: vi.fn(),
  mockUploadToCloudinary: vi.fn(),
  mockReviewGeneratedMediaQuality: vi.fn(),
  mockResolvePlatformImageFormat: vi.fn(),
  mockBuildPlatformReadyImageUrl: vi.fn(),
  mockVerifyPlatformReadyImage: vi.fn(),
  mockBuildImagePrompt: vi.fn(),
  mockPrisma: {
    campaign: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
    generatedVisual: { create: vi.fn(), update: vi.fn() },
    socialPost: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mockGetServerUserId }))
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/billableAiRateLimit', () => ({
  enforceBillableAiRateLimit: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/lib/credits', () => ({
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
  getCreditActionPolicy: (action: string) => ({
    action,
    cost: 4,
    label: 'Image generation',
    reason: 'Creates one reviewable campaign image for a specific post.',
  }),
}))
vi.mock('@/lib/ai/falGen', () => ({
  generateWithFlux: mockGenerateWithFlux,
  platformToFluxAspectRatio: () => '3:2',
  platformToOpenAISize: (platform: string) => platform === 'YOUTUBE' ? '1024x1536' : '1024x1024',
}))
vi.mock('@/lib/ai/imageGen', () => ({
  buildImagePrompt: mockBuildImagePrompt,
  generateWithDallE: mockGenerateWithDallE,
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

const makeReq = (body: unknown = {}) => ({ json: async () => body }) as any
const params = { params: Promise.resolve({ id: 'campaign_1' }) }

const campaign = {
  id: 'campaign_1',
  name: 'Launch campaign',
  status: 'ACTIVE',
  workspaceId: 'workspace_1',
  aiOutput: {
    strategy: {
      keyMessage: 'A clearer software launch workflow for marketing teams.',
      contentPillars: ['Software launch workflow', 'Campaign planning'],
    },
    qualityGate: { schemaVersion: 1, status: 'passed', blockers: [] },
    sentinelReview: { status: 'passed' },
  },
  workspace: {
    brandProfile: {
      brandName: 'LaunchFlow',
      industry: 'SaaS',
      description: 'A software platform for planning and reviewing marketing launches.',
      primaryOffer: 'Campaign launch workflow software',
      uniqueAdvantages: ['Reviewable launch steps'],
    },
  },
}

const postA = {
  id: 'post_a',
  platform: 'META',
  caption: 'Use a clear software launch workflow to review campaign steps before release.',
  imagePrompt: 'Text-free software launch planning scene for post A',
  contentPlanIndex: 1,
}

const postB = {
  id: 'post_b',
  platform: 'TIKTOK',
  caption: 'Review campaign planning inside one software launch workflow.',
  imagePrompt: 'Text-free software launch planning scene for post B',
  contentPlanIndex: 2,
}

const confirmedBody = {
  explicitBulkImageGenerationConfirmed: true,
  acknowledgedImageCount: 1,
  acknowledgedCreditCost: 4,
}

async function loadRoute(withProvider = true) {
  vi.resetModules()
  delete process.env.FAL_KEY
  vi.stubEnv('OPENAI_API_KEY', withProvider ? 'test-openai-key' : '')
  delete process.env.CLOUDINARY_CLOUD_NAME
  vi.stubEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME', 'test-cloud')
  vi.stubEnv('CLOUDINARY_API_KEY', 'test-key')
  vi.stubEnv('CLOUDINARY_API_SECRET', 'test-secret')
  return import('../route')
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetServerUserId.mockResolvedValue('user_1')
  mockPrisma.campaign.findFirst.mockResolvedValue(campaign)
  mockPrisma.user.findUnique.mockResolvedValue({ subscriptionStatus: 'PRO' })
  mockPrisma.generatedVisual.create
    .mockResolvedValueOnce({ id: 'visual_a' })
  mockPrisma.generatedVisual.update.mockResolvedValue({})
  mockPrisma.socialPost.findMany.mockResolvedValue([postA, postB])
  mockPrisma.socialPost.updateMany.mockResolvedValue({ count: 1 })
  mockPrisma.socialPost.update.mockResolvedValue({})
  mockPrisma.socialPost.count.mockResolvedValue(0)
  mockPrisma.$transaction.mockImplementation(async (callback: (tx: any) => unknown) => callback({
    socialPost: mockPrisma.socialPost,
    generatedVisual: mockPrisma.generatedVisual,
  }))
  mockCheckDailyImageCap.mockResolvedValue({ allowed: true, used: 0, cap: 60, remaining: 60 })
  mockRefund.mockResolvedValue({ ok: true, status: 'refunded' })
  mockRefundForTxn.mockResolvedValue({ ok: true, status: 'refunded' })
  mockFinalizeDeduction.mockResolvedValue({ ok: true, status: 'settled' })
  mockBuildImagePrompt.mockImplementation(async (context: any) => ({
    prompt: `Prepared visual for ${context.platform}: ${context.postCaption ?? ''}`,
    language: 'en',
  }))
  mockGenerateWithDallE.mockResolvedValue('data:image/png;base64,raw-image')
  mockUploadToCloudinary.mockReset().mockResolvedValue('https://res.cloudinary.com/test/raw.jpg')
  mockResolvePlatformImageFormat.mockImplementation((platform: string) => ({
    platform: String(platform || 'META').toUpperCase(),
    format: 'Portrait social feed image',
    aspectRatio: '4:5',
    width: 1080,
    height: 1350,
  }))
  mockBuildPlatformReadyImageUrl.mockImplementation((url: string) => url)
  mockVerifyPlatformReadyImage.mockResolvedValue({
    passed: true,
    width: 1080,
    height: 1350,
    expectedWidth: 1080,
    expectedHeight: 1350,
    aspectRatio: '4:5',
    contentType: 'image/jpeg',
  })
  mockReviewGeneratedMediaQuality.mockResolvedValue({ passed: true })
  mockCheckAndDeduct
    .mockResolvedValueOnce({ ok: true, creditsUsed: 4, creditsRemaining: 26, transactionId: 'txn_a' })
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
    const url = String(input)
    if (url.includes('cloudinary.com')) {
      return { ok: true, json: async () => ({ secure_url: 'https://res.cloudinary.com/test/image.jpg' }) }
    }
    return { ok: true, json: async () => ({ data: [{ b64_json: 'raw-image' }] }) }
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('POST /api/campaigns/[id]/generate-content-plan/generate — RF-6A refund safety', () => {
  it('missing image providers returns 503 before reserving any credits', async () => {
    const { POST } = await loadRoute(false)

    const res = await POST(makeReq(confirmedBody), params)
    const json = await res.json()

    expect(res.status).toBe(503)
    expect(json).toMatchObject({ code: 'IMAGE_PROVIDER_UNAVAILABLE', creditsCharged: false })
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('auth failure happens before any deduction', async () => {
    mockGetServerUserId.mockResolvedValue(null)
    const { POST } = await loadRoute()

    const res = await POST(makeReq(), params)

    expect(res.status).toBe(401)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('campaign ownership failure happens before any deduction', async () => {
    mockPrisma.campaign.findFirst.mockResolvedValue(null)
    const { POST } = await loadRoute()

    const res = await POST(makeReq(), params)

    expect(res.status).toBe(404)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
  })

  it('blocks paid media before deduction when Brand Brain contradicts the business description', async () => {
    mockPrisma.campaign.findFirst.mockResolvedValue({
      ...campaign,
      workspace: {
        brandProfile: {
          ...campaign.workspace.brandProfile,
          industry: 'Health & Beauty',
          description: 'A dental clinic providing consultations and treatment planning.',
          primaryOffer: 'Book a dental consultation',
        },
      },
    })
    const { POST } = await loadRoute()

    const res = await POST(makeReq(confirmedBody), params)
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json).toMatchObject({ code: 'BRAND_TRUTH_REVIEW_REQUIRED', redirectTo: '/brand' })
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockPrisma.socialPost.updateMany).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('no pending posts does not deduct credits', async () => {
    mockPrisma.socialPost.findMany.mockResolvedValue([])
    const { POST } = await loadRoute()

    const res = await POST(makeReq(), params)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toMatchObject({ success: true, generated: 0 })
    expect(mockPrisma.socialPost.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        generationStatus: 'PENDING',
        imageUrl: null,
        uploadedMediaId: null,
        mediaSource: { in: ['GENERATE', 'MIXED'] },
      }),
    }))
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
  })

  it('releases the atomic image claim without refunding when the credit reservation fails', async () => {
    mockCheckAndDeduct
      .mockReset()
      .mockResolvedValueOnce({ ok: false, error: 'INSUFFICIENT_CREDITS' })
    const { POST } = await loadRoute()

    const res = await POST(makeReq(confirmedBody), params)
    const json = await res.json()

    expect(res.status).toBe(402)
    expect(json).toMatchObject({ code: 'INSUFFICIENT_CREDITS', generated: 0 })
    expect(mockPrisma.socialPost.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'post_a',
        generationStatus: 'PENDING',
        imageUrl: null,
        mediaSource: { in: ['GENERATE', 'MIXED'] },
        uploadedMediaId: null,
      }),
      data: { generationStatus: 'GENERATING' },
    })
    expect(mockPrisma.socialPost.update).toHaveBeenCalledWith({
      where: { id: 'post_a' },
      data: { generationStatus: 'PENDING' },
    })
    expect(fetch).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
    expect(mockRefund).not.toHaveBeenCalled()
  })

  it('requires explicit image generation confirmation before deduction', async () => {
    const { POST } = await loadRoute()

    const res = await POST(makeReq({ postIds: ['post_a', 'post_b'] }), params)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toMatchObject({
      code: 'CONFIRMATION_REQUIRED',
      expectedImageCount: 1,
      expectedCreditCost: 4,
    })
    expect(json.error).toContain('No credits were spent')
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockPrisma.socialPost.updateMany).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('a concurrent request cannot double-charge an already claimed image', async () => {
    mockPrisma.socialPost.updateMany.mockResolvedValue({ count: 0 })
    const { POST } = await loadRoute()

    const res = await POST(makeReq(confirmedBody), params)
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json).toMatchObject({ code: 'IMAGE_ALREADY_CLAIMED', generated: 0, failed: 0 })
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects the image when the daily image allowance is exhausted before deduction', async () => {
    mockCheckDailyImageCap.mockResolvedValue({ allowed: false, used: 3, cap: 3, remaining: 0 })
    const { POST } = await loadRoute()

    const res = await POST(makeReq(confirmedBody), params)
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json).toMatchObject({ error: 'DAILY_IMAGE_LIMIT', requested: 1, remaining: 0 })
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('normalizes persisted YOUTUBE square prompts to vertical portrait generation', async () => {
    mockPrisma.socialPost.findMany.mockResolvedValue([{
      id: 'post_youtube',
      platform: 'YOUTUBE',
      caption: 'Review a clinic operations software workflow before launch.',
      imagePrompt: 'square 1:1 composition; clinic operations table with paper notes.',
      contentPlanIndex: 1,
    }])
    mockCheckAndDeduct
      .mockReset()
      .mockResolvedValueOnce({ ok: true, creditsUsed: 4, creditsRemaining: 26, transactionId: 'txn_youtube' })
    const { POST } = await loadRoute()

    const res = await POST(makeReq({
      explicitBulkImageGenerationConfirmed: true,
      acknowledgedImageCount: 1,
      acknowledgedCreditCost: 4,
    }), params)

    expect(res.status).toBe(200)
    expect(mockGenerateWithDallE).toHaveBeenCalledWith(
      expect.stringContaining('vertical 9:16 composition'),
      '1024x1536',
    )
    expect(mockGenerateWithDallE.mock.calls[0][0]).not.toContain('square 1:1 composition')
  })

  it('refunds the exact failed image transaction', async () => {
    mockGenerateWithDallE.mockRejectedValueOnce(new Error('provider down for A'))
    const { POST } = await loadRoute()

    const res = await POST(makeReq(confirmedBody), params)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.generated).toBe(0)
    expect(json.failed).toBe(1)
    expect(json.results).toEqual([
      expect.objectContaining({ id: 'post_a', success: false }),
    ])
    expect(mockRefundForTxn).toHaveBeenCalledTimes(1)
    expect(mockRefundForTxn).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user_1',
      transactionId: 'txn_a',
      reason: 'NEXUS Image Studio could not create a usable image.',
    }))
    expect(mockRefund).not.toHaveBeenCalled()
  })

  it('reports a pending automatic reconciliation when the exact refund fails', async () => {
    mockRefundForTxn.mockResolvedValue({ ok: false, status: 'failed', error: 'db down' })
    mockGenerateWithDallE.mockRejectedValueOnce(new Error('provider down'))
    const { POST } = await loadRoute()

    const res = await POST(makeReq(confirmedBody), params)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toMatchObject({ success: false, generated: 0, failed: 1, refundPending: 1 })
    expect(json.results).toEqual([
      expect.objectContaining({ id: 'post_a', success: false, refunded: false }),
    ])
    expect(mockPrisma.socialPost.update).toHaveBeenCalledWith({
      where: { id: 'post_a' },
      data: { generationStatus: 'REFUND_PENDING' },
    })
  })

  it('DB persistence failure after deduction refunds that image transaction', async () => {
    mockPrisma.socialPost.update
      .mockRejectedValueOnce(new Error('done update failed'))
      .mockResolvedValueOnce({})
    const { POST } = await loadRoute()

    const res = await POST(makeReq(confirmedBody), params)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.generated).toBe(0)
    expect(json.failed).toBe(1)
    expect(mockRefundForTxn).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user_1',
      transactionId: 'txn_a',
      reason: 'NEXUS Image Studio could not create a usable image.',
    }))
  })

  it('falls back to legacy scalar refund when transactionId is missing', async () => {
    mockCheckAndDeduct
      .mockReset()
      .mockResolvedValueOnce({ ok: true, creditsUsed: 4, creditsRemaining: 26 })
    mockGenerateWithDallE.mockRejectedValueOnce(new Error('provider failed without txn'))
    const { POST } = await loadRoute()

    const res = await POST(makeReq(confirmedBody), params)

    expect(res.status).toBe(200)
    expect(mockRefund).toHaveBeenCalledWith('user_1', 'IMAGE_GENERATION', 'NEXUS Image Studio could not create a usable image.')
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('releases an unlimited-plan reservation even when its wallet debit is 0', async () => {
    mockCheckAndDeduct
      .mockReset()
      .mockResolvedValueOnce({ ok: true, creditsUsed: 0, creditsRemaining: -1, isUnlimited: true, transactionId: 'txn_a' })
    mockGenerateWithDallE.mockRejectedValueOnce(new Error('provider failed'))
    const { POST } = await loadRoute()

    const res = await POST(makeReq(confirmedBody), params)

    expect(res.status).toBe(200)
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user_1',
      transactionId: 'txn_a',
    }))
  })

  it('successful single-image request preserves response shape and does not refund', async () => {
    const { POST } = await loadRoute()

    const res = await POST(makeReq({ ...confirmedBody, postIds: ['post_a', 'post_b'] }), params)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual(expect.objectContaining({
      success: true,
      generated: 1,
      failed: 0,
      remaining: 0,
      results: [
        expect.objectContaining({ id: 'post_a', success: true, imageUrl: expect.any(String) }),
      ],
      creditCharges: [expect.objectContaining({ action: 'IMAGE_GENERATION', cost: 4, creditsUsed: 4 })],
    }))
    expect(mockCheckAndDeduct).toHaveBeenCalledTimes(1)
    expect(mockCheckAndDeduct).toHaveBeenCalledWith(
      'user_1',
      'IMAGE_GENERATION',
      undefined,
      expect.objectContaining({
        entityId: 'post_a',
        entityType: 'social_post_image',
        operationKey: expect.any(String),
      }),
    )
    expect(mockBuildImagePrompt).toHaveBeenCalledWith(expect.objectContaining({
      postCaption: expect.stringContaining(postA.caption),
      creativeDirection: postA.imagePrompt,
    }))
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })
})
