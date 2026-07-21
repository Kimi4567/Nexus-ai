/**
 * RF-1 — /api/generate refund-safety contract.
 *
 * Guarantees:
 *   - request/body/entity validation happens before credits are deducted
 *   - campaign generation deducts only immediately before the expensive AI work
 *   - provider/persistence failures after deduction refund the user
 *   - successful generation deducts once and does not refund
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockGetServerUserId, mockAiRateLimitDb, mockCheckAndDeduct, mockRefund, mockRefundForTxn,
  mockPrisma, mockGenerateStrategy, mockGenerateConcepts, mockValidateOutput,
  mockLogQualityReport, mockGetMemories, mockFormatMemories, mockSaveMemory,
  mockIsAiProviderConfigured, mockFinalizeCreditDeduction,
} = vi.hoisted(() => ({
  mockGetServerUserId: vi.fn(),
  mockAiRateLimitDb: vi.fn(),
  mockCheckAndDeduct: vi.fn(),
  mockRefund: vi.fn(),
  mockRefundForTxn: vi.fn(),
  mockPrisma: {
    workspace: { findFirst: vi.fn() },
    campaign: { findFirst: vi.fn(), update: vi.fn() },
    project: { findUnique: vi.fn() },
    brandProfile: { findUnique: vi.fn() },
    generation: { create: vi.fn() },
  },
  mockGenerateStrategy: vi.fn(),
  mockGenerateConcepts: vi.fn(),
  mockValidateOutput: vi.fn(),
  mockLogQualityReport: vi.fn(),
  mockGetMemories: vi.fn(),
  mockFormatMemories: vi.fn(),
  mockSaveMemory: vi.fn(),
  mockIsAiProviderConfigured: vi.fn(),
  mockFinalizeCreditDeduction: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mockGetServerUserId }))
vi.mock('@/lib/dbRateLimit', () => ({ aiRateLimitDb: mockAiRateLimitDb }))
vi.mock('@/lib/credits', () => ({
  checkAndDeductCredits: mockCheckAndDeduct,
  refundCredits: mockRefund,
  refundCreditsForTransaction: mockRefundForTxn,
  refundCreditDeduction: async ({ userId, action, deduction, reason }: any) => {
    if (!deduction || deduction.creditsUsed <= 0) return
    if (deduction.transactionId) {
      await mockRefundForTxn({ userId, transactionId: deduction.transactionId, reason })
      return
    }
    await mockRefund(userId, action)
  },
  finalizeCreditDeduction: mockFinalizeCreditDeduction,
  creditCheckHttpStatus: (result: any) => result.error === 'CREDIT_OPERATION_REPLAY' ? 409 : 402,
  buildCreditChargeReceipt: (action: string, deduction: any) => ({
    action,
    cost: 5,
    reason: 'Creates a reviewable campaign package from the approved brief.',
    ...deduction,
  }),
}))
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/ai/adapter', () => ({
  generateMarketingStrategy: mockGenerateStrategy,
  generateAdConcepts: mockGenerateConcepts,
}))
vi.mock('@/lib/ai/provider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/provider')>()
  return { ...actual, isAiProviderConfigured: mockIsAiProviderConfigured }
})
vi.mock('@/lib/ai/outputValidator', () => ({
  validateOutputObject: mockValidateOutput,
  logQualityReport: mockLogQualityReport,
}))
vi.mock('@/lib/campaign-memory', () => ({
  getRelevantMemories: mockGetMemories,
  formatMemoriesForPrompt: mockFormatMemories,
  saveCampaignMemory: mockSaveMemory,
}))
vi.mock('@/lib/campaignStrategyContract', () => ({
  assertCampaignStrategyContract: vi.fn(),
}))

import { POST } from '../route'

const makeReq = (body: unknown = { campaignId: 'c1' }) => ({ json: async () => body }) as any
const makeInvalidJsonReq = () => ({ json: async () => { throw new Error('bad json') } }) as any

beforeEach(() => {
  vi.clearAllMocks()
  mockGetServerUserId.mockResolvedValue('u1')
  mockAiRateLimitDb.mockResolvedValue({ ok: true })
  mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 5, creditsRemaining: 95 })
  mockRefund.mockResolvedValue(undefined)
  mockRefundForTxn.mockResolvedValue(undefined)
  mockPrisma.workspace.findFirst.mockResolvedValue({ id: 'w1', ownerId: 'u1' })
  mockPrisma.campaign.findFirst.mockResolvedValue({
    id: 'c1',
    workspaceId: 'w1',
    projectId: 'p1',
    name: 'Launch',
    goal: 'leads',
    audience: 'SMBs',
    platforms: ['INSTAGRAM'],
  })
  mockPrisma.project.findUnique.mockResolvedValue({ id: 'p1', media: [] })
  mockPrisma.brandProfile.findUnique.mockResolvedValue({
    brandName: 'Noura Dental Studio',
    industry: 'Dental clinic',
    description: 'A local dental clinic offering consultations and treatment planning.',
    primaryOffer: 'Book a dental consultation',
    targetAudience: 'Adults in Abu Dhabi who want clear treatment guidance.',
    audienceLocation: 'Abu Dhabi',
    audiencePainPoints: ['Unclear treatment options'],
    conversionDestination: 'https://example.test/book-consultation',
    topPlatforms: ['INSTAGRAM'],
    verifiedProof: [],
  })
  mockPrisma.campaign.update.mockResolvedValue({})
  mockPrisma.generation.create.mockResolvedValue({})
  mockGenerateStrategy.mockResolvedValue({
    headline: 'Strategy',
    positioning: 'Clear dental consultation guidance for adults in Abu Dhabi.',
    keyMessage: 'Understand your dental treatment options before booking.',
    differentiation: 'A consultation-first dental experience with clear next steps.',
    targetAudienceRefined: 'Adults in Abu Dhabi who want clear treatment guidance.',
    contentPillars: ['Dental education', 'Consultation preparation', 'Treatment options'],
    topHooks: ['Not sure what to ask your dentist?'],
    ctaVariations: ['Book a dental consultation'],
    contentAnglesDetailed: [
      {
        title: 'Questions for your dental consultation',
        hook: 'Bring these questions to your dentist.',
        pain: 'Treatment options can feel unclear.',
        desiredOutcome: 'A more informed consultation.',
        objection: 'I do not know where to begin.',
        platform: 'INSTAGRAM',
        cta: 'Book a dental consultation',
      },
      {
        title: 'How consultation planning works',
        hook: 'Know the steps before your appointment.',
        pain: 'The consultation process can feel unfamiliar.',
        desiredOutcome: 'Clearer expectations before booking.',
        objection: 'I am unsure what happens next.',
        platform: 'INSTAGRAM',
        cta: 'Review the consultation page',
      },
      {
        title: 'Prepare your treatment questions',
        hook: 'Save a practical appointment checklist.',
        pain: 'Important questions are easy to forget.',
        desiredOutcome: 'A prepared conversation with the dentist.',
        objection: 'I do not know what information to bring.',
        platform: 'INSTAGRAM',
        cta: 'Book a dental consultation',
      },
      {
        title: 'Compare treatment options clearly',
        hook: 'Ask how each option fits your needs.',
        pain: 'Different options can be difficult to compare.',
        desiredOutcome: 'A clearer treatment discussion.',
        objection: 'The choices feel overwhelming.',
        platform: 'INSTAGRAM',
        cta: 'Review the consultation page',
      },
    ],
  })
  mockGenerateConcepts.mockResolvedValue([{ hook: 'Concept' }])
  mockValidateOutput.mockReturnValue({ score: 80, issues: [] })
  mockGetMemories.mockResolvedValue([])
  mockFormatMemories.mockReturnValue(undefined)
  mockSaveMemory.mockReturnValue(Promise.resolve())
  mockIsAiProviderConfigured.mockReturnValue(true)
  mockFinalizeCreditDeduction.mockResolvedValue({ ok: true, status: 'settled' })
})

describe('POST /api/generate — RF-1 refund safety', () => {
  it('invalid JSON does not deduct credits', async () => {
    const res = await POST(makeInvalidJsonReq())
    expect(res.status).toBe(400)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockRefund).not.toHaveBeenCalled()
  })

  it('missing campaignId does not deduct credits', async () => {
    const res = await POST(makeReq({}))
    expect(res.status).toBe(400)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
  })

  it('campaign not found or not owned does not deduct credits', async () => {
    mockPrisma.campaign.findFirst.mockResolvedValue(null)
    const res = await POST(makeReq({ campaignId: 'missing' }))
    expect(res.status).toBe(404)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
  })

  it('workspace failure before AI does not deduct credits', async () => {
    mockPrisma.workspace.findFirst.mockResolvedValue(null)
    const res = await POST(makeReq({ campaignId: 'c1' }))
    expect(res.status).toBe(404)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
  })

  it('project failure before AI does not deduct credits', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null)
    const res = await POST(makeReq({ campaignId: 'c1' }))
    expect(res.status).toBe(404)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
  })

  it('provider misconfiguration returns 503 before credit deduction', async () => {
    mockIsAiProviderConfigured.mockReturnValue(false)

    const res = await POST(makeReq({ campaignId: 'c1', language: 'en' }))
    const json = await res.json()

    expect(res.status).toBe(503)
    expect(json.code).toBe('AI_PROVIDER_UNAVAILABLE')
    expect(json.creditsCharged).toBe(false)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockGenerateStrategy).not.toHaveBeenCalled()
  })

  it('AI/provider failure after deduction triggers scalar refund', async () => {
    mockGenerateStrategy.mockRejectedValue(new Error('provider failed'))
    const res = await POST(makeReq({ campaignId: 'c1' }))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.refunded).toBe(true)
    expect(mockCheckAndDeduct).toHaveBeenCalledTimes(1)
    expect(mockCheckAndDeduct).toHaveBeenCalledWith(
      'u1',
      'CAMPAIGN_GENERATION',
      undefined,
      expect.objectContaining({
        entityId: 'c1',
        entityType: 'campaign_generation',
        operationKey: expect.any(String),
      }),
    )
    expect(mockRefund).toHaveBeenCalledWith('u1', 'CAMPAIGN_GENERATION')
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('AI/provider failure uses transaction refund when a transactionId exists', async () => {
    mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 5, creditsRemaining: 95, transactionId: 'txn_1' })
    mockGenerateConcepts.mockRejectedValue(new Error('provider failed'))
    await POST(makeReq({ campaignId: 'c1' }))
    expect(mockRefundForTxn).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', transactionId: 'txn_1' }),
    )
    expect(mockRefund).not.toHaveBeenCalled()
  })

  it('does not refund when credits were not used', async () => {
    mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 0, creditsRemaining: -1, isUnlimited: true })
    mockGenerateStrategy.mockRejectedValue(new Error('provider failed'))
    const res = await POST(makeReq({ campaignId: 'c1' }))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.refunded).toBe(false)
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('success deducts once and does not refund', async () => {
    const res = await POST(makeReq({ campaignId: 'c1', language: 'en' }))
    const json = await res.json()
    expect(res.status, JSON.stringify(json)).toBe(200)
    expect(json.strategy).toEqual(expect.objectContaining({ headline: 'Strategy' }))
    expect(json.creditsRemaining).toBe(95)
    expect(mockCheckAndDeduct).toHaveBeenCalledTimes(1)
    expect(mockFinalizeCreditDeduction).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1', action: 'CAMPAIGN_GENERATION',
    }))
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
    expect(mockPrisma.campaign.update).toHaveBeenCalledTimes(1)
  })

  it('does not refund when credit deduction is denied before AI', async () => {
    mockCheckAndDeduct.mockResolvedValue({ ok: false, error: 'Insufficient credits', requiredCredits: 5 })
    const res = await POST(makeReq({ campaignId: 'c1' }))
    expect(res.status).toBe(402)
    expect(mockGenerateStrategy).not.toHaveBeenCalled()
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })
})
