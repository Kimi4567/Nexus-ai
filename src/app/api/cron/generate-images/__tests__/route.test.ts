/**
 * RF-6B — cron/autopilot image generation refund-safety contract.
 *
 * Guarantees:
 *   - cron auth and no-job runs happen before deduction
 *   - each autopilot image keeps the existing IMAGE_GENERATION cost
 *   - failed images are refunded without refunding successful images
 *   - retry after a failed/refunded run does not double-refund the original debit
 *   - no live image provider calls are made in tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockCheckAndDeduct,
  mockCheckDailyImageCap,
  mockRefund,
  mockRefundForTxn,
  mockGenerateWithFlux,
  mockBuildImagePrompt,
  mockApplyOverlay,
  mockPlatformToOverlay,
  mockPrisma,
} = vi.hoisted(() => ({
  mockCheckAndDeduct: vi.fn(),
  mockCheckDailyImageCap: vi.fn(),
  mockRefund: vi.fn(),
  mockRefundForTxn: vi.fn(),
  mockGenerateWithFlux: vi.fn(),
  mockBuildImagePrompt: vi.fn(),
  mockApplyOverlay: vi.fn(),
  mockPlatformToOverlay: vi.fn(),
  mockPrisma: {
    user: { findUnique: vi.fn() },
    campaign: { findFirst: vi.fn() },
    generatedVisual: { create: vi.fn(), update: vi.fn() },
    socialPost: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/credits', () => ({
  checkAndDeductCredits: mockCheckAndDeduct,
  checkDailyImageCap: mockCheckDailyImageCap,
  refundCredits: mockRefund,
  refundCreditsForTransaction: mockRefundForTxn,
}))
vi.mock('@/lib/ai/falGen', () => ({
  generateWithFlux: mockGenerateWithFlux,
  platformToFluxAspectRatio: () => '3:2',
  platformToOpenAISize: () => '1536x1024',
}))
vi.mock('@/lib/ai/imageGen', () => ({
  buildImagePrompt: mockBuildImagePrompt,
}))
vi.mock('@/lib/cloudinaryOverlay', () => ({
  applyBrandOverlayFromProfile: mockApplyOverlay,
  platformToOverlay: mockPlatformToOverlay,
}))

const testCronSecret = 'c'.repeat(40)

const makeReq = (authorization = `Bearer ${testCronSecret}`) => ({
  headers: {
    get: (name: string) => (name.toLowerCase() === 'authorization' ? authorization : null),
  },
}) as any

const postA = {
  id: 'post_a',
  workspaceId: 'workspace_1',
  campaignId: null,
  platform: 'META',
  caption: 'Marketing insight A',
  imagePrompt: 'Premium autopilot visual A',
  workspace: {
    ownerId: 'user_1',
    brandProfile: null,
  },
}

const postB = {
  id: 'post_b',
  workspaceId: 'workspace_1',
  campaignId: null,
  platform: 'TIKTOK',
  caption: 'Marketing insight B',
  imagePrompt: 'Premium autopilot visual B',
  workspace: {
    ownerId: 'user_1',
    brandProfile: null,
  },
}

async function loadRoute() {
  vi.resetModules()
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('CRON_SECRET', testCronSecret)
  vi.stubEnv('FAL_KEY', 'fal_test_key')
  vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'test-cloud')
  vi.stubEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME', '')
  vi.stubEnv('CLOUDINARY_API_KEY', 'test-key')
  vi.stubEnv('CLOUDINARY_API_SECRET', 'test-secret')
  return import('../route')
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.socialPost.findMany.mockResolvedValue([postA])
  mockPrisma.socialPost.updateMany.mockResolvedValue({ count: 1 })
  mockPrisma.socialPost.update.mockResolvedValue({})
  mockPrisma.user.findUnique.mockResolvedValue({ subscriptionStatus: 'PRO' })
  mockPrisma.campaign.findFirst.mockResolvedValue(null)
  mockPrisma.generatedVisual.create.mockResolvedValue({ id: 'visual_a' })
  mockPrisma.generatedVisual.update.mockResolvedValue({})
  mockPrisma.$transaction.mockImplementation(async (callback: (tx: any) => unknown) => callback({
    socialPost: mockPrisma.socialPost,
    generatedVisual: mockPrisma.generatedVisual,
  }))
  mockCheckDailyImageCap.mockResolvedValue({ allowed: true, used: 0, cap: 60, remaining: 60 })
  mockBuildImagePrompt.mockResolvedValue({ prompt: 'Safe Brand Brain-grounded image prompt' })
  mockCheckAndDeduct.mockResolvedValue({
    ok: true,
    creditsUsed: 3,
    creditsRemaining: 27,
    transactionId: 'txn_a',
  })
  mockRefund.mockResolvedValue(undefined)
  mockRefundForTxn.mockResolvedValue(undefined)
  mockGenerateWithFlux.mockResolvedValue({ imageUrl: 'https://fal.cdn/image-a.png' })
  mockApplyOverlay.mockImplementation((url: string) => `${url}?overlay=1`)
  mockPlatformToOverlay.mockReturnValue('square')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: async () => ({ secure_url: 'https://res.cloudinary.com/test/image.png' }),
  }))
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('GET /api/cron/generate-images — RF-6B refund safety', () => {
  it('cron auth failure before deduction does not charge', async () => {
    const { GET } = await loadRoute()

    const res = await GET(makeReq('Bearer wrong_secret'))

    expect(res.status).toBe(401)
    expect(mockPrisma.socialPost.findMany).not.toHaveBeenCalled()
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('no eligible image jobs does not charge', async () => {
    mockPrisma.socialPost.findMany.mockResolvedValue([])
    const { GET } = await loadRoute()

    const res = await GET(makeReq())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toMatchObject({ processed: 0, results: [] })
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
  })

  it('provider failure after deduction refunds via transactionId', async () => {
    mockGenerateWithFlux.mockRejectedValue(new Error('provider down'))
    const { GET } = await loadRoute()

    const res = await GET(makeReq())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.results).toEqual([
      expect.objectContaining({ postId: 'post_a', status: 'failed', error: 'provider down' }),
    ])
    expect(mockRefundForTxn).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user_1',
      transactionId: 'txn_a',
      reason: 'provider down',
    }))
    expect(mockRefund).not.toHaveBeenCalled()
  })

  it('DB persistence failure after deduction refunds via transactionId', async () => {
    mockPrisma.socialPost.update.mockRejectedValue(new Error('db update failed'))
    const { GET } = await loadRoute()

    const res = await GET(makeReq())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.results[0]).toMatchObject({
      postId: 'post_a',
      status: 'failed',
      error: 'db update failed',
    })
    expect(mockRefundForTxn).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user_1',
      transactionId: 'txn_a',
      reason: 'db update failed',
    }))
  })

  it('processes only one atomic image even if an adapter ignores Prisma take', async () => {
    mockPrisma.socialPost.findMany.mockResolvedValue([postA, postB])
    const { GET } = await loadRoute()

    const res = await GET(makeReq())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.processed).toBe(1)
    expect(json.results).toEqual([
      expect.objectContaining({ postId: 'post_a', status: 'ok' }),
    ])
    expect(mockCheckAndDeduct).toHaveBeenCalledTimes(1)
    expect(mockGenerateWithFlux).toHaveBeenCalledTimes(1)
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('daily cap blocks generation before prompt preparation and deduction', async () => {
    mockCheckDailyImageCap.mockResolvedValue({ allowed: false, used: 60, cap: 60, remaining: 0 })
    const { GET } = await loadRoute()

    const res = await GET(makeReq())
    const json = await res.json()

    expect(json.results[0]).toMatchObject({ postId: 'post_a', status: 'skipped_daily_cap', remaining: 0 })
    expect(mockBuildImagePrompt).not.toHaveBeenCalled()
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockGenerateWithFlux).not.toHaveBeenCalled()
  })

  it('a concurrent cron claim cannot double-charge the same post', async () => {
    mockPrisma.socialPost.updateMany.mockResolvedValue({ count: 0 })
    const { GET } = await loadRoute()

    const res = await GET(makeReq())
    const json = await res.json()

    expect(json.results[0]).toMatchObject({ postId: 'post_a', status: 'skipped_already_claimed' })
    expect(mockBuildImagePrompt).not.toHaveBeenCalled()
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockGenerateWithFlux).not.toHaveBeenCalled()
  })

  it('releases the atomic claim when the user has no credits', async () => {
    mockCheckAndDeduct.mockResolvedValue({
      ok: false,
      error: 'INSUFFICIENT_CREDITS',
      currentCredits: 0,
      requiredCredits: 3,
    })
    const { GET } = await loadRoute()

    const res = await GET(makeReq())
    const json = await res.json()

    expect(json.results[0]).toMatchObject({ postId: 'post_a', status: 'skipped_no_credits' })
    expect(mockPrisma.socialPost.update).toHaveBeenCalledWith({
      where: { id: 'post_a' },
      data: { generationStatus: 'PENDING' },
    })
    expect(mockPrisma.generatedVisual.create).not.toHaveBeenCalled()
    expect(mockGenerateWithFlux).not.toHaveBeenCalled()
  })

  it('retry after a failed/refunded run does not double-refund the original debit', async () => {
    mockGenerateWithFlux
      .mockRejectedValueOnce(new Error('first run failed'))
      .mockResolvedValueOnce({ imageUrl: 'https://fal.cdn/retry-success.png' })
    mockCheckAndDeduct
      .mockResolvedValueOnce({ ok: true, creditsUsed: 3, creditsRemaining: 27, transactionId: 'txn_first' })
      .mockResolvedValueOnce({ ok: true, creditsUsed: 3, creditsRemaining: 24, transactionId: 'txn_retry' })
    const { GET } = await loadRoute()

    const first = await GET(makeReq())
    const second = await GET(makeReq())
    const firstJson = await first.json()
    const secondJson = await second.json()

    expect(firstJson.results[0]).toMatchObject({ status: 'failed' })
    expect(secondJson.results[0]).toMatchObject({ status: 'ok' })
    expect(mockRefundForTxn).toHaveBeenCalledTimes(1)
    expect(mockRefundForTxn).toHaveBeenCalledWith(expect.objectContaining({
      transactionId: 'txn_first',
      reason: 'first run failed',
    }))
    expect(mockRefundForTxn).not.toHaveBeenCalledWith(expect.objectContaining({ transactionId: 'txn_retry' }))
  })

  it('falls back to scalar refund when transactionId is missing', async () => {
    mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 3, creditsRemaining: 27 })
    mockGenerateWithFlux.mockRejectedValue(new Error('provider failed without txn'))
    const { GET } = await loadRoute()

    const res = await GET(makeReq())

    expect(res.status).toBe(200)
    expect(mockRefund).toHaveBeenCalledWith('user_1', 'IMAGE_GENERATION', 'provider failed without txn')
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('does not refund unlimited users when creditsUsed is 0', async () => {
    mockCheckAndDeduct.mockResolvedValue({
      ok: true,
      creditsUsed: 0,
      creditsRemaining: -1,
      isUnlimited: true,
      transactionId: 'txn_unlimited',
    })
    mockGenerateWithFlux.mockRejectedValue(new Error('provider failed'))
    const { GET } = await loadRoute()

    const res = await GET(makeReq())

    expect(res.status).toBe(200)
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('successful run preserves response shape and does not refund', async () => {
    const { GET } = await loadRoute()

    const res = await GET(makeReq())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({
      processed: 1,
      results: [
        { postId: 'post_a', status: 'ok', url: 'https://res.cloudinary.com/test/image.png' },
      ],
      runAt: expect.any(String),
    })
    expect(mockCheckAndDeduct).toHaveBeenCalledWith('user_1', 'IMAGE_GENERATION')
    expect(mockPrisma.socialPost.update).toHaveBeenCalledWith({
      where: { id: 'post_a' },
      data: {
        imageUrl: 'https://res.cloudinary.com/test/image.png',
        generationStatus: 'DONE',
        mediaSource: 'GENERATE',
      },
    })
    expect(mockBuildImagePrompt).toHaveBeenCalledWith(expect.objectContaining({
      postCaption: expect.stringContaining('Marketing insight A'),
      platform: 'META',
      assetRole: 'post_background',
    }))
    expect(mockPrisma.generatedVisual.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        enhancedPrompt: 'Safe Brand Brain-grounded image prompt',
        parentId: 'social-post:post_a',
        status: 'GENERATING',
      }),
    }))
    expect(mockPrisma.generatedVisual.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'COMPLETED' }),
    }))
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })
})
