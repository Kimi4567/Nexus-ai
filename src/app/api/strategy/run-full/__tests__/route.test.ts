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

import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockGetAuthUser, mockAiRateLimitDb, mockCheckAndDeduct, mockRefundForTxn, mockIsWalletEnabled,
  mockRunFullAgency, mockReadiness, mockGetMemories, mockFormatMemories,
  mockPrisma,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockAiRateLimitDb: vi.fn(),
  mockCheckAndDeduct: vi.fn(),
  mockRefundForTxn: vi.fn(),
  mockIsWalletEnabled: vi.fn(),
  mockRunFullAgency: vi.fn(),
  mockReadiness: vi.fn(),
  mockGetMemories: vi.fn(),
  mockFormatMemories: vi.fn(),
  mockPrisma: {
    workspace: { findFirst: vi.fn() },
    brandProfile: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
    creditTransaction: { create: vi.fn() },
    media: { findMany: vi.fn() },
    campaign: { findFirst: vi.fn() },
  },
}))

vi.mock('@/lib/apiAuth', () => ({ getAuthUser: mockGetAuthUser }))
vi.mock('@/lib/dbRateLimit', () => ({ aiRateLimitDb: mockAiRateLimitDb }))
vi.mock('@/lib/credits', () => ({
  checkAndDeductCredits: mockCheckAndDeduct,
  FREE_STARTER_CREDITS: 10,
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
// NOTE: resolveStrategyCharge is NOT mocked — real pricing runs.

import { POST } from '../route'

const makeReq = (body: Record<string, unknown> = {}) => ({ json: async () => body }) as any

beforeEach(() => {
  vi.clearAllMocks()
  mockGetAuthUser.mockResolvedValue({ id: 'u1' })
  mockAiRateLimitDb.mockResolvedValue({ ok: true })
  mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 14, creditsRemaining: 86, isUnlimited: false })
  mockIsWalletEnabled.mockReturnValue(false) // flag OFF by default (production state)
  mockRefundForTxn.mockResolvedValue(undefined)
  mockReadiness.mockReturnValue({ ready: true, missingRequired: [], score: 80 })
  mockGetMemories.mockResolvedValue([])
  mockFormatMemories.mockReturnValue(undefined)
  mockPrisma.workspace.findFirst.mockResolvedValue({ id: 'w1', ownerId: 'u1' })
  mockPrisma.brandProfile.findUnique.mockResolvedValue({
    brandName: 'B',
    industry: 'Tech',
    description: 'AI marketing operating system for small businesses.',
    primaryOffer: 'Strategy and content planning workspace.',
    targetAudience: 'A',
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
  mockPrisma.user.update.mockResolvedValue({})
  mockPrisma.creditTransaction.create.mockResolvedValue({})
  mockPrisma.media.findMany.mockResolvedValue([])
  mockPrisma.campaign.findFirst.mockResolvedValue({ id: 'camp1', name: 'New Strategy' })
  mockRunFullAgency.mockImplementation(async (_workspaceId: string, _brief: Record<string, unknown>, options?: { beforePersistStrategy?: () => Promise<void> }) => {
    await options?.beforePersistStrategy?.()
    return { strategyCreated: true, agentRunId: 'run1', suggestions: 3, errors: [] }
  })
})

describe('POST /api/strategy/run-full — variable charge', () => {
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

  it('7. deducts the server-recomputed variable cost (Organic Standard 90 = 14)', async () => {
    const res = await POST(makeReq({
      strategyType: 'organic', strategyDuration: '90', contentIntensity: 'standard',
    }))
    expect(res.status).toBe(200)
    expect(mockCheckAndDeduct).toHaveBeenCalledWith('u1', 'RUN_FULL_STRATEGY', 14)
  })

  it('deducts a different recomputed cost for a richer order (Full Daily 180 = 34)', async () => {
    await POST(makeReq({
      strategyType: 'full', strategyDuration: '180', contentIntensity: 'daily',
    }))
    expect(mockCheckAndDeduct).toHaveBeenCalledWith('u1', 'RUN_FULL_STRATEGY', 34)
  })

  it('8. ignores any client-supplied price and recomputes server-side', async () => {
    await POST(makeReq({
      strategyType: 'organic', strategyDuration: '30', contentIntensity: 'daily',
      // adversarial client values that must be ignored:
      cost: 1, price: 0, credits: 999,
    }))
    // Organic Daily 30 = 14, recomputed — not the client's 1/0/999.
    expect(mockCheckAndDeduct).toHaveBeenCalledWith('u1', 'RUN_FULL_STRATEGY', 14)
  })

  it('9. insufficient credits → 402 during preflight before orchestration or deduction', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      preferences: {},
      subscriptionStatus: 'ACTIVE',
      aiCredits: 7,
      monthlyGenerations: 1,
    })
    const res = await POST(makeReq({
      strategyType: 'full', strategyDuration: '90', contentIntensity: 'standard', // = 21
    }))
    expect(res.status).toBe(402)
    const json = await res.json()
    expect(json.error).toBe('INSUFFICIENT_CREDITS')
    expect(json.requiredCredits).toBe(21)
    expect(json.currentCredits).toBe(7)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockRunFullAgency).not.toHaveBeenCalled()
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
    expect(json.ok).toBe(false)
    // Exact refund of the variable amount actually deducted (18), not fixed 8.
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: { aiCredits: { increment: 18 } },
      }),
    )
    expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        action: 'REFUND',
        amount: 18,
        entityType: 'refund',
        description: expect.stringContaining('Run Full Strategy failed'),
      }),
    })
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
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: { aiCredits: { increment: 10 } },
      }),
    )
    expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        action: 'REFUND',
        amount: 10,
        entityType: 'refund',
        description: expect.stringContaining('Run Full Strategy exception'),
      }),
    })
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
      requiredCredits: 10,
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
    expect(mockCheckAndDeduct).toHaveBeenCalledWith('u1', 'RUN_FULL_STRATEGY', 10)
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

  it('does not refund unlimited-plan users (creditsUsed=0) on failure', async () => {
    mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 0, creditsRemaining: -1, isUnlimited: true })
    mockRunFullAgency.mockImplementation(async (_workspaceId: string, _brief: Record<string, unknown>, options?: { beforePersistStrategy?: () => Promise<void> }) => {
      await options?.beforePersistStrategy?.()
      return { strategyCreated: false, agentRunId: 'run1', suggestions: 0, errors: ['failed'] }
    })
    mockPrisma.campaign.findFirst.mockResolvedValue(null)

    await POST(makeReq({ strategyType: 'organic', strategyDuration: '90', contentIntensity: 'standard' }))
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
    expect(mockPrisma.creditTransaction.create).not.toHaveBeenCalled()
  })

  // ── B1c-c-1 — refund path selection by CREDIT_WALLET_ENABLED ───────────────
  it('flag OFF → scalar refund only; refundCreditsForTransaction is NOT called', async () => {
    mockIsWalletEnabled.mockReturnValue(false)
    mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 18, creditsRemaining: 50, isUnlimited: false, transactionId: 'txn_should_be_ignored' })
    mockRunFullAgency.mockImplementation(async (_workspaceId: string, _brief: Record<string, unknown>, options?: { beforePersistStrategy?: () => Promise<void> }) => {
      await options?.beforePersistStrategy?.()
      return { strategyCreated: false, agentRunId: 'run1', suggestions: 0, errors: ['failed'] }
    })
    mockPrisma.campaign.findFirst.mockResolvedValue(null)

    await POST(makeReq({ strategyType: 'organic', strategyDuration: 'custom', customDurationDays: 160, contentIntensity: 'standard' }))

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' }, data: { aiCredits: { increment: 18 } } }),
    )
    expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        action: 'REFUND',
        amount: 18,
        entityType: 'refund',
      }),
    })
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('flag ON + transactionId → refundCreditsForTransaction with the debit id; no scalar increment', async () => {
    mockIsWalletEnabled.mockReturnValue(true)
    mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 18, creditsRemaining: 50, isUnlimited: false, transactionId: 'txn_99' })
    mockRunFullAgency.mockImplementation(async (_workspaceId: string, _brief: Record<string, unknown>, options?: { beforePersistStrategy?: () => Promise<void> }) => {
      await options?.beforePersistStrategy?.()
      return { strategyCreated: false, agentRunId: 'run1', suggestions: 0, errors: ['failed'] }
    })
    mockPrisma.campaign.findFirst.mockResolvedValue(null)

    await POST(makeReq({ strategyType: 'organic', strategyDuration: 'custom', customDurationDays: 160, contentIntensity: 'standard' }))

    expect(mockRefundForTxn).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', transactionId: 'txn_99' }),
    )
    // Wallet path must NOT also run the scalar increment.
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
    expect(mockPrisma.creditTransaction.create).not.toHaveBeenCalled()
  })

  it('flag ON but no transactionId → falls back to scalar increment', async () => {
    mockIsWalletEnabled.mockReturnValue(true)
    mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 18, creditsRemaining: 50, isUnlimited: false }) // no transactionId
    mockRunFullAgency.mockImplementation(async (_workspaceId: string, _brief: Record<string, unknown>, options?: { beforePersistStrategy?: () => Promise<void> }) => {
      await options?.beforePersistStrategy?.()
      return { strategyCreated: false, agentRunId: 'run1', suggestions: 0, errors: ['failed'] }
    })
    mockPrisma.campaign.findFirst.mockResolvedValue(null)

    await POST(makeReq({ strategyType: 'organic', strategyDuration: 'custom', customDurationDays: 160, contentIntensity: 'standard' }))

    expect(mockRefundForTxn).not.toHaveBeenCalled()
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' }, data: { aiCredits: { increment: 18 } } }),
    )
  })

  it('flag ON + transactionId but success → no refund at all', async () => {
    mockIsWalletEnabled.mockReturnValue(true)
    mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 14, creditsRemaining: 86, isUnlimited: false, transactionId: 'txn_ok' })
    // default mockRunFullAgency = strategyCreated true, campaign found → success

    await POST(makeReq({ strategyType: 'organic', strategyDuration: '90', contentIntensity: 'standard' }))

    expect(mockRefundForTxn).not.toHaveBeenCalled()
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

  it('13. custom > 180 still blocked (422) before any deliverables/generation', async () => {
    const res = await POST(makeReq({ strategyType: 'organic', strategyDuration: 'custom', customDurationDays: 365, contentIntensity: 'standard' }))
    expect(res.status).toBe(422)
    expect(mockRunFullAgency).not.toHaveBeenCalled()
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
  })
})
