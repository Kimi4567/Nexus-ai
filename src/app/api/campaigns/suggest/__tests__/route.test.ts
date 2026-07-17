import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetAuthUser,
  mockSuggestRateLimitDb,
  mockCheckAndDeduct,
  mockRefund,
  mockRefundForTxn,
  mockFinalizeCreditDeduction,
  mockPrisma,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockSuggestRateLimitDb: vi.fn(),
  mockCheckAndDeduct: vi.fn(),
  mockRefund: vi.fn(),
  mockRefundForTxn: vi.fn(),
  mockFinalizeCreditDeduction: vi.fn(),
  mockPrisma: {
    workspace: { findFirst: vi.fn() },
    brandProfile: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/apiAuth', () => ({ getAuthUser: mockGetAuthUser }))
vi.mock('@/lib/dbRateLimit', () => ({ suggestRateLimitDb: mockSuggestRateLimitDb }))
vi.mock('@/lib/billableAiRateLimit', () => ({ enforceBillableAiRateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/credits', () => ({
  checkAndDeductCredits: mockCheckAndDeduct,
  refundCredits: mockRefund,
  refundCreditsForTransaction: mockRefundForTxn,
  refundCreditDeduction: vi.fn(async ({ userId, action, deduction, reason }) => {
    if (!deduction || deduction.creditsUsed <= 0) return
    if (deduction.transactionId) {
      await mockRefundForTxn({ userId, transactionId: deduction.transactionId, reason })
      return
    }
    await mockRefund(userId, action, reason)
  }),
  finalizeCreditDeduction: mockFinalizeCreditDeduction,
  creditCheckHttpStatus: (result: any) => result.error === 'CREDIT_OPERATION_REPLAY' ? 409 : 402,
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
  mockFinalizeCreditDeduction.mockResolvedValue({ ok: true, status: 'settled' })
  mockPrisma.workspace.findFirst.mockResolvedValue(null)
  mockPrisma.brandProfile.findUnique.mockResolvedValue(null)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ choices: [{ message: { content: 'Launch sprint' } }] }),
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('POST /api/campaigns/suggest — RF-2 refund safety', () => {
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
      transactionId: 'txn_campaign',
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({}),
    }))

    const res = await POST(makeReq({ field: 'name', goal: 'leads', locale: 'en' }))

    expect(res.status).toBe(502)
    expect(mockRefundForTxn).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      transactionId: 'txn_campaign',
    }))
    expect(mockRefund).not.toHaveBeenCalled()
  })

  it('provider failure falls back to scalar refund without transactionId', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    }))

    const res = await POST(makeReq({ field: 'name', goal: 'leads', locale: 'en' }))

    expect(res.status).toBe(502)
    expect(mockRefund).toHaveBeenCalledWith('u1', 'AI_FIELD_SUGGESTION', 'NEXUS AI service error')
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('success deducts once and does not refund', async () => {
    const res = await POST(makeReq({ field: 'name', goal: 'leads', locale: 'en' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.suggestion).toBe('Launch sprint')
    expect(mockCheckAndDeduct).toHaveBeenCalledWith(
      'u1',
      'AI_FIELD_SUGGESTION',
      undefined,
      expect.objectContaining({
        entityId: 'u1',
        entityType: 'campaign_intake_suggestion',
        operationKey: expect.any(String),
      }),
    )
    expect(json.creditCharge).toMatchObject({ action: 'AI_FIELD_SUGGESTION', cost: 1, creditsUsed: 1 })
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })
})
