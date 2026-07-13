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
  mockRefund,
  mockRefundForTxn,
  mockGenerateWithFlux,
  mockApplyOverlay,
  mockPlatformToOverlay,
  mockPrisma,
} = vi.hoisted(() => ({
  mockCheckAndDeduct: vi.fn(),
  mockRefund: vi.fn(),
  mockRefundForTxn: vi.fn(),
  mockGenerateWithFlux: vi.fn(),
  mockApplyOverlay: vi.fn(),
  mockPlatformToOverlay: vi.fn(),
  mockPrisma: {
    socialPost: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/credits', () => ({
  checkAndDeductCredits: mockCheckAndDeduct,
  refundCredits: mockRefund,
  refundCreditsForTransaction: mockRefundForTxn,
}))
vi.mock('@/lib/ai/falGen', () => ({
  generateWithFlux: mockGenerateWithFlux,
  platformToFluxAspectRatio: () => '3:2',
}))
vi.mock('@/lib/cloudinaryOverlay', () => ({
  applyBrandOverlayFromProfile: mockApplyOverlay,
  platformToOverlay: mockPlatformToOverlay,
}))

const makeReq = (authorization = 'Bearer cron_secret') => ({
  headers: {
    get: (name: string) => (name.toLowerCase() === 'authorization' ? authorization : null),
  },
}) as any

const postA = {
  id: 'post_a',
  platform: 'META',
  imagePrompt: 'Premium autopilot visual A',
  workspace: {
    ownerId: 'user_1',
    brandProfile: null,
  },
}

const postB = {
  id: 'post_b',
  platform: 'TIKTOK',
  imagePrompt: 'Premium autopilot visual B',
  workspace: {
    ownerId: 'user_1',
    brandProfile: null,
  },
}

async function loadRoute() {
  vi.resetModules()
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('CRON_SECRET', 'cron_secret')
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
  mockPrisma.socialPost.update.mockResolvedValue({})
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

  it('partial success does not refund successful images and refunds failed images', async () => {
    mockPrisma.socialPost.findMany.mockResolvedValue([postA, postB])
    mockCheckAndDeduct
      .mockResolvedValueOnce({ ok: true, creditsUsed: 3, creditsRemaining: 27, transactionId: 'txn_a' })
      .mockResolvedValueOnce({ ok: true, creditsUsed: 3, creditsRemaining: 24, transactionId: 'txn_b' })
    mockGenerateWithFlux
      .mockResolvedValueOnce({ imageUrl: 'https://fal.cdn/image-a.png' })
      .mockRejectedValueOnce(new Error('provider down for B'))
    const { GET } = await loadRoute()

    const res = await GET(makeReq())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.processed).toBe(2)
    expect(json.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ postId: 'post_a', status: 'ok' }),
      expect.objectContaining({ postId: 'post_b', status: 'failed', error: 'provider down for B' }),
    ]))
    expect(mockRefundForTxn).toHaveBeenCalledTimes(1)
    expect(mockRefundForTxn).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user_1',
      transactionId: 'txn_b',
      reason: 'provider down for B',
    }))
    expect(mockRefundForTxn).not.toHaveBeenCalledWith(expect.objectContaining({ transactionId: 'txn_a' }))
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
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })
})
