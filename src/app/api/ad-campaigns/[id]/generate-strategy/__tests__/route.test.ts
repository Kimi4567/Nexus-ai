import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetAuthUser,
  mockCheckAndDeduct,
  mockFinalizeDeduction,
  mockRefund,
  mockRefundForTxn,
  mockGetCreditActionPolicy,
  mockGetPaidStrategySource,
  mockReviewStrategyGrounding,
  mockPrisma,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockCheckAndDeduct: vi.fn(),
  mockFinalizeDeduction: vi.fn(),
  mockRefund: vi.fn(),
  mockRefundForTxn: vi.fn(),
  mockGetCreditActionPolicy: vi.fn(),
  mockGetPaidStrategySource: vi.fn(),
  mockReviewStrategyGrounding: vi.fn(),
  mockPrisma: {
    adCampaign: { findFirst: vi.fn(), update: vi.fn() },
    brandProfile: { findUnique: vi.fn() },
    campaignMemory: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/apiAuth', () => ({ getAuthUser: mockGetAuthUser }))
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
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
    if (!deduction) return { ok: true, status: 'not-charged' }
    if (deduction.transactionId) {
      await mockRefundForTxn({ userId, transactionId: deduction.transactionId, reason })
    } else {
      await mockRefund(userId, action, reason)
    }
    return { ok: true, status: 'refunded' }
  }),
  getCreditActionPolicy: mockGetCreditActionPolicy,
}))
vi.mock('@/lib/ai/langHelper', () => ({ getLanguageInstruction: () => 'Respond in English.' }))
vi.mock('@/lib/paidStrategySourceServer', () => ({
  getPaidStrategySourceForUser: mockGetPaidStrategySource,
  PaidStrategySourceError: class PaidStrategySourceError extends Error {},
}))
vi.mock('@/lib/ai/marketingQualityGate', () => ({
  reviewStrategyGrounding: mockReviewStrategyGrounding,
}))

import { POST } from '../route'

const makeReq = (body: unknown = {}) => ({ json: async () => body }) as any
const params = { params: Promise.resolve({ id: 'adcamp_1' }) }

const campaign = {
  id: 'adcamp_1',
  organicCampaignId: 'source_1',
  workspaceId: 'w1',
  name: 'Launch',
  status: 'DRAFT',
  platformCampaignId: null,
  platform: 'META',
  objective: 'LEAD_GENERATION',
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

const paidBrandProfile = {
  brandName: 'NEXUS',
  industry: 'Marketing software',
  description: 'Marketing execution platform',
  primaryOffer: 'AI marketing workspace',
  targetAudience: 'Small business owners',
  audiencePainPoints: ['Inconsistent campaign planning', 'Limited marketing capacity'],
  businessGoal: 'Qualified leads',
  topPlatforms: ['GOOGLE'],
  writingStyle: 'Clear',
  marketingBudget: 'AED 1000 monthly',
  conversionDestination: 'https://nexus-grow.com/paid-offer',
  leadHandling: 'Sales callback',
  audienceLocation: 'Dubai',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
  mockGetAuthUser.mockResolvedValue({ id: 'u1' })
  mockGetPaidStrategySource.mockResolvedValue({
    campaign: { id: 'source_1', name: 'Approved paid strategy' },
    truth: { scope: 'paid', executionObjective: 'LEAD_GENERATION', updatedAt: '2026-07-14T00:00:00.000Z' },
    executionContext: '{"positioning":"Clear message"}',
  })
  mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 4, creditsRemaining: 16 })
  mockGetCreditActionPolicy.mockReturnValue({
    action: 'PAID_EXECUTION_PLAN',
    cost: 4,
    label: 'Paid execution plan',
    reason: 'Translate the approved strategy into a review-ready paid plan.',
  })
  mockReviewStrategyGrounding.mockReturnValue({
    schemaVersion: 1,
    status: 'passed',
    score: 100,
    blockers: [],
    warnings: [],
    checkedAt: '2026-07-14T00:00:00.000Z',
  })
  mockRefund.mockResolvedValue(undefined)
  mockRefundForTxn.mockResolvedValue(undefined)
  mockFinalizeDeduction.mockResolvedValue({ ok: true, status: 'settled' })
  mockPrisma.adCampaign.findFirst.mockResolvedValue(campaign)
  mockPrisma.adCampaign.update.mockResolvedValue({})
  mockPrisma.brandProfile.findUnique.mockResolvedValue(paidBrandProfile)
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

  it('incomplete Brand Brain blocks generation before credits', async () => {
    mockPrisma.brandProfile.findUnique.mockResolvedValue(null)

    const res = await POST(makeReq(), params)
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.code).toBe('PAID_BRAND_BRIEF_INCOMPLETE')
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
  })

  it('provider failure after deduction uses transaction-aware refund', async () => {
    mockCheckAndDeduct.mockResolvedValue({
      ok: true,
      creditsUsed: 4,
      creditsRemaining: 16,
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
    expect(mockRefund).toHaveBeenCalledWith('u1', 'PAID_EXECUTION_PLAN', 'AI returned invalid JSON')
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('DB persistence failure after deduction uses transaction-aware refund', async () => {
    mockCheckAndDeduct.mockResolvedValue({
      ok: true,
      creditsUsed: 4,
      creditsRemaining: 16,
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
    expect(mockCheckAndDeduct).toHaveBeenCalledWith(
      'u1',
      'PAID_EXECUTION_PLAN',
      undefined,
      expect.objectContaining({
        entityId: 'adcamp_1',
        entityType: 'paid_campaign_execution_plan',
        operationKey: expect.any(String),
      }),
    )
    expect(json.creditCharge).toMatchObject({
      action: 'PAID_EXECUTION_PLAN',
      cost: 4,
      creditsUsed: 4,
    })
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('refunds a grounded-but-invalid paid plan before persistence', async () => {
    mockCheckAndDeduct.mockResolvedValue({
      ok: true,
      creditsUsed: 4,
      creditsRemaining: 16,
      transactionId: 'txn_quality',
    })
    mockReviewStrategyGrounding.mockReturnValue({
      schemaVersion: 1,
      status: 'blocked',
      score: 70,
      blockers: [{
        code: 'ungrounded_audience_expansion',
        severity: 'blocker',
        path: 'strategy.audience',
        message: 'Unsupported audience.',
      }],
      warnings: [],
      checkedAt: '2026-07-14T00:00:00.000Z',
    })

    const res = await POST(makeReq(), params)
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.code).toBe('MARKETING_QUALITY_GATE_BLOCKED')
    expect(mockRefundForTxn).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      transactionId: 'txn_quality',
    }))
    expect(mockPrisma.adCampaign.update).not.toHaveBeenCalled()
  })
})
