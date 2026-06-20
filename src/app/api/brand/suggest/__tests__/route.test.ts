import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetAuthUser,
  mockSuggestRateLimitDb,
  mockCheckAndDeduct,
  mockRefund,
  mockRefundForTxn,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockSuggestRateLimitDb: vi.fn(),
  mockCheckAndDeduct: vi.fn(),
  mockRefund: vi.fn(),
  mockRefundForTxn: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getAuthUser: mockGetAuthUser }))
vi.mock('@/lib/dbRateLimit', () => ({ suggestRateLimitDb: mockSuggestRateLimitDb }))
vi.mock('@/lib/credits', () => ({
  checkAndDeductCredits: mockCheckAndDeduct,
  refundCredits: mockRefund,
  refundCreditsForTransaction: mockRefundForTxn,
}))
vi.mock('@/lib/ai/promptRules', () => ({
  BANNED_PHRASES: '',
  SPECIFICITY_RULES: '',
  UNSUPPORTED_CLAIMS_RULES: '',
  buildBrandContextBlock: () => 'brand context',
}))
vi.mock('@/lib/ai/brandTruthGuard', () => ({
  guardBrandText: (value: string) => value,
  guardBrandList: (value: string[]) => value,
}))

import { POST } from '../route'

const makeReq = (body: unknown) => ({ json: async () => body }) as any

beforeEach(() => {
  vi.clearAllMocks()
  mockGetAuthUser.mockResolvedValue({ id: 'u1' })
  mockSuggestRateLimitDb.mockResolvedValue({ ok: true })
  mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 2, creditsRemaining: 18 })
  mockRefund.mockResolvedValue(undefined)
  mockRefundForTxn.mockResolvedValue(undefined)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ choices: [{ message: { content: 'Premium positioning' } }] }),
  }))
})

describe('POST /api/brand/suggest — RF-2 refund safety', () => {
  it('unknown field does not deduct credits', async () => {
    const res = await POST(makeReq({ field: 'unknownField', locale: 'en' }))

    expect(res.status).toBe(400)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('provider failure after deduction uses transaction-aware refund', async () => {
    mockCheckAndDeduct.mockResolvedValue({
      ok: true,
      creditsUsed: 2,
      creditsRemaining: 18,
      transactionId: 'txn_brand',
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    }))

    const res = await POST(makeReq({ field: 'description', brandName: 'Nexus', locale: 'en' }))

    expect(res.status).toBe(502)
    expect(mockRefundForTxn).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      transactionId: 'txn_brand',
    }))
    expect(mockRefund).not.toHaveBeenCalled()
  })

  it('provider failure falls back to scalar refund without transactionId', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    }))

    const res = await POST(makeReq({ field: 'description', brandName: 'Nexus', locale: 'en' }))

    expect(res.status).toBe(502)
    expect(mockRefund).toHaveBeenCalledWith('u1', 'AD_COPY', 'OpenAI error 500')
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('success deducts once and does not refund', async () => {
    const res = await POST(makeReq({ field: 'description', brandName: 'Nexus', locale: 'en' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.suggestion).toBe('Premium positioning')
    expect(mockCheckAndDeduct).toHaveBeenCalledWith('u1', 'AD_COPY')
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })
})
