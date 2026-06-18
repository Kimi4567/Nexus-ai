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
  mockGetAuthUser, mockAiRateLimitDb, mockCheckAndDeduct,
  mockRunFullAgency, mockReadiness, mockGetMemories, mockFormatMemories,
  mockPrisma,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockAiRateLimitDb: vi.fn(),
  mockCheckAndDeduct: vi.fn(),
  mockRunFullAgency: vi.fn(),
  mockReadiness: vi.fn(),
  mockGetMemories: vi.fn(),
  mockFormatMemories: vi.fn(),
  mockPrisma: {
    workspace: { findFirst: vi.fn() },
    brandProfile: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
    media: { findMany: vi.fn() },
    campaign: { findFirst: vi.fn() },
  },
}))

vi.mock('@/lib/apiAuth', () => ({ getAuthUser: mockGetAuthUser }))
vi.mock('@/lib/dbRateLimit', () => ({ aiRateLimitDb: mockAiRateLimitDb }))
vi.mock('@/lib/credits', () => ({ checkAndDeductCredits: mockCheckAndDeduct }))
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
  mockReadiness.mockReturnValue({ ready: true, missingRequired: [], score: 80 })
  mockGetMemories.mockResolvedValue([])
  mockFormatMemories.mockReturnValue(undefined)
  mockPrisma.workspace.findFirst.mockResolvedValue({ id: 'w1', ownerId: 'u1' })
  mockPrisma.brandProfile.findUnique.mockResolvedValue({ brandName: 'B', industry: 'Tech', targetAudience: 'A' })
  mockPrisma.user.findUnique.mockResolvedValue({ preferences: {} })
  mockPrisma.user.update.mockResolvedValue({})
  mockPrisma.media.findMany.mockResolvedValue([])
  mockPrisma.campaign.findFirst.mockResolvedValue({ id: 'camp1', name: 'New Strategy' })
  mockRunFullAgency.mockResolvedValue({ strategyCreated: true, agentRunId: 'run1', suggestions: 3, errors: [] })
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

  it('9. insufficient credits → 402 (deduction attempted with variable cost)', async () => {
    mockCheckAndDeduct.mockResolvedValue({ ok: false, error: 'INSUFFICIENT_CREDITS', requiredCredits: 21 })
    const res = await POST(makeReq({
      strategyType: 'full', strategyDuration: '90', contentIntensity: 'standard', // = 21
    }))
    expect(res.status).toBe(402)
    expect(mockCheckAndDeduct).toHaveBeenCalledWith('u1', 'RUN_FULL_STRATEGY', 21)
    expect(mockRunFullAgency).not.toHaveBeenCalled()
  })

  it('13. refund-on-failure refunds the EXACT deducted amount (credit.creditsUsed)', async () => {
    mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 18, creditsRemaining: 50, isUnlimited: false })
    mockRunFullAgency.mockResolvedValue({ strategyCreated: false, agentRunId: 'run1', suggestions: 0, errors: ['failed'] })
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
  })

  it('does not refund unlimited-plan users (creditsUsed=0) on failure', async () => {
    mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 0, creditsRemaining: -1, isUnlimited: true })
    mockRunFullAgency.mockResolvedValue({ strategyCreated: false, agentRunId: 'run1', suggestions: 0, errors: ['failed'] })
    mockPrisma.campaign.findFirst.mockResolvedValue(null)

    await POST(makeReq({ strategyType: 'organic', strategyDuration: '90', contentIntensity: 'standard' }))
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })
})
