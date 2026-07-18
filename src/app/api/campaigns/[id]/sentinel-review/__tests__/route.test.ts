import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetServerUserId,
  mockCheckAndDeduct,
  mockRefund,
  mockRunSentinelReview,
  mockPrisma,
  mockFinalizeCreditDeduction,
  mockValidateStrategyContract,
} = vi.hoisted(() => ({
  mockGetServerUserId: vi.fn(),
  mockCheckAndDeduct: vi.fn(),
  mockRefund: vi.fn(),
  mockRunSentinelReview: vi.fn(),
  mockFinalizeCreditDeduction: vi.fn(),
  mockValidateStrategyContract: vi.fn(),
  mockPrisma: {
    campaign: { findFirst: vi.fn(), update: vi.fn() },
    campaignActivity: { create: vi.fn() },
  },
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mockGetServerUserId }))
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/billableAiRateLimit', () => ({ enforceBillableAiRateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/credits', () => ({
  checkAndDeductCredits: mockCheckAndDeduct,
  creditCheckHttpStatus: (result: any) => result.error === 'CREDIT_OPERATION_REPLAY' ? 409 : 402,
  finalizeCreditDeduction: mockFinalizeCreditDeduction,
  refundCreditDeduction: vi.fn(async ({ deduction }) => {
    if (deduction?.creditsUsed > 0) await mockRefund()
  }),
  getCreditActionPolicy: () => ({
    action: 'SENTINEL_REVIEW',
    cost: 2,
    label: 'Sentinel quality review',
    reason: 'Reviews strategy quality and risk.',
  }),
}))
vi.mock('@/lib/agents/sentinel-reviewer', () => ({
  runSentinelReview: mockRunSentinelReview,
}))
vi.mock('@/lib/ai/strategyKpiGuard', () => ({ guardStrategyKpis: (value: unknown) => value }))
vi.mock('@/lib/ai/strategyProofGuard', () => ({ guardStrategyProof: (value: unknown) => value }))
vi.mock('@/lib/ai/strategyOutputContractGuard', () => ({ guardStrategyOutputContract: (value: unknown) => value }))
vi.mock('@/lib/strategy/strategyScope', () => ({ resolveStrategyScope: () => ({ type: 'organic' }) }))
vi.mock('@/lib/campaignStrategyContract', () => ({
  validateCampaignStrategyContract: mockValidateStrategyContract,
}))
vi.mock('@/lib/ai/marketingQualityGate', () => ({
  reviewStrategyGrounding: () => ({ status: 'passed', issues: [], reviewedPlatforms: ['META'] }),
}))

import { POST } from '../route'

const params = { params: Promise.resolve({ id: 'campaign_1' }) }
const makeReq = (body: unknown = {}) => ({ json: async () => body }) as any

const campaign = {
  id: 'campaign_1',
  workspaceId: 'workspace_1',
  name: 'Launch',
  goal: 'leads',
  audience: 'Founders',
  tone: 'clear',
  platforms: ['META'],
  aiOutput: { strategy: { keyMessage: 'A clear offer' }, language: 'en' },
  workspace: { brandProfile: { brandName: 'Nexus', industry: 'SaaS', verifiedProof: [] } },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
  mockGetServerUserId.mockResolvedValue('user_1')
  mockPrisma.campaign.findFirst.mockResolvedValue(campaign)
  mockPrisma.campaign.update.mockResolvedValue({})
  mockPrisma.campaignActivity.create.mockResolvedValue({})
  mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 2, creditsRemaining: 18 })
  mockRefund.mockResolvedValue(undefined)
  mockFinalizeCreditDeduction.mockResolvedValue({ ok: true, status: 'settled' })
  mockRunSentinelReview.mockResolvedValue({
    status: 'passed',
    riskScore: 5,
    brandConsistencyScore: 92,
    recommendedFixes: [],
  })
  mockValidateStrategyContract.mockReturnValue({
    valid: true,
    score: 100,
    legacySchemaDetected: false,
    missingFields: [],
    weakFields: [],
    languageViolations: [],
    countViolations: [],
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /api/campaigns/[id]/sentinel-review — provider and credit ordering', () => {
  it('checks campaign ownership before charging', async () => {
    mockPrisma.campaign.findFirst.mockResolvedValue(null)

    const res = await POST(makeReq({ language: 'en' }), params)

    expect(res.status).toBe(404)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockRunSentinelReview).not.toHaveBeenCalled()
  })

  it('returns 503 before charging when the provider is missing', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')

    const res = await POST(makeReq({ language: 'en' }), params)
    const json = await res.json()

    expect(res.status).toBe(503)
    expect(json).toMatchObject({ code: 'AI_PROVIDER_UNAVAILABLE', creditsCharged: false })
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockRunSentinelReview).not.toHaveBeenCalled()
  })

  it('charges only immediately before the real review and keeps the saved strategy language', async () => {
    const res = await POST(makeReq({ language: 'ar' }), params)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.creditsRemaining).toBe(18)
    expect(json.creditCharge).toMatchObject({ action: 'SENTINEL_REVIEW', cost: 2, creditsUsed: 2 })
    expect(mockCheckAndDeduct).toHaveBeenCalledWith(
      'user_1',
      'SENTINEL_REVIEW',
      undefined,
      expect.objectContaining({
        entityId: 'campaign_1',
        entityType: 'campaign_sentinel_review',
        operationKey: expect.any(String),
      }),
    )
    expect(mockRunSentinelReview).toHaveBeenCalledTimes(1)
    expect(mockRunSentinelReview).toHaveBeenCalledWith(expect.objectContaining({
      language: 'en',
      strategyReviewSource: campaign.aiOutput.strategy,
    }))
    expect(mockPrisma.campaign.update).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        aiOutput: expect.objectContaining({
          strategy: campaign.aiOutput.strategy,
          sentinelReview: expect.objectContaining({ status: 'passed' }),
        }),
      },
    }))
    expect(mockRefund).not.toHaveBeenCalled()
  })

  it('does not charge when the user requests an automatic correction but nothing changes', async () => {
    const res = await POST(makeReq({ language: 'en', applySafeCorrections: true }), params)
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json).toMatchObject({ code: 'NO_SAFE_CORRECTION_AVAILABLE', creditsUsed: 0 })
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockRunSentinelReview).not.toHaveBeenCalled()
  })

  it('blocks a strategy that no longer matches its saved promise before charging', async () => {
    mockValidateStrategyContract.mockReturnValueOnce({
      valid: false,
      score: 62,
      legacySchemaDetected: false,
      missingFields: ['paidPlanning'],
      weakFields: [],
      languageViolations: [],
      countViolations: ['paidPlanning.adCopyVariations.count:0/9'],
    })

    const res = await POST(makeReq({ language: 'en' }), params)
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json).toMatchObject({ code: 'STRATEGY_CONTRACT_BLOCKED', creditsUsed: 0 })
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockRunSentinelReview).not.toHaveBeenCalled()
  })
})
