/**
 * PR-S1c-2 — run-full route variable-charge contract.
 *
 * Guarantees:
 *   - unsupported custom > 180 days → 422 BEFORE any deduction (no charge)
 *   - supported orders deduct the SERVER-recomputed variable cost
 *   - any client-supplied price in the body is ignored (server recomputes)
 *   - refund-on-failure refunds the EXACT deducted amount (credit.creditsUsed)
 *
 * resolveStrategyCharge is intentionally NOT mocked — the real pure pricing runs,
 * so these tests prove the server truly recomputes the cost. Everything with I/O
 * (auth, prisma, orchestrator, rate limit, readiness, memory) is mocked.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

const {
  mockGetAuthUser, mockAiRateLimitDb, mockCheckAndDeduct, mockRefundForTxn, mockIsWalletEnabled,
  mockFinalizeDeduction, mockRefundDeduction,
  mockRunFullAgency, mockReadiness, mockGetMemories, mockFormatMemories,
  mockPrisma, mockReadCampaignAllowance,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockAiRateLimitDb: vi.fn(),
  mockCheckAndDeduct: vi.fn(),
  mockFinalizeDeduction: vi.fn(),
  mockRefundDeduction: vi.fn(),
  mockRefundForTxn: vi.fn(),
  mockIsWalletEnabled: vi.fn(),
  mockRunFullAgency: vi.fn(),
  mockReadiness: vi.fn(),
  mockGetMemories: vi.fn(),
  mockFormatMemories: vi.fn(),
  mockReadCampaignAllowance: vi.fn(),
  mockPrisma: {
    $transaction: vi.fn(),
    workspace: { findFirst: vi.fn() },
    brandProfile: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
    subscription: { findUnique: vi.fn() },
    creditTransaction: { create: vi.fn() },
    media: { findMany: vi.fn() },
    campaign: { findFirst: vi.fn() },
  },
}))

vi.mock('@/lib/apiAuth', () => ({ getAuthUser: mockGetAuthUser }))
vi.mock('@/lib/dbRateLimit', () => ({ aiRateLimitDb: mockAiRateLimitDb }))
vi.mock('@/lib/billableAiRateLimit', () => ({
  enforceBillableAiRateLimit: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/lib/credits', () => ({
  checkAndDeductCredits: mockCheckAndDeduct,
  creditCheckHttpStatus: () => 402,
  finalizeCreditDeduction: mockFinalizeDeduction,
  refundCreditDeduction: mockRefundDeduction,
  buildCreditChargeReceipt: (action: string, deduction: any) => ({ action, ...deduction }),
  FREE_STARTER_CREDITS: 15,
  getCreditActionPolicy: (action: string) => ({
    action,
    cost: 12,
    label: 'Full marketing strategy',
    reason: 'Creates the strategy, operating plan, and measurable execution brief.',
  }),
  refundCreditsForTransaction: mockRefundForTxn,
}))
vi.mock('@/lib/credits/wallet', () => ({ isCreditWalletEnabled: mockIsWalletEnabled }))
vi.mock('@/lib/agents/orchestrator', () => ({ runFullAgency: mockRunFullAgency }))
vi.mock('@/lib/brandReadiness', () => ({ getBrandBrainReadiness: mockReadiness }))
vi.mock('@/lib/campaign-memory', () => ({
  getRelevantMemories: mockGetMemories,
  formatMemoriesForPrompt: mockFormatMemories,
  saveCampaignMemory: vi.fn(),
}))
vi.mock('@/lib/ai/strategyKpiGuard', () => ({
  normalizeStrategyIntent: () => ({ strategyType: 'organic', strategyDuration: '90' }),
}))
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/campaignCommercial', () => ({ readLockedCampaignAllowance: mockReadCampaignAllowance }))
// NOTE: resolveStrategyCharge is NOT mocked — real pricing runs.

import { POST } from '../route'

const makeReq = (body: Record<string, unknown> = {}) => ({ json: async () => body }) as any

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
  mockGetAuthUser.mockResolvedValue({ id: 'u1' })
  mockAiRateLimitDb.mockResolvedValue({ ok: true })
  mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 14, creditsRemaining: 86, isUnlimited: false })
  mockIsWalletEnabled.mockReturnValue(false) // flag OFF by default (production state)
  mockRefundForTxn.mockResolvedValue(undefined)
  mockFinalizeDeduction.mockResolvedValue({ ok: true, status: 'settled' })
  mockRefundDeduction.mockResolvedValue({ ok: true, status: 'refunded' })
  mockReadiness.mockReturnValue({ ready: true, missingRequired: [], score: 80 })
  mockGetMemories.mockResolvedValue([])
  mockFormatMemories.mockReturnValue(undefined)
  mockReadCampaignAllowance.mockResolvedValue({
    limit: 10,
    current: 0,
    periodStart: new Date('2026-07-01T00:00:00.000Z'),
    periodEnd: new Date('2026-08-01T00:00:00.000Z'),
    plan: 'ACTIVE',
  })
  mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => unknown) => callback(mockPrisma))
  mockPrisma.workspace.findFirst.mockResolvedValue({ id: 'w1', ownerId: 'u1' })
  mockPrisma.brandProfile.findUnique.mockResolvedValue({
    brandName: 'B',
    industry: 'Tech',
    description: 'AI marketing operating system for small businesses.',
    primaryOffer: 'Strategy and content planning workspace.',
    targetAudience: 'A',
    audiencePainPoints: ['Inconsistent campaign planning', 'Unclear content priorities'],
    businessGoal: 'leads',
    writingStyle: 'clear and practical',
    topPlatforms: ['INSTAGRAM', 'TIKTOK', 'FACEBOOK'],
    marketingBudget: '$1,000/month planning budget',
    conversionDestination: 'Website lead form',
    leadHandling: 'Sales team follows up within one business day',
    audienceLocation: 'United States',
    verifiedProof: ['User-provided proof: internal pilot users reviewed strategy drafts.'],
  })
  mockPrisma.user.findUnique.mockResolvedValue({
    preferences: {},
    subscriptionStatus: 'ACTIVE',
    aiCredits: 100,
    monthlyGenerations: 1,
  })
  mockPrisma.subscription.findUnique.mockResolvedValue({ plan: 'PRO', status: 'ACTIVE' })
  mockPrisma.user.update.mockResolvedValue({})
  mockPrisma.creditTransaction.create.mockResolvedValue({})
  mockPrisma.media.findMany.mockResolvedValue([])
  mockPrisma.campaign.findFirst.mockResolvedValue({
    id: 'camp1',
    name: 'New Strategy',
    aiOutput: {
      strategy: {
        providerUsage: {
          model: 'gpt-4o',
          calls: 2,
          inputTokens: 12000,
          cachedInputTokens: 0,
          outputTokens: 6000,
          estimatedProviderCostUsd: 0.09,
          pricingVersion: 'openai-standard-2026-07-20',
        },
      },
    },
  })
  mockRunFullAgency.mockImplementation(async (_workspaceId: string, _brief: Record<string, unknown>, options?: { beforePersistStrategy?: () => Promise<void> }) => {
    await options?.beforePersistStrategy?.()
    return { strategyCreated: true, agentRunId: 'run1', suggestions: 3, errors: [] }
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /api/strategy/run-full — variable charge', () => {
  it('missing provider returns 503 before orchestration or credit deduction', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')

    const res = await POST(makeReq({
      language: 'en', strategyType: 'organic', strategyDuration: '90', contentIntensity: 'standard',
    }))
    const json = await res.json()

    expect(res.status).toBe(503)
    expect(json).toMatchObject({ code: 'AI_PROVIDER_UNAVAILABLE', creditsCharged: false })
    expect(mockRunFullAgency).not.toHaveBeenCalled()
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
  })

  it('6. blocks unsupported custom > 180 days with 422 BEFORE any deduction', async () => {
    const res = await POST(makeReq({
      strategyType: 'organic', strategyDuration: 'custom', customDurationDays: 365, contentIntensity: 'standard',
    }))
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.error).toBe('UNSUPPORTED_DURATION')
    expect(json.supported).toBe(false)
    // No credit was ever touched.
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
  })

  it('7. deducts the server-recomputed variable cost (Organic Standard 90 = 24)', async () => {
    const res = await POST(makeReq({
      strategyType: 'organic', strategyDuration: '90', contentIntensity: 'standard',
    }))
    expect(res.status).toBe(200)
    expect(mockCheckAndDeduct).toHaveBeenCalledWith('u1', 'RUN_FULL_STRATEGY', 24, expect.objectContaining({
      entityId: 'w1', entityType: 'workspace_strategy_run', operationKey: expect.any(String),
    }))
  })

  it('deducts a different recomputed cost for a richer order (Full Daily 180 = 96)', async () => {
    await POST(makeReq({
      strategyType: 'full', strategyDuration: '180', contentIntensity: 'daily',
    }))
    expect(mockCheckAndDeduct).toHaveBeenCalledWith('u1', 'RUN_FULL_STRATEGY', 96, expect.objectContaining({
      entityId: 'w1', entityType: 'workspace_strategy_run', operationKey: expect.any(String),
    }))
  })

  it('8. ignores any client-supplied price and recomputes server-side', async () => {
    await POST(makeReq({
      strategyType: 'organic', strategyDuration: '30', contentIntensity: 'daily',
      // adversarial client values that must be ignored:
      cost: 1, price: 0, credits: 999,
    }))
    // Organic Daily 30 = 28, recomputed — not the client's 1/0/999.
    expect(mockCheckAndDeduct).toHaveBeenCalledWith('u1', 'RUN_FULL_STRATEGY', 28, expect.objectContaining({
      entityId: 'w1', entityType: 'workspace_strategy_run', operationKey: expect.any(String),
    }))
  })

  it('uses server-recomputed pricing for exact custom organic post count', async () => {
    await POST(makeReq({
      strategyType: 'organic',
      strategyDuration: '30',
      contentIntensity: 'daily',
      customOrganicPostCount: 7,
      price: 1,
    }))
    expect(mockCheckAndDeduct).toHaveBeenCalledWith('u1', 'RUN_FULL_STRATEGY', 12, expect.objectContaining({
      entityId: 'w1', entityType: 'workspace_strategy_run', operationKey: expect.any(String),
    }))
  })

  it('records the effective plan-capped count in the credit ledger description', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      preferences: {},
      subscriptionStatus: 'FREE',
      aiCredits: 100,
      monthlyGenerations: 1,
    })
    mockPrisma.subscription.findUnique.mockResolvedValue(null)

    await POST(makeReq({
      strategyType: 'organic',
      strategyDuration: '30',
      contentIntensity: 'light',
      customOrganicPostCount: 9,
    }))

    expect(mockCheckAndDeduct).toHaveBeenCalledWith('u1', 'RUN_FULL_STRATEGY', 12, expect.objectContaining({
      description: expect.stringContaining('plan-capped output 3 of 9 requested'),
    }))
  })

  it('9. insufficient credits → 402 during preflight before orchestration or deduction', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      preferences: {},
      subscriptionStatus: 'ACTIVE',
      aiCredits: 7,
      monthlyGenerations: 1,
    })
    const res = await POST(makeReq({
      strategyType: 'full', strategyDuration: '90', contentIntensity: 'standard', // = 46
    }))
    expect(res.status).toBe(402)
    const json = await res.json()
    expect(json.error).toBe('INSUFFICIENT_CREDITS')
    expect(json.requiredCredits).toBe(46)
    expect(json.currentCredits).toBe(7)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockRunFullAgency).not.toHaveBeenCalled()
  })

  it('blocks the campaign limit before AI generation, charging, or persistence', async () => {
    mockReadCampaignAllowance.mockResolvedValue({
      limit: 1,
      current: 1,
      periodStart: new Date('2026-07-01T00:00:00.000Z'),
      periodEnd: new Date('2026-08-01T00:00:00.000Z'),
      plan: 'FREE',
    })

    const res = await POST(makeReq({
      language: 'bilingual',
      uiLocale: 'ar',
      strategyType: 'organic',
      strategyDuration: '30',
      contentIntensity: 'light',
    }))
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBe('CAMPAIGN_LIMIT_REACHED')
    expect(json.message).toMatch(/لم يبدأ التوليد ولم يُخصم أي كريديت/)
    expect(json.upgradeUrl).toBe('/billing')
    expect(mockRunFullAgency).not.toHaveBeenCalled()
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
  })

  it('13. refund-on-failure refunds the EXACT deducted amount (credit.creditsUsed)', async () => {
    mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 18, creditsRemaining: 50, isUnlimited: false })
    mockRunFullAgency.mockImplementation(async (_workspaceId: string, _brief: Record<string, unknown>, options?: { beforePersistStrategy?: () => Promise<void> }) => {
      await options?.beforePersistStrategy?.()
      return { strategyCreated: false, agentRunId: 'run1', suggestions: 0, errors: ['failed'] }
    })
    mockPrisma.campaign.findFirst.mockResolvedValue(null)

    const res = await POST(makeReq({
      strategyType: 'organic', strategyDuration: 'custom', customDurationDays: 160, contentIntensity: 'standard', // = 18
    }))
    const json = await res.json()
    expect(res.status).toBe(502)
    expect(json.ok).toBe(false)
    // The lifecycle service receives the exact variable deduction, not the
    // fixed catalogue cost, and restores its original wallet sources atomically.
    expect(mockRefundDeduction).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      action: 'RUN_FULL_STRATEGY',
      deduction: expect.objectContaining({ creditsUsed: 18 }),
      reason: 'Run Full Strategy failed',
    }))
  })

  it('refunds the exact deducted amount when orchestration throws after credit deduction', async () => {
    mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 10, creditsRemaining: 345, isUnlimited: false })
    mockRunFullAgency.mockImplementation(async (_workspaceId: string, _brief: Record<string, unknown>, options?: { beforePersistStrategy?: () => Promise<void> }) => {
      await options?.beforePersistStrategy?.()
      throw new Error('provider timeout')
    })

    const res = await POST(makeReq({
      language: 'ar',
      strategyType: 'organic',
      strategyDuration: '30',
      contentIntensity: 'standard',
    }))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(mockRefundDeduction).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      action: 'RUN_FULL_STRATEGY',
      deduction: expect.objectContaining({ creditsUsed: 10 }),
      reason: 'Run Full Strategy exception',
    }))
    expect(json.ok).toBe(false)
    expect(json.refunded).toBe(true)
    expect(json.creditsRemaining).toBe(355)
    expect(json.creditsUsed).toBe(0)
    expect(json.error).toMatch(/تعذر إكمال توليد الاستراتيجية/)
    expect(json.error).not.toMatch(/provider timeout/)
  })

  it('does not deduct or refund when orchestration fails before the persistence credit gate', async () => {
    mockRunFullAgency.mockRejectedValue(new Error('provider timeout before persist'))

    const res = await POST(makeReq({
      language: 'ar',
      strategyType: 'organic',
      strategyDuration: '30',
      contentIntensity: 'standard',
    }))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
    expect(mockPrisma.creditTransaction.create).not.toHaveBeenCalled()
    expect(json.refunded).toBe(false)
    expect(json.creditsUsed).toBe(0)
    expect(json.error).toMatch(/تعذر إكمال توليد الاستراتيجية/)
    expect(json.error).not.toMatch(/provider timeout/)
  })

  it('returns 402 without saving a campaign if credits become insufficient at the late persistence gate', async () => {
    mockCheckAndDeduct.mockResolvedValue({
      ok: false,
      error: 'INSUFFICIENT_CREDITS',
      message: 'Monthly credits exhausted. Upgrade your plan or wait for the next billing cycle.',
      requiredCredits: 16,
      currentCredits: 3,
      upgradeUrl: '/billing',
    })
    mockRunFullAgency.mockImplementation(async (_workspaceId: string, _brief: Record<string, unknown>, options?: { beforePersistStrategy?: () => Promise<void> }) => {
      try {
        await options?.beforePersistStrategy?.()
      } catch (err) {
        return {
          strategyCreated: false,
          agentRunId: 'run1',
          suggestions: 0,
          errors: [err instanceof Error ? err.message : 'late credit failure'],
        }
      }
      return { strategyCreated: true, agentRunId: 'run1', suggestions: 3, errors: [] }
    })

    const res = await POST(makeReq({
      strategyType: 'organic',
      strategyDuration: '30',
      contentIntensity: 'standard',
    }))
    const json = await res.json()

    expect(res.status).toBe(402)
    expect(json.error).toBe('INSUFFICIENT_CREDITS')
    expect(json.currentCredits).toBe(3)
    expect(mockCheckAndDeduct).toHaveBeenCalledWith('u1', 'RUN_FULL_STRATEGY', 16, expect.objectContaining({
      entityId: 'w1', entityType: 'workspace_strategy_run', operationKey: expect.any(String),
    }))
    expect(mockPrisma.campaign.findFirst).not.toHaveBeenCalled()
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
    expect(mockPrisma.creditTransaction.create).not.toHaveBeenCalled()
  })

  it('returns a user-safe message instead of internal Strategy OS contract details', async () => {
    mockRunFullAgency.mockResolvedValue({
      strategyCreated: false,
      agentRunId: 'run1',
      suggestions: 0,
      errors: ['Campaign engine strategy failed Strategy OS contract (language: strategy.campaignName, strategy.topHooks[0])'],
    })
    mockPrisma.campaign.findFirst.mockResolvedValue(null)

    const res = await POST(makeReq({
      language: 'ar',
      strategyType: 'organic',
      strategyDuration: '30',
      contentIntensity: 'standard',
    }))
    const json = await res.json()

    expect(res.status).toBe(502)
    expect(json.ok).toBe(false)
    expect(json.refunded).toBe(false)
    expect(json.creditsUsed).toBe(0)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
    expect(mockPrisma.creditTransaction.create).not.toHaveBeenCalled()
    expect(json.error).toMatch(/أوقف NEXUS حفظ هذه الاستراتيجية/)
    expect(json.error).toMatch(/لم يتم حفظ حملة جديدة/)
    expect(json.error).not.toMatch(/Strategy OS contract|strategy\.campaignName|topHooks/)
    expect(json.errors[0]).toBe(json.error)
  })

  it('releases an unlimited-plan reservation even when its wallet debit is 0', async () => {
    mockCheckAndDeduct.mockResolvedValue({
      ok: true,
      creditsUsed: 0,
      creditsRemaining: -1,
      isUnlimited: true,
      transactionId: 'txn_unlimited',
    })
    mockRunFullAgency.mockImplementation(async (_workspaceId: string, _brief: Record<string, unknown>, options?: { beforePersistStrategy?: () => Promise<void> }) => {
      await options?.beforePersistStrategy?.()
      return { strategyCreated: false, agentRunId: 'run1', suggestions: 0, errors: ['failed'] }
    })
    mockPrisma.campaign.findFirst.mockResolvedValue(null)

    await POST(makeReq({ strategyType: 'organic', strategyDuration: '90', contentIntensity: 'standard' }))
    expect(mockRefundDeduction).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      action: 'RUN_FULL_STRATEGY',
      deduction: expect.objectContaining({ transactionId: 'txn_unlimited', creditsUsed: 0 }),
    }))
  })

  // The route delegates every refund to the unified lifecycle service. Legacy
  // wallet flags no longer select separate mutation paths in billable routes.
  it('uses the same exact lifecycle refund when the legacy wallet flag is OFF', async () => {
    mockIsWalletEnabled.mockReturnValue(false)
    mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 18, creditsRemaining: 50, isUnlimited: false, transactionId: 'txn_should_be_ignored' })
    mockRunFullAgency.mockImplementation(async (_workspaceId: string, _brief: Record<string, unknown>, options?: { beforePersistStrategy?: () => Promise<void> }) => {
      await options?.beforePersistStrategy?.()
      return { strategyCreated: false, agentRunId: 'run1', suggestions: 0, errors: ['failed'] }
    })
    mockPrisma.campaign.findFirst.mockResolvedValue(null)

    await POST(makeReq({ strategyType: 'organic', strategyDuration: 'custom', customDurationDays: 160, contentIntensity: 'standard' }))

    expect(mockRefundDeduction).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      action: 'RUN_FULL_STRATEGY',
      deduction: expect.objectContaining({ transactionId: 'txn_should_be_ignored', creditsUsed: 18 }),
    }))
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('uses the same exact lifecycle refund when the legacy wallet flag is ON', async () => {
    mockIsWalletEnabled.mockReturnValue(true)
    mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 18, creditsRemaining: 50, isUnlimited: false, transactionId: 'txn_99' })
    mockRunFullAgency.mockImplementation(async (_workspaceId: string, _brief: Record<string, unknown>, options?: { beforePersistStrategy?: () => Promise<void> }) => {
      await options?.beforePersistStrategy?.()
      return { strategyCreated: false, agentRunId: 'run1', suggestions: 0, errors: ['failed'] }
    })
    mockPrisma.campaign.findFirst.mockResolvedValue(null)

    await POST(makeReq({ strategyType: 'organic', strategyDuration: 'custom', customDurationDays: 160, contentIntensity: 'standard' }))

    expect(mockRefundDeduction).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      action: 'RUN_FULL_STRATEGY',
      deduction: expect.objectContaining({ transactionId: 'txn_99', creditsUsed: 18 }),
    }))
    expect(mockRefundForTxn).not.toHaveBeenCalled()
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
    expect(mockPrisma.creditTransaction.create).not.toHaveBeenCalled()
  })

  it('passes the complete legacy deduction to lifecycle fallback when transactionId is missing', async () => {
    mockIsWalletEnabled.mockReturnValue(true)
    mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 18, creditsRemaining: 50, isUnlimited: false }) // no transactionId
    mockRunFullAgency.mockImplementation(async (_workspaceId: string, _brief: Record<string, unknown>, options?: { beforePersistStrategy?: () => Promise<void> }) => {
      await options?.beforePersistStrategy?.()
      return { strategyCreated: false, agentRunId: 'run1', suggestions: 0, errors: ['failed'] }
    })
    mockPrisma.campaign.findFirst.mockResolvedValue(null)

    await POST(makeReq({ strategyType: 'organic', strategyDuration: 'custom', customDurationDays: 160, contentIntensity: 'standard' }))

    expect(mockRefundForTxn).not.toHaveBeenCalled()
    expect(mockRefundDeduction).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      action: 'RUN_FULL_STRATEGY',
      deduction: expect.objectContaining({ creditsUsed: 18 }),
    }))
  })

  it('settles a successful transaction and never sends it to refund', async () => {
    mockIsWalletEnabled.mockReturnValue(true)
    mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 14, creditsRemaining: 86, isUnlimited: false, transactionId: 'txn_ok' })
    // default mockRunFullAgency = strategyCreated true, campaign found → success

    await POST(makeReq({ strategyType: 'organic', strategyDuration: '90', contentIntensity: 'standard' }))

    expect(mockFinalizeDeduction).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      action: 'RUN_FULL_STRATEGY',
      deduction: expect.objectContaining({ transactionId: 'txn_ok' }),
      providerEconomics: {
        providerCostUsd: 0.09,
        providerPricingVersion: 'openai-standard-2026-07-20',
        providerUsage: {
          strategyText: expect.objectContaining({ model: 'gpt-4o', calls: 2 }),
        },
      },
    }))
    expect(mockRefundDeduction).not.toHaveBeenCalled()
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })
})

// ── PR-S1c-3 — generation contract reaches the strategist ──────────────────
describe('POST /api/strategy/run-full — generation contract (S1c-3)', () => {
  const briefArg = () => mockRunFullAgency.mock.calls[0]?.[1] as Record<string, any>

  it('1+2. builds deliverables from the order and attaches generationInstructions to the brief', async () => {
    await POST(makeReq({ strategyType: 'organic', strategyDuration: '90', contentIntensity: 'standard' }))
    expect(mockRunFullAgency).toHaveBeenCalledTimes(1)
    const brief = briefArg()
    expect(typeof brief.generationInstructions).toBe('string')
    expect(brief.generationInstructions).toMatch(/FIRST-30-DAY STRATEGY EXECUTION OUTLINE/i)
    expect(brief.strategyDeliverables).toBeTruthy()
    expect(brief.strategyDeliverables.supported).toBe(true)
    // counts come from the contract, not the AI
    expect(brief.organicPostCount).toBe(16) // Organic Standard band-top
    expect(brief.detailedCalendarDays).toBe(30)
    expect(brief.roadmapMonths).toBe(3)
    expect(brief.strategyOrder.goal).toBe('leads') // order goal enriched from goalOverride
    expect(brief.currentPlatforms).toEqual(['INSTAGRAM', 'TIKTOK', 'FACEBOOK'])
  })

  it('paid order carries paid planning-only scope into generationInstructions', async () => {
    await POST(makeReq({ strategyType: 'paid', strategyDuration: '90', contentIntensity: 'standard' }))
    const brief = briefArg()
    expect(brief.generationInstructions).toMatch(/PLANNING-ONLY/i)
    expect(brief.organicPostCount).toBe(0)
  })

  it('passes exact custom organic post count into the generation contract', async () => {
    await POST(makeReq({
      strategyType: 'organic',
      strategyDuration: '90',
      contentIntensity: 'daily',
      customOrganicPostCount: 7,
    }))
    const brief = briefArg()
    expect(brief.organicPostCount).toBe(7)
    expect(brief.strategyOrder.customOrganicPostCount).toBe(7)
    expect(brief.generationInstructions).toMatch(/exactly 7 post directions/)
    expect(brief.generationInstructions).toMatch(/exact custom post count/)
  })

  it('blocks exact custom organic post counts over 30 before orchestration or deduction', async () => {
    const res = await POST(makeReq({
      strategyType: 'organic',
      strategyDuration: '30',
      contentIntensity: 'standard',
      customOrganicPostCount: 31,
    }))
    expect(res.status).toBe(422)
    expect(mockRunFullAgency).not.toHaveBeenCalled()
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
  })

  it('13. custom > 180 still blocked (422) before any deliverables/generation', async () => {
    const res = await POST(makeReq({ strategyType: 'organic', strategyDuration: 'custom', customDurationDays: 365, contentIntensity: 'standard' }))
    expect(res.status).toBe(422)
    expect(mockRunFullAgency).not.toHaveBeenCalled()
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
  })
})
