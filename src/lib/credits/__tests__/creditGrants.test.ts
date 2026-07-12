/**
 * B1d-a — CreditGrant helper foundation tests.
 *
 * Pure source/shape builders + idempotent grant writes and wallet-cache sync.
 * Prisma is mocked; no DB.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    creditGrant: { createMany: vi.fn(), updateMany: vi.fn(), aggregate: vi.fn() },
    // Present so we can assert helpers NEVER touch these.
    user: { update: vi.fn(), findUnique: vi.fn() },
    creditTransaction: { create: vi.fn() },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

import {
  monthlySource,
  starterSource,
  referralSource,
  manualSource,
  purchaseSource,
  buildStarterGrant,
  buildMonthlyGrant,
  buildBonusGrant,
  buildPurchasedGrant,
  ensureGrant,
  resetNonPurchasedGrants,
  ensureMonthlyGrant,
  voidNonPurchasedGrants,
  fulfilPurchasedCreditPack,
  STARTER_CREDITS,
} from '@/lib/credits/creditGrants'

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.creditGrant.createMany.mockResolvedValue({ count: 1 })
  mockPrisma.creditGrant.updateMany.mockResolvedValue({ count: 0 })
})

const NOW = new Date('2026-06-19T12:00:00.000Z')

describe('source builders', () => {
  it('1. monthlySource is deterministic and ISO-normalized', () => {
    const a = monthlySource('sub_1', new Date('2026-06-01T00:00:00.000Z'))
    const b = monthlySource('sub_1', '2026-06-01T00:00:00.000Z')
    expect(a).toBe('monthly:sub_1:2026-06-01T00:00:00.000Z')
    expect(a).toBe(b) // Date and equivalent ISO string produce the same key
  })

  it('2. starterSource is the stable one-time key', () => {
    expect(starterSource()).toBe('starter:initial')
  })

  it('3. referralSource is deterministic per pair', () => {
    expect(referralSource('r1', 'r2')).toBe('referral:r1:r2')
    expect(referralSource('r1', 'r2')).toBe(referralSource('r1', 'r2'))
  })

  it('manualSource embeds the action id', () => {
    expect(manualSource('topup_42')).toBe('manual:topup_42')
  })

  it('purchaseSource is deterministic per Stripe Checkout session', () => {
    expect(purchaseSource('cs_123')).toBe('stripe:checkout:cs_123')
  })
})

describe('grant shape builders', () => {
  it('4. buildStarterGrant → TRIAL, 10, 14-day expiry, starter source', () => {
    const g = buildStarterGrant('u1', NOW)
    expect(g).toMatchObject({
      userId: 'u1', type: 'TRIAL', amount: STARTER_CREDITS, remaining: STARTER_CREDITS,
      source: 'starter:initial', status: 'ACTIVE',
    })
    expect(g.expiresAt?.getTime()).toBe(NOW.getTime() + 14 * 24 * 60 * 60 * 1000)
  })

  it('5. buildMonthlyGrant → MONTHLY, period-end expiry, stable source/billingCycleId', () => {
    const start = new Date('2026-06-01T00:00:00.000Z')
    const end = new Date('2026-07-01T00:00:00.000Z')
    const g = buildMonthlyGrant('u1', { stripeSubscriptionId: 'sub_9', currentPeriodStart: start, currentPeriodEnd: end, amount: 150 })
    expect(g).toMatchObject({ userId: 'u1', type: 'MONTHLY', amount: 150, remaining: 150, status: 'ACTIVE' })
    expect(g.expiresAt).toBe(end)
    expect(g.source).toBe('monthly:sub_9:2026-06-01T00:00:00.000Z')
    expect(g.billingCycleId).toBe(g.source) // same stable cycle key
    // Re-building the same cycle yields the same source (idempotency key stable).
    expect(buildMonthlyGrant('u1', { stripeSubscriptionId: 'sub_9', currentPeriodStart: start, currentPeriodEnd: end, amount: 150 }).source).toBe(g.source)
  })

  it('null currentPeriodEnd → null expiry', () => {
    const g = buildMonthlyGrant('u1', { stripeSubscriptionId: 'sub_9', currentPeriodStart: NOW, currentPeriodEnd: null, amount: 50 })
    expect(g.expiresAt).toBeNull()
  })

  it('6. buildBonusGrant → REFERRAL / MANUAL, non-expiring', () => {
    const ref = buildBonusGrant('u1', 'REFERRAL', 20, referralSource('a', 'b'))
    expect(ref).toMatchObject({ userId: 'u1', type: 'REFERRAL', amount: 20, remaining: 20, expiresAt: null, source: 'referral:a:b', status: 'ACTIVE' })
    const man = buildBonusGrant('u1', 'MANUAL', 100, manualSource('x'))
    expect(man).toMatchObject({ type: 'MANUAL', amount: 100, remaining: 100, expiresAt: null })
  })

  it('buildPurchasedGrant → PURCHASED with 12-calendar-month expiry', () => {
    const g = buildPurchasedGrant('u1', 'cs_123', 100, NOW)
    expect(g).toMatchObject({
      userId: 'u1', type: 'PURCHASED', amount: 100, remaining: 100,
      source: 'stripe:checkout:cs_123', status: 'ACTIVE',
    })
    expect(g.expiresAt?.toISOString()).toBe('2027-06-19T12:00:00.000Z')
  })
})

describe('fulfilPurchasedCreditPack', () => {
  it('creates one purchased grant, transaction, and synchronized cache balance', async () => {
    const tx = {
      creditGrant: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
        updateMany: vi.fn(),
        aggregate: vi.fn().mockResolvedValue({ _sum: { remaining: 140 } }),
      },
      creditTransaction: { create: vi.fn().mockResolvedValue({ id: 'ct_1' }) },
      user: { update: vi.fn().mockResolvedValue({}) },
    }

    const result = await fulfilPurchasedCreditPack({
      userId: 'u1', checkoutSessionId: 'cs_123', credits: 100, purchasedAt: NOW,
    }, tx)

    expect(result).toEqual({ created: true, balance: 140 })
    expect(tx.creditTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ amount: 100, entityId: 'cs_123', entityType: 'credit_pack' }),
    }))
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { aiCredits: 140 } })
  })

  it('is idempotent: duplicate session does not duplicate the transaction', async () => {
    const tx = {
      creditGrant: {
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
        updateMany: vi.fn(),
        aggregate: vi.fn().mockResolvedValue({ _sum: { remaining: 100 } }),
      },
      creditTransaction: { create: vi.fn() },
      user: { update: vi.fn().mockResolvedValue({}) },
    }

    const result = await fulfilPurchasedCreditPack({
      userId: 'u1', checkoutSessionId: 'cs_123', credits: 100, purchasedAt: NOW,
    }, tx)

    expect(result.created).toBe(false)
    expect(tx.creditTransaction.create).not.toHaveBeenCalled()
  })
})

describe('ensureGrant', () => {
  it('9. creates a grant idempotently via createMany skipDuplicates', async () => {
    const res = await ensureGrant(buildStarterGrant('u1', NOW))
    expect(res.created).toBe(true)
    expect(mockPrisma.creditGrant.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ userId: 'u1', type: 'TRIAL', amount: 10, remaining: 10, source: 'starter:initial', status: 'ACTIVE' })],
        skipDuplicates: true,
      }),
    )
  })

  it('returns created:false when the grant already exists (count 0)', async () => {
    mockPrisma.creditGrant.createMany.mockResolvedValueOnce({ count: 0 })
    const res = await ensureGrant(buildStarterGrant('u1', NOW))
    expect(res.created).toBe(false)
  })

  it('defaults remaining to amount when omitted', async () => {
    await ensureGrant({ userId: 'u1', type: 'MANUAL', amount: 30, expiresAt: null, source: 'manual:y' })
    const arg = mockPrisma.creditGrant.createMany.mock.calls[0][0] as any
    expect(arg.data[0].remaining).toBe(30)
  })

  it('10. never mutates User.aiCredits or writes a CreditTransaction', async () => {
    await ensureGrant(buildBonusGrant('u1', 'REFERRAL', 20, referralSource('a', 'b')))
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
    expect(mockPrisma.creditTransaction.create).not.toHaveBeenCalled()
  })

  it('11. uses the provided transaction client when given', async () => {
    const tx = { creditGrant: { createMany: vi.fn().mockResolvedValue({ count: 1 }), updateMany: vi.fn() } }
    const res = await ensureGrant(buildStarterGrant('u1', NOW), tx)
    expect(res.created).toBe(true)
    expect(tx.creditGrant.createMany).toHaveBeenCalledTimes(1)
    expect(mockPrisma.creditGrant.createMany).not.toHaveBeenCalled() // base prisma untouched
  })
})

describe('resetNonPurchasedGrants', () => {
  it('7. resets ACTIVE non-PURCHASED grants to RESET / remaining 0', async () => {
    mockPrisma.creditGrant.updateMany.mockResolvedValueOnce({ count: 3 })
    const res = await resetNonPurchasedGrants('u1')
    expect(res.resetCount).toBe(3)
    expect(mockPrisma.creditGrant.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', status: 'ACTIVE', type: { not: 'PURCHASED' } },
      data: { status: 'RESET', remaining: 0 },
    })
  })

  it('8. leaves PURCHASED grants untouched (filter excludes them)', async () => {
    await resetNonPurchasedGrants('u1')
    const arg = mockPrisma.creditGrant.updateMany.mock.calls[0][0] as any
    expect(arg.where.type).toEqual({ not: 'PURCHASED' })
    expect(arg.where.status).toBe('ACTIVE')
  })

  it('never mutates User.aiCredits', async () => {
    await resetNonPurchasedGrants('u1')
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it('11. uses the provided transaction client when given', async () => {
    const tx = { creditGrant: { createMany: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 2 }) } }
    const res = await resetNonPurchasedGrants('u1', tx)
    expect(res.resetCount).toBe(2)
    expect(tx.creditGrant.updateMany).toHaveBeenCalledTimes(1)
    expect(mockPrisma.creditGrant.updateMany).not.toHaveBeenCalled()
  })

  it('B1d-c: exceptSource excludes that grant from the reset', async () => {
    await resetNonPurchasedGrants('u1', undefined, 'monthly:sub_1:2026-06-01T00:00:00.000Z')
    const arg = mockPrisma.creditGrant.updateMany.mock.calls[0][0] as any
    expect(arg.where.source).toEqual({ not: 'monthly:sub_1:2026-06-01T00:00:00.000Z' })
    expect(arg.where.type).toEqual({ not: 'PURCHASED' })
    expect(arg.where.status).toBe('ACTIVE')
  })
})

// ── B1d-c — ensureMonthlyGrant (provision one cycle, idempotent) ────────────
describe('ensureMonthlyGrant', () => {
  const monthly = {
    stripeSubscriptionId: 'sub_9',
    currentPeriodStart: new Date('2026-06-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2026-07-01T00:00:00.000Z'),
    amount: 150,
  }
  const SOURCE = 'monthly:sub_9:2026-06-01T00:00:00.000Z'

  it('creates the MONTHLY grant (correct source/billingCycleId/expiry/amount)', async () => {
    mockPrisma.creditGrant.createMany.mockResolvedValueOnce({ count: 1 })
    const res = await ensureMonthlyGrant('u1', monthly)
    expect(res.created).toBe(true)
    expect(mockPrisma.creditGrant.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({
          userId: 'u1', type: 'MONTHLY', amount: 150, remaining: 150,
          source: SOURCE, billingCycleId: SOURCE, status: 'ACTIVE',
        })],
        skipDuplicates: true,
      }),
    )
    const arg = mockPrisma.creditGrant.createMany.mock.calls[0][0] as any
    expect(arg.data[0].expiresAt).toEqual(monthly.currentPeriodEnd)
  })

  it('when newly created, resets prior non-purchased grants EXCEPT the new MONTHLY', async () => {
    mockPrisma.creditGrant.createMany.mockResolvedValueOnce({ count: 1 })
    await ensureMonthlyGrant('u1', monthly)
    expect(mockPrisma.creditGrant.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', status: 'ACTIVE', type: { not: 'PURCHASED' }, source: { not: SOURCE } },
      data: { status: 'RESET', remaining: 0 },
    })
  })

  it('duplicate same-cycle provision does NOT create a duplicate and does NOT reset again', async () => {
    mockPrisma.creditGrant.createMany.mockResolvedValueOnce({ count: 0 }) // already exists
    const res = await ensureMonthlyGrant('u1', monthly)
    expect(res.created).toBe(false)
    expect(mockPrisma.creditGrant.updateMany).not.toHaveBeenCalled()
  })

  it('uses the provided transaction client', async () => {
    const tx = { creditGrant: { createMany: vi.fn().mockResolvedValue({ count: 1 }), updateMany: vi.fn().mockResolvedValue({ count: 0 }) } }
    await ensureMonthlyGrant('u1', monthly, tx)
    expect(tx.creditGrant.createMany).toHaveBeenCalledTimes(1)
    expect(tx.creditGrant.updateMany).toHaveBeenCalledTimes(1) // reset ran (created)
    expect(mockPrisma.creditGrant.createMany).not.toHaveBeenCalled()
  })
})

// ── B1d-c-3 — voidNonPurchasedGrants (cancellation) ────────────────────────
describe('voidNonPurchasedGrants', () => {
  it('VOIDs ACTIVE non-PURCHASED grants to remaining 0', async () => {
    mockPrisma.creditGrant.updateMany.mockResolvedValueOnce({ count: 2 })
    const res = await voidNonPurchasedGrants('u1')
    expect(res.voidCount).toBe(2)
    expect(mockPrisma.creditGrant.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', status: 'ACTIVE', type: { not: 'PURCHASED' } },
      data: { status: 'VOID', remaining: 0 },
    })
  })

  it('leaves PURCHASED grants untouched (filter excludes them)', async () => {
    await voidNonPurchasedGrants('u1')
    const arg = mockPrisma.creditGrant.updateMany.mock.calls[0][0] as any
    expect(arg.where.type).toEqual({ not: 'PURCHASED' })
    expect(arg.where.status).toBe('ACTIVE')
    expect(arg.data.status).toBe('VOID')
  })

  it('is idempotent (re-running voids nothing) and never touches User.aiCredits', async () => {
    mockPrisma.creditGrant.updateMany.mockResolvedValueOnce({ count: 0 })
    const res = await voidNonPurchasedGrants('u1')
    expect(res.voidCount).toBe(0)
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it('uses the provided transaction client', async () => {
    const tx = { creditGrant: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } }
    await voidNonPurchasedGrants('u1', tx)
    expect(tx.creditGrant.updateMany).toHaveBeenCalledTimes(1)
    expect(mockPrisma.creditGrant.updateMany).not.toHaveBeenCalled()
  })
})
