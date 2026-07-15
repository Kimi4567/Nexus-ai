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
    creditGrant: { createMany: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    usage: { upsert: vi.fn() },
    generatedVisual: { count: vi.fn() },
    // Used by the B1d-b parallel-grant writes (starter / addCredits-with-source)
    // and to assert the wallet deduction path is NEVER entered while the
    // CREDIT_WALLET_ENABLED flag is OFF (its default in this suite).
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/email/resend', () => ({
  sendCreditsLowEmail: vi.fn().mockResolvedValue(undefined),
}))

import {
  checkAndDeductCredits,
  addCredits,
  refundCredits,
  checkDailyImageCap,
  countImagesToday,
  CREDIT_COSTS,
  FREE_STARTER_CREDITS,
} from '@/lib/credits'

beforeEach(() => {
  vi.clearAllMocks()
  // Sensible defaults for the non-asserted side-effect writes.
  mockPrisma.creditTransaction.create.mockResolvedValue({ id: 'txn_scalar' })
  mockPrisma.creditGrant.createMany.mockResolvedValue({ count: 1 })
  mockPrisma.usage.upsert.mockResolvedValue({})
  mockPrisma.user.update.mockResolvedValue({})
  mockPrisma.user.updateMany.mockResolvedValue({ count: 1 })
  // Interactive transaction runs its callback against the same mock surface, so
  // tx.user.update === mockPrisma.user.update etc. (B1d-b parallel-grant writes).
  mockPrisma.$transaction.mockImplementation(async (cb: (t: typeof mockPrisma) => unknown) => cb(mockPrisma))
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
      expect(res.transactionId).toBe('txn_scalar')
    }
    // Atomic conditional deduction must have been attempted
    expect(mockPrisma.user.updateMany).toHaveBeenCalledTimes(1)
    expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'IMAGE_GENERATION', amount: -CREDIT_COSTS.IMAGE_GENERATION }),
    }))
  })

  it('links a debit to the exact billable entity for later reconciliation', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1', subscriptionStatus: 'STARTER', aiCredits: 50,
      monthlyGenerations: 5, email: 'a@b.com', name: 'A',
    })

    await checkAndDeductCredits('u1', 'IMAGE_GENERATION', undefined, {
      entityId: 'post_1',
      entityType: 'social_post_image',
    })

    expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        entityId: 'post_1',
        entityType: 'social_post_image',
      }),
    }))
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

  it('with the wallet flag OFF, uses the scalar ledger transaction and never reads grant rows', async () => {
    // CREDIT_WALLET_ENABLED is unset in this suite → scalar path only.
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1', subscriptionStatus: 'STARTER', aiCredits: 50,
      monthlyGenerations: 5, email: 'a@b.com', name: 'A',
    })

    const res = await checkAndDeductCredits('u1', 'IMAGE_GENERATION')

    expect(res.ok).toBe(true)
    // Scalar balance mutation and its debit ledger are committed atomically.
    expect(mockPrisma.user.updateMany).toHaveBeenCalledTimes(1)
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
    expect(mockPrisma.creditGrant.updateMany).not.toHaveBeenCalled()
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

// ── B1d-b — parallel starter grant on first-time FREE ──────────────────────
describe('checkAndDeductCredits — B1d-b starter grant', () => {
  it('first-time FREE user gets a starter TRIAL grant in the same transaction', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1', subscriptionStatus: 'FREE', aiCredits: 0,
      monthlyGenerations: 0, email: 'a@b.com', name: 'A',
    })
    mockPrisma.user.update.mockResolvedValue({
      id: 'u1', subscriptionStatus: 'FREE', aiCredits: FREE_STARTER_CREDITS,
      monthlyGenerations: 0, email: 'a@b.com', name: 'A',
    })

    const res = await checkAndDeductCredits('u1', 'CHAT_MESSAGE') // cost 1

    expect(res.ok).toBe(true)
    // The cached balance mirrors the canonical starter grant, then deducts once.
    if (res.ok) expect(res.creditsRemaining).toBe(FREE_STARTER_CREDITS - CREDIT_COSTS.CHAT_MESSAGE)
    // Grant created in a transaction with the right shape.
    expect(mockPrisma.$transaction).toHaveBeenCalled()
    expect(mockPrisma.creditGrant.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({
          userId: 'u1', type: 'TRIAL', amount: FREE_STARTER_CREDITS, remaining: FREE_STARTER_CREDITS,
          source: 'starter:initial', status: 'ACTIVE',
        })],
        skipDuplicates: true,
      }),
    )
    // 14-day expiry present.
    const arg = mockPrisma.creditGrant.createMany.mock.calls[0][0] as any
    expect(arg.data[0].expiresAt instanceof Date).toBe(true)
    // No reset of any grants in B1d-b.
    expect(mockPrisma.creditGrant.updateMany).not.toHaveBeenCalled()
  })

  it('non-first-time FREE user does not create a starter grant', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1', subscriptionStatus: 'FREE', aiCredits: 8,
      monthlyGenerations: 3, email: 'a@b.com', name: 'A',
    })

    await checkAndDeductCredits('u1', 'CHAT_MESSAGE')

    expect(mockPrisma.creditGrant.createMany).not.toHaveBeenCalled()
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
    expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'CHAT_MESSAGE', amount: -1 }),
    }))
  })
})

