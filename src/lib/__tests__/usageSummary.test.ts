/**
 * Trust Sprint #3 — usage analytics truth.
 *
 * getUsageSummary / getMonthlyActivity are the SINGLE source the dashboard and
 * analytics endpoints share. These tests pin the contract:
 *   - credits used this month comes from the ledger (not monthlyTotal - remaining)
 *     and is correct even when remaining credits exceed the monthly quota
 *   - AI generations uses a populated source and is never stuck at 0
 *   - refunded/reserved attempts are excluded by the settled-ledger query
 *   - unlimited-plan operations retain their economic credit cost
 *   - deterministic for a fixture → dashboard & analytics always agree
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    creditTransaction: { count: vi.fn(), findMany: vi.fn() },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/email/resend', () => ({ sendCreditsLowEmail: vi.fn().mockResolvedValue(undefined) }))

import { getUsageSummary, getMonthlyActivity } from '@/lib/credits'

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.user.findUnique.mockResolvedValue({ monthlyGenerations: 7 })
  mockPrisma.creditTransaction.count.mockResolvedValue(6)
  mockPrisma.creditTransaction.findMany.mockResolvedValue([])
})

describe('getUsageSummary', () => {
  it('1. creditsUsedThisMonth comes from the ledger — correct even when remaining > monthly quota', async () => {
    // remaining(281) > monthlyTotal(150) used to underflow to 0. Ledger is the truth.
    mockPrisma.creditTransaction.findMany.mockResolvedValue([
      { creditCost: 8 },  // strategy
      { creditCost: 2 },  // content plan
      { creditCost: 3 },  // image
    ])
    const s = await getUsageSummary('u1')
    expect(s.creditsUsedThisMonth).toBe(13)        // not 0
    expect(s.generationsThisMonth).toBe(3)
  })

  it('2. AI generations uses a populated source and is not stuck at 0', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ monthlyGenerations: 12 })
    mockPrisma.creditTransaction.count.mockResolvedValue(9)
    const s = await getUsageSummary('u1')
    expect(s.generationsTotal).toBe(12)            // max(monthlyGenerations, ledger debit count)
    expect(s.generationsTotal).toBeGreaterThan(0)
  })

  it('counts only rows returned by the settled-operation filter', async () => {
    mockPrisma.creditTransaction.findMany.mockResolvedValue([{ creditCost: 2 }])
    const s = await getUsageSummary('u1')
    expect(s.creditsUsedThisMonth).toBe(2)
    expect(s.generationsThisMonth).toBe(1)
    expect(mockPrisma.creditTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'SETTLED', creditCost: { gt: 0 } }),
      }),
    )
  })

  it('tracks economic usage for an unlimited-plan operation with no wallet debit', async () => {
    mockPrisma.creditTransaction.findMany.mockResolvedValue([{ creditCost: 8 }])
    const summary = await getUsageSummary('u1')
    expect(summary.creditsUsedThisMonth).toBe(8)
    expect(summary.generationsThisMonth).toBe(1)
  })

  it('3. is deterministic for a fixture (dashboard + analytics share it → consistent numbers)', async () => {
    mockPrisma.creditTransaction.findMany.mockResolvedValue([{ creditCost: 5 }])
    const a = await getUsageSummary('u1')
    const b = await getUsageSummary('u1')
    expect(a).toEqual(b)
    expect(a.creditsUsedThisMonth).toBe(5)
  })

  it('returns zeros gracefully on an empty ledger', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ monthlyGenerations: 0 })
    mockPrisma.creditTransaction.count.mockResolvedValue(0)
    mockPrisma.creditTransaction.findMany.mockResolvedValue([])
    const s = await getUsageSummary('u1')
    expect(s).toEqual({ generationsTotal: 0, generationsThisMonth: 0, creditsUsedThisMonth: 0 })
  })
})

describe('getMonthlyActivity', () => {
  it('returns one entry per month and buckets ledger spend into the current month', async () => {
    const now = new Date()
    mockPrisma.creditTransaction.findMany.mockResolvedValue([
      { creditCost: 8, createdAt: now },
      { creditCost: 2, createdAt: now },
    ])
    const months = await getMonthlyActivity('u1', 6)
    expect(months).toHaveLength(6)
    const current = months[months.length - 1]
    expect(current.month).toBe(now.getMonth() + 1)
    expect(current.generations).toBe(2)
    expect(current.creditsUsed).toBe(10)
  })

  it('excludes reserved and refunded rows through the settled-operation query', async () => {
    mockPrisma.creditTransaction.findMany.mockResolvedValue([])
    const months = await getMonthlyActivity('u1', 1)
    expect(months[0]).toMatchObject({ generations: 0, creditsUsed: 0 })
    expect(mockPrisma.creditTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'SETTLED', creditCost: { gt: 0 } }),
      }),
    )
  })
})
