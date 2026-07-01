/**
 * RF-6A — content-plan batch image generation refund-safety contract.
 *
 * Guarantees:
 *   - auth, ownership, and pending-post loading happen before deduction
 *   - each requested image keeps the existing IMAGE_GENERATION cost
 *   - each image charge is tracked separately for transaction-aware refunds
 *   - failed images are refunded without refunding successful images
 *   - no live image provider calls are made in tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetServerUserId,
  mockCheckAndDeduct,
  mockRefund,
  mockRefundForTxn,
  mockGenerateWithFlux,
  mockPrisma,
} = vi.hoisted(() => ({
  mockGetServerUserId: vi.fn(),
  mockCheckAndDeduct: vi.fn(),
  mockRefund: vi.fn(),
  mockRefundForTxn: vi.fn(),
  mockGenerateWithFlux: vi.fn(),
  mockPrisma: {
    campaign: { findFirst: vi.fn() },
    socialPost: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mockGetServerUserId }))
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/credits', () => ({
  checkAndDeductCredits: mockCheckAndDeduct,
  refundCredits: mockRefund,
  refundCreditsForTransaction: mockRefundForTxn,
}))
vi.mock('@/lib/ai/falGen', () => ({
  generateWithFlux: mockGenerateWithFlux,
  platformToFluxSize: () => 'landscape_4_3',
}))

const makeReq = (body: unknown = {}) => ({ json: async () => body }) as any
const params = { params: { id: 'campaign_1' } }

const campaign = {
  id: 'campaign_1',
  workspaceId: 'workspace_1',
  workspace: { brandProfile: null },
}

const postA = {
  id: 'post_a',
  platform: 'META',
  imagePrompt: 'Premium bright ad creative for post A',
}

const postB = {
  id: 'post_b',
  platform: 'TIKTOK',
  imagePrompt: 'Premium bright ad creative for post B',
}

const confirmedBody = {
  explicitBulkImageGenerationConfirmed: true,
  acknowledgedImageCount: 2,
  acknowledgedCreditCost: 6,
}

async function loadRoute() {
  vi.resetModules()
  delete process.env.FAL_KEY
  delete process.env.CLOUDINARY_CLOUD_NAME
  delete process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  delete process.env.CLOUDINARY_API_KEY
  delete process.env.CLOUDINARY_API_SECRET
  return import('../route')
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetServerUserId.mockResolvedValue('user_1')
  mockPrisma.campaign.findFirst.mockResolvedValue(campaign)
  mockPrisma.socialPost.findMany.mockResolvedValue([postA, postB])
  mockPrisma.socialPost.updateMany.mockResolvedValue({ count: 2 })
  mockPrisma.socialPost.update.mockResolvedValue({})
  mockPrisma.socialPost.count.mockResolvedValue(0)
  mockCheckAndDeduct
    .mockResolvedValueOnce({ ok: true, creditsUsed: 3, creditsRemaining: 27, transactionId: 'txn_a' })
    .mockResolvedValueOnce({ ok: true, creditsUsed: 3, creditsRemaining: 24, transactionId: 'txn_b' })
  vi.stubGlobal('fetch', vi.fn(async () => ({
    json: async () => ({ data: [{ b64_json: 'raw-image' }] }),
  })))
})

describe('POST /api/campaigns/[id]/generate-content-plan/generate — RF-6A refund safety', () => {
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

  it('no pending posts does not deduct credits', async () => {
    mockPrisma.socialPost.findMany.mockResolvedValue([])
    const { POST } = await loadRoute()

    const res = await POST(makeReq(), params)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toMatchObject({ success: true, generated: 0 })
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
  })

  it('refunds prior image reservations if a later batch credit check fails', async () => {
    mockCheckAndDeduct
      .mockReset()
      .mockResolvedValueOnce({ ok: true, creditsUsed: 3, creditsRemaining: 1, transactionId: 'txn_a' })
      .mockResolvedValueOnce({ ok: false, error: 'INSUFFICIENT_CREDITS' })
    const { POST } = await loadRoute()

    const res = await POST(makeReq(confirmedBody), params)
    const json = await res.json()

    expect(res.status).toBe(402)
    expect(json).toMatchObject({ code: 'INSUFFICIENT_CREDITS', generated: 0 })
    expect(mockPrisma.socialPost.updateMany).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect(mockRefundForTxn).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user_1',
      transactionId: 'txn_a',
      reason: 'Batch image credit reservation failed',
    }))
    expect(mockRefund).not.toHaveBeenCalled()
  })

  it('requires explicit image generation confirmation before deduction', async () => {
    const { POST } = await loadRoute()

    const res = await POST(makeReq({ postIds: ['post_a', 'post_b'] }), params)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toMatchObject({
      code: 'CONFIRMATION_REQUIRED',
      expectedImageCount: 2,
      expectedCreditCost: 6,
    })
    expect(json.error).toContain('No credits were spent')
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockPrisma.socialPost.updateMany).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('refunds only the failed image transaction when another image succeeds', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ data: [{ b64_json: 'raw-a' }] }) })
      .mockRejectedValueOnce(new Error('provider down for B'))
    vi.stubGlobal('fetch', fetchMock)
    const { POST } = await loadRoute()

    const res = await POST(makeReq(confirmedBody), params)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.generated).toBe(1)
    expect(json.failed).toBe(1)
    expect(json.results).toEqual([
      expect.objectContaining({ id: 'post_a', success: true }),
      expect.objectContaining({ id: 'post_b', success: false }),
    ])
    expect(mockRefundForTxn).toHaveBeenCalledTimes(1)
    expect(mockRefundForTxn).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user_1',
      transactionId: 'txn_b',
      reason: 'provider down for B',
    }))
    expect(mockRefundForTxn).not.toHaveBeenCalledWith(expect.objectContaining({ transactionId: 'txn_a' }))
    expect(mockRefund).not.toHaveBeenCalled()
  })

  it('DB persistence failure after deduction refunds that image transaction', async () => {
    mockPrisma.socialPost.update
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('done update failed'))
      .mockResolvedValueOnce({})
    const { POST } = await loadRoute()

    const res = await POST(makeReq(confirmedBody), params)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.generated).toBe(1)
    expect(json.failed).toBe(1)
    expect(mockRefundForTxn).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user_1',
      transactionId: 'txn_b',
      reason: 'done update failed',
    }))
  })

  it('falls back to legacy scalar refund when transactionId is missing', async () => {
    mockCheckAndDeduct
      .mockReset()
      .mockResolvedValueOnce({ ok: true, creditsUsed: 3, creditsRemaining: 27 })
      .mockResolvedValueOnce({ ok: true, creditsUsed: 3, creditsRemaining: 24 })
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ data: [{ b64_json: 'raw-a' }] }) })
      .mockRejectedValueOnce(new Error('provider failed without txn')))
    const { POST } = await loadRoute()

    const res = await POST(makeReq(confirmedBody), params)

    expect(res.status).toBe(200)
    expect(mockRefund).toHaveBeenCalledWith('user_1', 'IMAGE_GENERATION', 'provider failed without txn')
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('does not refund unlimited users when creditsUsed is 0', async () => {
    mockCheckAndDeduct
      .mockReset()
      .mockResolvedValueOnce({ ok: true, creditsUsed: 0, creditsRemaining: -1, isUnlimited: true, transactionId: 'txn_a' })
      .mockResolvedValueOnce({ ok: true, creditsUsed: 0, creditsRemaining: -1, isUnlimited: true, transactionId: 'txn_b' })
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ data: [{ b64_json: 'raw-a' }] }) })
      .mockRejectedValueOnce(new Error('provider failed')))
    const { POST } = await loadRoute()

    const res = await POST(makeReq(confirmedBody), params)

    expect(res.status).toBe(200)
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('successful batch preserves response shape and does not refund', async () => {
    const { POST } = await loadRoute()

    const res = await POST(makeReq({ ...confirmedBody, postIds: ['post_a', 'post_b'] }), params)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({
      success: true,
      generated: 2,
      failed: 0,
      remaining: 0,
      results: [
        expect.objectContaining({ id: 'post_a', success: true, imageUrl: expect.any(String) }),
        expect.objectContaining({ id: 'post_b', success: true, imageUrl: expect.any(String) }),
      ],
    })
    expect(mockCheckAndDeduct).toHaveBeenCalledTimes(2)
    expect(mockCheckAndDeduct).toHaveBeenCalledWith('user_1', 'IMAGE_GENERATION')
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })
})
