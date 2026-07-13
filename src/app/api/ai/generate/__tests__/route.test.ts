import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetServerUserId,
  mockAiRateLimitDb,
  mockCheckAndDeduct,
  mockRefund,
  mockRefundForTxn,
} = vi.hoisted(() => ({
  mockGetServerUserId: vi.fn(),
  mockAiRateLimitDb: vi.fn(),
  mockCheckAndDeduct: vi.fn(),
  mockRefund: vi.fn(),
  mockRefundForTxn: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mockGetServerUserId }))
vi.mock('@/lib/dbRateLimit', () => ({ aiRateLimitDb: mockAiRateLimitDb }))
vi.mock('@/lib/credits', () => ({
  checkAndDeductCredits: mockCheckAndDeduct,
  refundCredits: mockRefund,
  refundCreditsForTransaction: mockRefundForTxn,
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
  mockRefund.mockResolvedValue(undefined)
  mockRefundForTxn.mockResolvedValue(undefined)
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
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
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
    expect(mockRefundForTxn).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      transactionId: 'txn_1',
    }))
    expect(mockRefund).not.toHaveBeenCalled()
  })

  it('provider failure falls back to scalar refund when transactionId is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    }))

    const res = await POST(makeReq({ systemPrompt: 'sys', userPrompt: 'user' }))

    expect(res.status).toBe(502)
    expect(mockRefund).toHaveBeenCalledWith('u1', 'AD_COPY', 'OpenAI error 500')
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('success deducts once and does not refund', async () => {
    const res = await POST(makeReq({ systemPrompt: 'sys', userPrompt: 'user' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.content).toBe('Generated copy')
    expect(mockCheckAndDeduct).toHaveBeenCalledWith('u1', 'AD_COPY')
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })
})
