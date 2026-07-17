import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetAuthUser,
  mockSuggestRateLimitDb,
  mockCheckAndDeduct,
  mockFinalizeDeduction,
  mockRefund,
  mockRefundForTxn,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockSuggestRateLimitDb: vi.fn(),
  mockCheckAndDeduct: vi.fn(),
  mockFinalizeDeduction: vi.fn(),
  mockRefund: vi.fn(),
  mockRefundForTxn: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getAuthUser: mockGetAuthUser }))
vi.mock('@/lib/dbRateLimit', () => ({ suggestRateLimitDb: mockSuggestRateLimitDb }))
vi.mock('@/lib/billableAiRateLimit', () => ({
  enforceBillableAiRateLimit: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/lib/credits', () => ({
  checkAndDeductCredits: mockCheckAndDeduct,
  creditCheckHttpStatus: () => 402,
  finalizeCreditDeduction: mockFinalizeDeduction,
  refundCredits: mockRefund,
  refundCreditsForTransaction: mockRefundForTxn,
  refundCreditDeduction: vi.fn(async ({ userId, action, deduction, reason }) => {
    if (!deduction || deduction.creditsUsed <= 0) return { ok: true, status: 'not-charged' }
    if (deduction.transactionId) {
      await mockRefundForTxn({ userId, transactionId: deduction.transactionId, reason })
      return { ok: true, status: 'refunded' }
    }
    await mockRefund(userId, action, reason)
    return { ok: true, status: 'refunded' }
  }),
  getCreditActionPolicy: () => ({ action: 'AI_FIELD_SUGGESTION', cost: 1, label: 'AI field suggestion' }),
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
  vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
  mockGetAuthUser.mockResolvedValue({ id: 'u1' })
  mockSuggestRateLimitDb.mockResolvedValue({ ok: true })
  mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 1, creditsRemaining: 19 })
  mockRefund.mockResolvedValue(undefined)
  mockRefundForTxn.mockResolvedValue(undefined)
  mockFinalizeDeduction.mockResolvedValue({ ok: true, status: 'settled' })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ choices: [{ message: { content: 'Premium positioning' } }] }),
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('POST /api/brand/suggest — RF-2 refund safety', () => {
  it('missing provider returns 503 before credit deduction', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')

    const res = await POST(makeReq({ field: 'description', brandName: 'Nexus', locale: 'en' }))
    const json = await res.json()

    expect(res.status).toBe(503)
    expect(json).toMatchObject({ code: 'AI_PROVIDER_UNAVAILABLE', creditsCharged: false })
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

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
      creditsUsed: 1,
      creditsRemaining: 19,
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
    expect(mockRefund).toHaveBeenCalledWith('u1', 'AI_FIELD_SUGGESTION', 'NEXUS AI service error')
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('success deducts once and does not refund', async () => {
    const res = await POST(makeReq({ field: 'description', brandName: 'Nexus', locale: 'en' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.suggestion).toBe('Premium positioning')
    expect(mockCheckAndDeduct).toHaveBeenCalledWith(
      'u1',
      'AI_FIELD_SUGGESTION',
      undefined,
      expect.objectContaining({
        entityId: 'u1',
        entityType: 'brand_profile_field_suggestion',
        operationKey: expect.any(String),
      }),
    )
    expect(json.creditCharge).toMatchObject({ action: 'AI_FIELD_SUGGESTION', cost: 1, creditsUsed: 1 })
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })
})