// ── B1d-b — addCredits optional source ─────────────────────────────────────
describe('addCredits — B1d-b optional source', () => {
  it('without source: increments + logs, creates NO grant (unchanged)', async () => {
    await addCredits('u1', 25, 'Bonus')

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' }, data: { aiCredits: { increment: 25 } },
    })
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    expect(mockPrisma.creditGrant.createMany).not.toHaveBeenCalled()
    expect(mockPrisma.creditTransaction.create).toHaveBeenCalled() // _logTransaction unchanged
  })

  it('with a stable source: atomic increment + one MANUAL grant', async () => {
    await addCredits('u1', 25, 'Promo', 'bonus', 'manual:promo7')

    expect(mockPrisma.$transaction).toHaveBeenCalled()
    expect(mockPrisma.creditGrant.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({
          userId: 'u1', type: 'MANUAL', amount: 25, remaining: 25,
          source: 'manual:promo7', expiresAt: null, status: 'ACTIVE',
        })],
        skipDuplicates: true,
      }),
    )
    expect(mockPrisma.creditTransaction.create).toHaveBeenCalled()
    // No allocation writes, no reset.
    expect(mockPrisma.creditGrant.updateMany).not.toHaveBeenCalled()
  })

  it('repeated addCredits with the same source relies on skipDuplicates (idempotent)', async () => {
    await addCredits('u1', 25, 'Promo', 'bonus', 'manual:promo7')
    const arg = mockPrisma.creditGrant.createMany.mock.calls[0][0] as any
    expect(arg.skipDuplicates).toBe(true) // (userId, source) uniqueness prevents a duplicate grant
  })

  it('duplicate source does not increment the cache or write a second credit transaction', async () => {
    mockPrisma.creditGrant.createMany.mockResolvedValueOnce({ count: 0 })

    await addCredits('u1', 25, 'Promo', 'bonus', 'manual:promo7')

    expect(mockPrisma.user.update).not.toHaveBeenCalled()
    expect(mockPrisma.creditTransaction.create).not.toHaveBeenCalled()
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

  it('wallet flag → fallback refund is represented by a short-lived REFUND grant', async () => {
    const original = process.env.CREDIT_WALLET_ENABLED
    process.env.CREDIT_WALLET_ENABLED = 'true'
    try {
      await refundCredits('u1', 'IMAGE_GENERATION', 'legacy route failure')

      expect(mockPrisma.$transaction).toHaveBeenCalled()
      expect(mockPrisma.creditGrant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'u1',
          type: 'REFUND',
          amount: CREDIT_COSTS.IMAGE_GENERATION,
          remaining: CREDIT_COSTS.IMAGE_GENERATION,
          status: 'ACTIVE',
          expiresAt: expect.any(Date),
        }),
      })
      expect(mockPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { aiCredits: { increment: CREDIT_COSTS.IMAGE_GENERATION } },
      }))
    } finally {
      if (original === undefined) delete process.env.CREDIT_WALLET_ENABLED
      else process.env.CREDIT_WALLET_ENABLED = original
    }
  })

  it('never throws even if the DB write fails', async () => {
    mockPrisma.user.update.mockRejectedValueOnce(new Error('db down'))
    await expect(refundCredits('u1', 'CREATIVE_BRIEF')).resolves.toEqual({
      ok: false,
      status: 'failed',
      error: 'db down',
    })
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
