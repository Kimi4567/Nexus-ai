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
  mockCheckDailyImageCap,
  mockRefund,
  mockRefundForTxn,
  mockGenerateWithFlux,
  mockBuildImagePrompt,
  mockPrisma,
} = vi.hoisted(() => ({
  mockGetServerUserId: vi.fn(),
  mockCheckAndDeduct: vi.fn(),
  mockCheckDailyImageCap: vi.fn(),
  mockRefund: vi.fn(),
  mockRefundForTxn: vi.fn(),
  mockGenerateWithFlux: vi.fn(),
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
vi.mock('@/lib/credits', () => ({
  checkAndDeductCredits: mockCheckAndDeduct,
  checkDailyImageCap: mockCheckDailyImageCap,
  refundCredits: mockRefund,
  refundCreditsForTransaction: mockRefundForTxn,
  getCreditActionPolicy: (action: string) => ({
    action,
    cost: 3,
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
}))

const makeReq = (body: unknown = {}) => ({ json: async () => body }) as any
const params = { params: Promise.resolve({ id: 'campaign_1' }) }

const campaign = {
  id: 'campaign_1',
  name: 'Launch campaign',
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
  acknowledgedImageCount: 1,
  acknowledgedCreditCost: 3,
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
  mockBuildImagePrompt.mockImplementation(async (context: any) => ({
    prompt: `Prepared visual for ${context.platform}: ${context.postCaption ?? ''}`,
    language: 'en',
  }))
  mockCheckAndDeduct
    .mockResolvedValueOnce({ ok: true, creditsUsed: 3, creditsRemaining: 27, transactionId: 'txn_a' })
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

  it('no pending posts does not deduct credits', async () => {
    mockPrisma.socialPost.findMany.mockResolvedValue([])
    const { POST } = await loadRoute()

    const res = await POST(makeReq(), params)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toMatchObject({ success: true, generated: 0 })
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
  })

  it('does not mutate or refund when the single credit reservation fails', async () => {
    mockCheckAndDeduct
      .mockReset()
      .mockResolvedValueOnce({ ok: false, error: 'INSUFFICIENT_CREDITS' })
    const { POST } = await loadRoute()

    const res = await POST(makeReq(confirmedBody), params)
    const json = await res.json()

    expect(res.status).toBe(402)
    expect(json).toMatchObject({ code: 'INSUFFICIENT_CREDITS', generated: 0 })
    expect(mockPrisma.socialPost.updateMany).not.toHaveBeenCalled()
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
      expectedCreditCost: 3,
    })
    expect(json.error).toContain('No credits were spent')
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockPrisma.socialPost.updateMany).not.toHaveBeenCalled()
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
      imagePrompt: 'square 1:1 composition; clinic operations table with paper notes.',
    }])
    mockCheckAndDeduct
      .mockReset()
      .mockResolvedValueOnce({ ok: true, creditsUsed: 3, creditsRemaining: 27, transactionId: 'txn_youtube' })
    const fetchMock = vi.fn(async (input: string | URL | Request) => String(input).includes('cloudinary.com')
      ? { ok: true, json: async () => ({ secure_url: 'https://res.cloudinary.com/test/youtube.jpg' }) }
      : { ok: true, json: async () => ({ data: [{ b64_json: 'raw-youtube' }] }) })
    vi.stubGlobal('fetch', fetchMock)
    const { POST } = await loadRoute()

    const res = await POST(makeReq({
      explicitBulkImageGenerationConfirmed: true,
      acknowledgedImageCount: 1,
      acknowledgedCreditCost: 3,
    }), params)

    expect(res.status).toBe(200)
    const firstFetchCall = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const requestBody = JSON.parse(firstFetchCall[1].body as string)
    expect(requestBody.size).toBe('1024x1536')
    expect(requestBody.prompt).toContain('vertical 9:16 composition')
    expect(requestBody.prompt).not.toContain('square 1:1 composition')
  })

  it('refunds the exact failed image transaction', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      if (!String(input).includes('cloudinary.com')) throw new Error('provider down for A')
      return { ok: true, json: async () => ({ secure_url: 'https://res.cloudinary.com/test/a.jpg' }) }
    })
    vi.stubGlobal('fetch', fetchMock)
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
      reason: 'provider down for A',
    }))
    expect(mockRefund).not.toHaveBeenCalled()
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
      reason: 'done update failed',
    }))
  })

  it('falls back to legacy scalar refund when transactionId is missing', async () => {
    mockCheckAndDeduct
      .mockReset()
      .mockResolvedValueOnce({ ok: true, creditsUsed: 3, creditsRemaining: 27 })
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      if (!String(input).includes('cloudinary.com')) throw new Error('provider failed without txn')
      return { ok: true, json: async () => ({ secure_url: 'https://res.cloudinary.com/test/a.jpg' }) }
    }))
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
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      if (!String(input).includes('cloudinary.com')) throw new Error('provider failed')
      return { ok: true, json: async () => ({ secure_url: 'https://res.cloudinary.com/test/a.jpg' }) }
    }))
    const { POST } = await loadRoute()

    const res = await POST(makeReq(confirmedBody), params)

    expect(res.status).toBe(200)
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
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
      creditCharges: [expect.objectContaining({ action: 'IMAGE_GENERATION', cost: 3, creditsUsed: 3 })],
    }))
    expect(mockCheckAndDeduct).toHaveBeenCalledTimes(1)
    expect(mockCheckAndDeduct).toHaveBeenCalledWith('user_1', 'IMAGE_GENERATION')
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })
})
