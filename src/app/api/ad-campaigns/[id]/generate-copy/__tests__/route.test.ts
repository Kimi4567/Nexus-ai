import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetAuthUser,
  mockCheckAndDeduct,
  mockRefund,
  mockRefundForTxn,
  mockPrisma,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockCheckAndDeduct: vi.fn(),
  mockRefund: vi.fn(),
  mockRefundForTxn: vi.fn(),
  mockPrisma: {
    adCampaign: { findFirst: vi.fn(), update: vi.fn() },
    adSet: { findFirst: vi.fn(), create: vi.fn() },
    brandProfile: { findUnique: vi.fn() },
    ad: { create: vi.fn() },
  },
}))

vi.mock('@/lib/apiAuth', () => ({ getAuthUser: mockGetAuthUser }))
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/credits', () => ({
  checkAndDeductCredits: mockCheckAndDeduct,
  refundCredits: mockRefund,
  refundCreditsForTransaction: mockRefundForTxn,
}))
vi.mock('@/lib/ai/langHelper', () => ({ getLanguageInstruction: () => 'Respond in English.' }))

import { POST } from '../route'

const makeReq = (body: Record<string, unknown> = {}) => ({
  json: async () => ({ destinationUrl: 'https://nexus-grow.com/paid-offer', ...body }),
}) as any
const params = { params: Promise.resolve({ id: 'adcamp_1' }) }

const campaign = {
  id: 'adcamp_1',
  workspaceId: 'w1',
  name: 'Launch',
  platform: 'META',
  objective: 'LEADS',
  currency: 'USD',
  dailyBudget: 50,
  aiStrategy: null,
  workspace: { id: 'w1', ownerId: 'u1' },
}

function mockProvider(content: string, ok = true, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => ({ choices: [{ message: { content } }] }),
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetAuthUser.mockResolvedValue({ id: 'u1' })
  mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 2, creditsRemaining: 18 })
  mockRefund.mockResolvedValue(undefined)
  mockRefundForTxn.mockResolvedValue(undefined)
  mockPrisma.adCampaign.findFirst.mockResolvedValue(campaign)
  mockPrisma.adCampaign.update.mockResolvedValue(campaign)
  mockPrisma.adSet.findFirst.mockResolvedValue({ id: 'adset_1' })
  mockPrisma.adSet.create.mockResolvedValue({ id: 'adset_1' })
  mockPrisma.brandProfile.findUnique.mockResolvedValue(null)
  mockPrisma.ad.create.mockResolvedValue({ id: 'ad_1' })
  mockProvider(JSON.stringify({ variants: [{ id: 'v1', label: 'Variant', primaryText: 'Copy' }] }))
})

describe('POST /api/ad-campaigns/[id]/generate-copy — RF-3 refund safety', () => {
  it('campaign not found does not deduct credits', async () => {
    mockPrisma.adCampaign.findFirst.mockResolvedValue(null)

    const res = await POST(makeReq(), params)

    expect(res.status).toBe(404)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('invalid conversion destination is rejected before credits are deducted', async () => {
    const res = await POST(makeReq({ destinationUrl: 'http://localhost:3000/lead' }), params)

    expect(res.status).toBe(400)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockPrisma.adCampaign.update).not.toHaveBeenCalled()
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('provider failure after deduction uses transaction-aware refund', async () => {
    mockCheckAndDeduct.mockResolvedValue({
      ok: true,
      creditsUsed: 2,
      creditsRemaining: 18,
      transactionId: 'txn_copy',
    })
    mockProvider('{}', false, 502)

    const res = await POST(makeReq(), params)

    expect(res.status).toBe(500)
    expect(mockRefundForTxn).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      transactionId: 'txn_copy',
    }))
    expect(mockRefund).not.toHaveBeenCalled()
  })

  it('invalid JSON falls back to scalar refund without transactionId', async () => {
    mockProvider('not json')

    const res = await POST(makeReq(), params)

    expect(res.status).toBe(500)
    expect(mockRefund).toHaveBeenCalledWith('u1', 'AD_COPY', 'AI returned invalid JSON')
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('DB persistence failure after deduction uses transaction-aware refund', async () => {
    mockCheckAndDeduct.mockResolvedValue({
      ok: true,
      creditsUsed: 2,
      creditsRemaining: 18,
      transactionId: 'txn_db',
    })
    mockPrisma.ad.create.mockRejectedValue(new Error('db down'))

    const res = await POST(makeReq(), params)

    expect(res.status).toBe(500)
    expect(mockRefundForTxn).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      transactionId: 'txn_db',
    }))
    expect(mockRefund).not.toHaveBeenCalled()
  })

  it('success deducts once and does not refund', async () => {
    const res = await POST(makeReq({ language: 'en' }), params)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockCheckAndDeduct).toHaveBeenCalledWith('u1', 'AD_COPY')
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })
})
