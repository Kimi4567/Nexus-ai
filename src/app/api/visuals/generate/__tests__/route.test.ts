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
  mockCheckDailyImageCap,
  mockRefund,
  mockRefundForTxn,
  mockBuildImagePrompt,
  mockGenerateWithDallE,
  mockUploadToCloudinary,
  mockComposeBrandedPost,
  mockBufferToDataUri,
  mockPrisma,
} = vi.hoisted(() => ({
  mockGetServerUserId: vi.fn(),
  mockCheckAndDeduct: vi.fn(),
  mockCheckDailyImageCap: vi.fn(),
  mockRefund: vi.fn(),
  mockRefundForTxn: vi.fn(),
  mockBuildImagePrompt: vi.fn(),
  mockGenerateWithDallE: vi.fn(),
  mockUploadToCloudinary: vi.fn(),
  mockComposeBrandedPost: vi.fn(),
  mockBufferToDataUri: vi.fn(),
  mockPrisma: {
    workspace: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
    campaign: { findFirst: vi.fn() },
    generatedVisual: { create: vi.fn(), update: vi.fn() },
  },
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mockGetServerUserId }))
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/credits', () => ({
  CREDIT_COSTS: { IMAGE_GENERATION: 3 },
  checkAndDeductCredits: mockCheckAndDeduct,
  checkDailyImageCap: mockCheckDailyImageCap,
  refundCredits: mockRefund,
  refundCreditsForTransaction: mockRefundForTxn,
}))
vi.mock('@/lib/ai/imageGen', () => ({
  buildImagePrompt: mockBuildImagePrompt,
  generateWithDallE: mockGenerateWithDallE,
  IMAGE_OUTPUT_CLASSIFICATION: 'draft_background_for_review',
  uploadToCloudinary: mockUploadToCloudinary,
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
const confirmedImageBody = {
  explicitImageGenerationConfirmed: true,
  acknowledgedCreditCost: 3,
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
  vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
  vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'test-cloud')
  vi.stubEnv('CLOUDINARY_API_KEY', 'test-key')
  vi.stubEnv('CLOUDINARY_API_SECRET', 'test-secret')
  delete process.env.FAL_KEY
  mockGetServerUserId.mockResolvedValue('u1')
  mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 3, creditsRemaining: 17 })
  mockCheckDailyImageCap.mockResolvedValue({ allowed: true, used: 0, cap: 20, remaining: 20 })
  mockRefund.mockResolvedValue(undefined)
  mockRefundForTxn.mockResolvedValue(undefined)
  mockBuildImagePrompt.mockResolvedValue({
    prompt: 'premium text-free ad background',
    language: 'en',
    concept: { headline: 'Grow faster' },
  })
  mockGenerateWithDallE.mockResolvedValue('data:image/png;base64,raw')
  mockUploadToCloudinary
    .mockResolvedValueOnce('https://res.cloudinary.com/demo/raw.jpg')
    .mockResolvedValueOnce('https://res.cloudinary.com/demo/final.jpg')
  mockComposeBrandedPost.mockResolvedValue(Buffer.from('composite'))
  mockBufferToDataUri.mockReturnValue('data:image/jpeg;base64,composite')
  mockPrisma.workspace.findFirst.mockResolvedValue(workspace)
  mockPrisma.user.findUnique.mockResolvedValue({ subscriptionStatus: 'PRO' })
  mockPrisma.campaign.findFirst.mockResolvedValue(campaign)
  mockPrisma.generatedVisual.create.mockResolvedValue({ id: 'visual_1', workspaceId: 'w1' })
  mockPrisma.generatedVisual.update.mockResolvedValue({
    id: 'visual_1',
    status: 'COMPLETED',
    imageUrl: 'https://res.cloudinary.com/demo/final.jpg',
  })
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
        acknowledgedCreditCost: 3,
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
      acknowledgedCreditCost: 4,
      campaignId: 'c1',
    }))

    expect(res.status).toBe(400)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockGenerateWithDallE).not.toHaveBeenCalled()
    expect(mockPrisma.generatedVisual.create).not.toHaveBeenCalled()
  })

  it('missing no-publish/no-schedule acknowledgement returns 400 before credit deduction', async () => {
    const res = await POST(makeReq({
      explicitImageGenerationConfirmed: true,
      acknowledgedCreditCost: 3,
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
      creditsUsed: 3,
      creditsRemaining: 17,
      transactionId: 'txn_img',
    })
    mockGenerateWithDallE.mockRejectedValue(new Error('image provider down'))

    const res = await POST(makeReq({ ...confirmedImageBody, campaignId: 'c1' }))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.refunded).toBe(true)
    expect(mockRefundForTxn).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      transactionId: 'txn_img',
      reason: 'image provider down',
    }))
    expect(mockRefund).not.toHaveBeenCalled()
  })

  it('DB create failure refunds via transactionId without creating an untracked image', async () => {
    mockCheckAndDeduct.mockResolvedValue({
      ok: true,
      creditsUsed: 3,
      creditsRemaining: 17,
      transactionId: 'txn_temp',
    })
    mockPrisma.generatedVisual.create.mockRejectedValue(new Error('create failed'))

    const res = await POST(makeReq({ ...confirmedImageBody, campaignId: 'c1' }))

    expect(res.status).toBe(500)
    expect(mockRefundForTxn).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      transactionId: 'txn_temp',
      reason: 'create failed',
    }))
    expect(mockGenerateWithDallE).not.toHaveBeenCalled()
    expect(mockRefund).not.toHaveBeenCalled()
  })

  it('DB completion failure after provider success falls back to scalar refund without transactionId', async () => {
    mockPrisma.generatedVisual.update.mockRejectedValue(new Error('update failed'))

    const res = await POST(makeReq({ ...confirmedImageBody, campaignId: 'c1' }))

    expect(res.status).toBe(500)
    expect(mockRefund).toHaveBeenCalledWith('u1', 'IMAGE_GENERATION', 'update failed')
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('does not refund twice when final DB update fails', async () => {
    mockCheckAndDeduct.mockResolvedValue({
      ok: true,
      creditsUsed: 3,
      creditsRemaining: 17,
      transactionId: 'txn_update',
    })
    mockPrisma.generatedVisual.update.mockRejectedValue(new Error('update failed'))

    await POST(makeReq({ ...confirmedImageBody, campaignId: 'c1' }))

    expect(mockRefundForTxn).toHaveBeenCalledTimes(1)
    expect(mockRefund).not.toHaveBeenCalled()
  })

  it('does not refund unlimited users when creditsUsed is 0', async () => {
    mockCheckAndDeduct.mockResolvedValue({
      ok: true,
      creditsUsed: 0,
      creditsRemaining: -1,
      isUnlimited: true,
      transactionId: 'txn_unlimited',
    })
    mockGenerateWithDallE.mockRejectedValue(new Error('provider failed'))

    const res = await POST(makeReq({ ...confirmedImageBody, campaignId: 'c1' }))

    expect(res.status).toBe(500)
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
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

    expect(res.status).toBe(200)
    expect(json.visual).toEqual({
      id: 'visual_1',
      status: 'COMPLETED',
      imageUrl: 'https://res.cloudinary.com/demo/raw.jpg',
    })
    expect(json.assetRole).toBe('post_background')
    expect(json.outputClassification).toBe('draft_background_for_review')
    expect(mockBuildImagePrompt).toHaveBeenCalledWith(expect.objectContaining({
      assetRole: 'post_background',
      creativeRequirement: expect.objectContaining({ visualConcept: 'Office coffee background' }),
      creativeTemplate: expect.objectContaining({ templateName: 'Meta portrait offer card' }),
    }))
    expect(mockComposeBrandedPost).not.toHaveBeenCalled()
    expect(mockCheckAndDeduct).toHaveBeenCalledWith('u1', 'IMAGE_GENERATION')
    expect(mockCheckAndDeduct).toHaveBeenCalledTimes(1)
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('legacy asset role can still use the temporary brand compositor', async () => {
    const res = await POST(makeReq({
      ...confirmedImageBody,
      campaignId: 'c1',
      platform: 'META',
      assetRole: 'legacy_composited_post',
    }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.visual.imageUrl).toBe('https://res.cloudinary.com/demo/final.jpg')
    expect(mockComposeBrandedPost).toHaveBeenCalledTimes(1)
  })
})
