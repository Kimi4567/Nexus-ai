/**
 * Smoke tests — critical money/credit paths only.
 *
 * Scope (intentionally minimal, per Golden Path Stability Sprint Phase 1):
 *   - credit deduction (success)
 *   - insufficient credits
 *   - unlimited plans (no charge)
 *   - free-tier starter grant + deduct
 *   - refund-on-failure
 *   - daily image cap logic
 *
 * Prisma and email are mocked — no database or network is touched.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

// vi.mock is hoisted above imports, so the mock object must be created with
// vi.hoisted() (also hoisted) to be referenceable inside the factory.
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    creditTransaction: { create: vi.fn() },
    usage: { upsert: vi.fn() },
    generatedVisual: { count: vi.fn() },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/email/resend', () => ({
  sendCreditsLowEmail: vi.fn().mockResolvedValue(undefined),
}))

import {
  checkAndDeductCredits,
  refundCredits,
  checkDailyImageCap,
  countImagesToday,
  CREDIT_COSTS,
  FREE_STARTER_CREDITS,
} from '@/lib/credits'

beforeEach(() => {
  vi.clearAllMocks()
  // Sensible defaults for the non-asserted side-effect writes.
  mockPrisma.creditTransaction.create.mockResolvedValue({})
  mockPrisma.usage.upsert.mockResolvedValue({})
  mockPrisma.user.update.mockResolvedValue({})
  mockPrisma.user.updateMany.mockResolvedValue({ count: 1 })
})

describe('checkAndDeductCredits', () => {
  it('deducts the action cost on success', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1', subscriptionStatus: 'STARTER', aiCredits: 50,
      monthlyGenerations: 5, email: 'a@b.com', name: 'A',
    })

    const res = await checkAndDeductCredits('u1', 'IMAGE_GENERATION')

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.creditsUsed).toBe(CREDIT_COSTS.IMAGE_GENERATION) // 3
      expect(res.creditsRemaining).toBe(50 - CREDIT_COSTS.IMAGE_GENERATION)
      expect(res.isUnlimited).toBe(false)
    }
    // Atomic conditional deduction must have been attempted
    expect(mockPrisma.user.updateMany).toHaveBeenCalledTimes(1)
  })

  it('refuses when the user cannot afford the action', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1', subscriptionStatus: 'STARTER', aiCredits: 1,
      monthlyGenerations: 5, email: 'a@b.com', name: 'A',
    })

    const res = await checkAndDeductCredits('u1', 'IMAGE_GENERATION') // cost 3

    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error).toBe('INSUFFICIENT_CREDITS')
      expect(res.currentCredits).toBe(1)
      expect(res.requiredCredits).toBe(CREDIT_COSTS.IMAGE_GENERATION)
    }
    // No deduction should be attempted when unaffordable
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled()
  })

  it('does not charge unlimited (aiCredits === -1) plans', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1', subscriptionStatus: 'ACTIVE', aiCredits: -1,
      monthlyGenerations: 10, email: 'a@b.com', name: 'A',
    })

    const res = await checkAndDeductCredits('u1', 'RUN_FULL_STRATEGY')

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.isUnlimited).toBe(true)
      expect(res.creditsUsed).toBe(0)
    }
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled()
  })

  it('grants free starter credits to a brand-new FREE user, then deducts', async () => {
    // First read: empty new free account
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1', subscriptionStatus: 'FREE', aiCredits: 0,
      monthlyGenerations: 0, email: 'a@b.com', name: 'A',
    })
    // The grant update re-selects the user with the starter credits applied
    mockPrisma.user.update.mockResolvedValue({
      id: 'u1', subscriptionStatus: 'FREE', aiCredits: FREE_STARTER_CREDITS,
      monthlyGenerations: 0, email: 'a@b.com', name: 'A',
    })

    const res = await checkAndDeductCredits('u1', 'CHAT_MESSAGE') // cost 1

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.creditsRemaining).toBe(FREE_STARTER_CREDITS - CREDIT_COSTS.CHAT_MESSAGE)
    }
    // Starter grant happened
    expect(mockPrisma.user.update).toHaveBeenCalled()
  })

  it('returns INSUFFICIENT when a concurrent request already drained credits (count === 0)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1', subscriptionStatus: 'STARTER', aiCredits: 5,
      monthlyGenerations: 5, email: 'a@b.com', name: 'A',
    })
    // Lost the atomic race
    mockPrisma.user.updateMany.mockResolvedValue({ count: 0 })

    const res = await checkAndDeductCredits('u1', 'IMAGE_GENERATION')

    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('INSUFFICIENT_CREDITS')
  })
})

// ── PR-S1c-2 — variable cost via costOverride ──────────────────────────────
describe('checkAndDeductCredits — costOverride (variable strategy pricing)', () => {
  it('10. deducts the exact override amount (not the fixed action cost)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1', subscriptionStatus: 'PRO', aiCredits: 100,
      monthlyGenerations: 5, email: 'a@b.com', name: 'A',
    })

    // RUN_FULL_STRATEGY fixed cost is 8; override with a variable 18.
    const res = await checkAndDeductCredits('u1', 'RUN_FULL_STRATEGY', 18)

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.creditsUsed).toBe(18)
      expect(res.creditsRemaining).toBe(100 - 18)
    }
    // Atomic guard must use the override amount (gte 18 / decrement 18).
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1', aiCredits: { gte: 18 } },
        data: expect.objectContaining({ aiCredits: { decrement: 18 } }),
      }),
    )
  })

  it('11. with no override, still uses the fixed CREDIT_COSTS action cost', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1', subscriptionStatus: 'PRO', aiCredits: 100,
      monthlyGenerations: 5, email: 'a@b.com', name: 'A',
    })

    const res = await checkAndDeductCredits('u1', 'RUN_FULL_STRATEGY')

    expect(res.ok).toBe(true)
    if (res.ok) expect(res.creditsUsed).toBe(CREDIT_COSTS.RUN_FULL_STRATEGY) // 8
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1', aiCredits: { gte: CREDIT_COSTS.RUN_FULL_STRATEGY } },
      }),
    )
  })

  it('12. unlimited plans never charge, even with an override (creditsUsed: 0)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1', subscriptionStatus: 'ACTIVE', aiCredits: -1,
      monthlyGenerations: 10, email: 'a@b.com', name: 'A',
    })

    const res = await checkAndDeductCredits('u1', 'RUN_FULL_STRATEGY', 22)

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.isUnlimited).toBe(true)
      expect(res.creditsUsed).toBe(0)
    }
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled()
  })

  it('insufficient credits uses the override as requiredCredits', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1', subscriptionStatus: 'STARTER', aiCredits: 10,
      monthlyGenerations: 5, email: 'a@b.com', name: 'A',
    })

    const res = await checkAndDeductCredits('u1', 'RUN_FULL_STRATEGY', 18) // can't afford 18

    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error).toBe('INSUFFICIENT_CREDITS')
      expect(res.requiredCredits).toBe(18)
      expect(res.currentCredits).toBe(10)
    }
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled()
  })

  it('ignores an invalid override (negative / NaN) and falls back to fixed cost', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1', subscriptionStatus: 'PRO', aiCredits: 100,
      monthlyGenerations: 5, email: 'a@b.com', name: 'A',
    })

    const res = await checkAndDeductCredits('u1', 'RUN_FULL_STRATEGY', -5)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.creditsUsed).toBe(CREDIT_COSTS.RUN_FULL_STRATEGY) // 8
  })
})

describe('refundCredits', () => {
  it('credits the action cost back and logs a REFUND transaction', async () => {
    await refundCredits('u1', 'IMAGE_GENERATION')

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: { aiCredits: { increment: CREDIT_COSTS.IMAGE_GENERATION } },
      }),
    )
    expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u1',
          action: 'REFUND',
          amount: CREDIT_COSTS.IMAGE_GENERATION, // positive = credited back
        }),
      }),
    )
  })

  it('never throws even if the DB write fails', async () => {
    mockPrisma.user.update.mockRejectedValueOnce(new Error('db down'))
    await expect(refundCredits('u1', 'CREATIVE_BRIEF')).resolves.toBeUndefined()
  })
})

describe('checkDailyImageCap', () => {
  it('allows generation below the FREE cap and reports remaining', async () => {
    mockPrisma.generatedVisual.count.mockResolvedValue(1)
    const res = await checkDailyImageCap('ws1', 'FREE') // cap 3
    expect(res.allowed).toBe(true)
    expect(res.cap).toBe(3)
    expect(res.remaining).toBe(2)
  })

  it('blocks generation once the FREE cap is reached', async () => {
    mockPrisma.generatedVisual.count.mockResolvedValue(3)
    const res = await checkDailyImageCap('ws1', 'FREE')
    expect(res.allowed).toBe(false)
    expect(res.remaining).toBe(0)
  })

  it('uses the higher cap for paid plans', async () => {
    mockPrisma.generatedVisual.count.mockResolvedValue(15)
    const res = await checkDailyImageCap('ws1', 'STARTER') // cap 20
    expect(res.allowed).toBe(true)
    expect(res.remaining).toBe(5)
  })

  it('defaults unknown / null plans to the FREE cap', async () => {
    mockPrisma.generatedVisual.count.mockResolvedValue(3)
    const res = await checkDailyImageCap('ws1', null)
    expect(res.cap).toBe(3)
    expect(res.allowed).toBe(false)
  })
})

describe('countImagesToday', () => {
  it('returns the workspace image count', async () => {
    mockPrisma.generatedVisual.count.mockResolvedValue(7)
    expect(await countImagesToday('ws1')).toBe(7)
  })

  it('returns 0 if the count query fails (non-fatal)', async () => {
    mockPrisma.generatedVisual.count.mockRejectedValueOnce(new Error('boom'))
    expect(await countImagesToday('ws1')).toBe(0)
  })
})
