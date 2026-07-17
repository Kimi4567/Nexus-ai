import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetServerUserId,
  mockAiRateLimitDb,
  mockCheckAndDeduct,
  mockRefundCreditDeduction,
  mockFinalizeCreditDeduction,
} = vi.hoisted(() => ({
  mockGetServerUserId: vi.fn(),
  mockAiRateLimitDb: vi.fn(),
  mockCheckAndDeduct: vi.fn(),
  mockRefundCreditDeduction: vi.fn(),
  mockFinalizeCreditDeduction: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mockGetServerUserId }))
vi.mock('@/lib/dbRateLimit', () => ({ aiRateLimitDb: mockAiRateLimitDb }))
vi.mock('@/lib/credits', () => ({
  checkAndDeductCredits: mockCheckAndDeduct,
  refundCreditDeduction: mockRefundCreditDeduction,
  finalizeCreditDeduction: mockFinalizeCreditDeduction,
  creditCheckHttpStatus: (result: any) => result.error === 'CREDIT_OPERATION_REPLAY' ? 409 : 402,
  buildCreditChargeReceipt: (action: string, deduction: any) => ({ action, cost: 2, ...deduction }),
}))
vi.mock('@/lib/ai/langHelper', () => ({ getLanguageInstruction: () => 'Respond in English.' }))

import { POST } from '../route'

const makeReq = (body: unknown) => ({ json: async () => body }) as any

beforeEach(() => {
  vi.clearAllMocks()
  process.env.OPENAI_API_KEY = 'test-key'
  mockGetServerUserId.mockResolvedValue('u1')
  mockAiRateLimitDb.mockResolvedValue({ ok: true })
  mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 2, creditsRemaining: 18 })
  mockRefundCreditDeduction.mockResolvedValue({ ok: true, status: 'refunded' })
  mockFinalizeCreditDeduction.mockResolvedValue({ ok: true, status: 'settled' })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ choices: [{ message: { content: 'Generated copy' } }] }),
  }))
})

describe('POST /api/ai/generate — RF-2 refund safety', () => {
  it('invalid input does not deduct credits', async () => {
    const res = await POST(makeReq({ nope: true }))

    expect(res.status).toBe(400)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockRefundCreditDeduction).not.toHaveBeenCalled()
  })

  it('provider misconfiguration returns 503 without mock content or credit deduction', async () => {
    delete process.env.OPENAI_API_KEY

    const res = await POST(makeReq({ systemPrompt: 'sys', userPrompt: 'user', language: 'en' }))
    const json = await res.json()

    expect(res.status).toBe(503)
    expect(json.code).toBe('AI_PROVIDER_UNAVAILABLE')
    expect(json.creditsCharged).toBe(false)
    expect(json.content).toBeUndefined()
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('provider failure after deduction uses transaction-aware refund', async () => {
    mockCheckAndDeduct.mockResolvedValue({
      ok: true,
      creditsUsed: 2,
      creditsRemaining: 18,
      transactionId: 'txn_1',
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: 'provider down' }),
    }))

    const res = await POST(makeReq({ systemPrompt: 'sys', userPrompt: 'user' }))

    expect(res.status).toBe(502)
    expect(mockRefundCreditDeduction).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      deduction: expect.objectContaining({ transactionId: 'txn_1' }),
    }))
  })

  it('provider failure falls back to scalar refund when transactionId is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    }))

    const res = await POST(makeReq({ systemPrompt: 'sys', userPrompt: 'user' }))

    expect(res.status).toBe(502)
    expect(mockRefundCreditDeduction).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      action: 'AD_COPY',
      reason: 'NEXUS AI service error',
    }))
  })

  it('success deducts once and does not refund', async () => {
    const res = await POST(makeReq({ systemPrompt: 'sys', userPrompt: 'user' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.content).toBe('Generated copy')
    expect(mockCheckAndDeduct).toHaveBeenCalledWith(
      'u1',
      'AD_COPY',
      undefined,
      expect.objectContaining({
        entityId: 'u1',
        entityType: 'ephemeral_ai_response',
        operationKey: expect.any(String),
      }),
    )
    expect(mockFinalizeCreditDeduction).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1', action: 'AD_COPY',
    }))
    expect(mockRefundCreditDeduction).not.toHaveBeenCalled()
  })
})
