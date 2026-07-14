import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetServerUserId,
  mockCheckAndDeductCredits,
  mockRefundCredits,
  mockIsAiProviderConfigured,
  mockGenerateMarketingStrategy,
  mockGenerateAdConcepts,
} = vi.hoisted(() => ({
  mockGetServerUserId: vi.fn(),
  mockCheckAndDeductCredits: vi.fn(),
  mockRefundCredits: vi.fn(),
  mockIsAiProviderConfigured: vi.fn(),
  mockGenerateMarketingStrategy: vi.fn(),
  mockGenerateAdConcepts: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mockGetServerUserId }))
vi.mock('@/lib/credits', () => ({
  checkAndDeductCredits: mockCheckAndDeductCredits,
  refundCredits: mockRefundCredits,
  refundCreditDeduction: mockRefundCredits,
  buildCreditChargeReceipt: (action: string, deduction: any) => ({ action, cost: 5, ...deduction }),
}))
vi.mock('@/lib/ai/provider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/provider')>()
  return { ...actual, isAiProviderConfigured: mockIsAiProviderConfigured }
})
vi.mock('@/lib/ai/adapter', () => ({
  generateMarketingStrategy: mockGenerateMarketingStrategy,
  generateAdConcepts: mockGenerateAdConcepts,
}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { POST } from '../route'

const makeReq = (body: unknown) => ({ json: async () => body }) as any

beforeEach(() => {
  vi.clearAllMocks()
  mockGetServerUserId.mockResolvedValue('u-preview')
  mockIsAiProviderConfigured.mockReturnValue(true)
})

describe('POST /api/generate/preview provider truth gate', () => {
  it('validates the campaign before deducting credits', async () => {
    const res = await POST(makeReq({ name: '  ' }))

    expect(res.status).toBe(400)
    expect(mockCheckAndDeductCredits).not.toHaveBeenCalled()
  })

  it('returns 503 and spends no credits when OpenAI is not configured', async () => {
    mockIsAiProviderConfigured.mockReturnValue(false)

    const res = await POST(makeReq({ name: 'Launch', language: 'en' }))
    const json = await res.json()

    expect(res.status).toBe(503)
    expect(json.code).toBe('AI_PROVIDER_UNAVAILABLE')
    expect(json.creditsCharged).toBe(false)
    expect(mockCheckAndDeductCredits).not.toHaveBeenCalled()
    expect(mockGenerateMarketingStrategy).not.toHaveBeenCalled()
  })
})
