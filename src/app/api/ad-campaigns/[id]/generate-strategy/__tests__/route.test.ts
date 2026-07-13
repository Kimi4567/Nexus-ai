import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
    brandProfile: { findUnique: vi.fn() },
    campaignMemory: { findMany: vi.fn() },
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

const makeReq = (body: unknown = {}) => ({ json: async () => body }) as any
const params = { params: Promise.resolve({ id: 'adcamp_1' }) }

const campaign = {
  id: 'adcamp_1',
  workspaceId: 'w1',
  name: 'Launch',
  platform: 'META',
  objective: 'LEADS',
  currency: 'USD',
  dailyBudget: 50,
  lifetimeBudget: null,
  startDate: new Date('2026-08-01T00:00:00.000Z'),
  endDate: new Date('2026-08-15T00:00:00.000Z'),
  workspace: { id: 'w1', ownerId: 'u1' },
  adAccount: null,
}

function mockProvider(content: string, ok = true, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => ({ choices: [{ message: { content } }] }),
  }))
}

const strategyJson = JSON.stringify({
  positioning: { core_message: 'Clear message' },
  targeting: { locations: ['Dubai'] },
  budget_plan: { daily_budget: 50 },
  creative_brief: { visual_direction: 'Product in context' },
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
  mockGetAuthUser.mockResolvedValue({ id: 'u1' })
  mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 2, creditsRemaining: 18 })
  mockRefund.mockResolvedValue(undefined)
  mockRefundForTxn.mockResolvedValue(undefined)
  mockPrisma.adCampaign.findFirst.mockResolvedValue(campaign)
  mockPrisma.adCampaign.update.mockResolvedValue({})
  mockPrisma.brandProfile.findUnique.mockResolvedValue(null)
  mockPrisma.campaignMemory.findMany.mockResolvedValue([])
  mockProvider(strategyJson)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('POST /api/ad-campaigns/[id]/generate-strategy — RF-3 refund safety', () => {
  it('campaign not found does not deduct credits', async () => {
    mockPrisma.adCampaign.findFirst.mockResolvedValue(null)

    const res = await POST(makeReq(), params)

    expect(res.status).toBe(404)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('provider failure after deduction uses transaction-aware refund', async () => {
    mockCheckAndDeduct.mockResolvedValue({
      ok: true,
      creditsUsed: 2,
      creditsRemaining: 18,
      transactionId: 'txn_strategy',
    })
    mockProvider('{}', false, 502)

    const res = await POST(makeReq(), params)

    expect(res.status).toBe(500)
    expect(mockRefundForTxn).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      transactionId: 'txn_strategy',
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
    mockPrisma.adCampaign.update.mockRejectedValue(new Error('db down'))

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
    expect(json.reachEstimate).toBeNull()
    expect(json.forecastStatus).toBe('unavailable_until_platform_forecast')
    expect(json.strategy.budget_plan.estimated_reach).toBeNull()
    expect(json.strategy.budget_plan.estimated_cpm).toBeNull()
    expect(json.strategy.budget_plan.expected_results).toBeNull()
    expect(mockCheckAndDeduct).toHaveBeenCalledWith('u1', 'AD_COPY')
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })
})
