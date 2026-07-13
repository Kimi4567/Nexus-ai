/**
 * B1c-b — checkAndDeductCredits with the grant wallet flag ON.
 *
 * Verifies the grant-based path: grants are read (FOR UPDATE), drawn down in
 * order, allocation rows written, the User.aiCredits cache kept in exact sync,
 * and insufficient attempts only repair a stale scalar cache. Prisma + email are mocked;
 * no DB/network is touched. The pure ordering logic is covered in wallet.test.ts.
 *
 * Flag-OFF (default) behaviour stays covered byte-for-byte by credits.test.ts.
 */

import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest'

const { mockPrisma, tx } = vi.hoisted(() => {
  const tx = {
    $queryRawUnsafe: vi.fn(),
    creditGrant: { update: vi.fn() },
    user: { update: vi.fn() },
    creditTransaction: { create: vi.fn() },
    creditTransactionGrantAllocation: { createMany: vi.fn() },
  }
  return {
    tx,
    mockPrisma: {
      user: { findUnique: vi.fn(), update: vi.fn() },
      usage: { upsert: vi.fn() },
      $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    },
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/email/resend', () => ({
  sendCreditsLowEmail: vi.fn().mockResolvedValue(undefined),
}))

import { checkAndDeductCredits, CREDIT_COSTS } from '@/lib/credits'

const NOW = Date.now()
const days = (n: number) => new Date(NOW + n * 86_400_000)

function row(p: { id: string; remaining: number; type?: string; expiresAt?: Date | null }) {
  return {
    id: p.id,
    type: p.type ?? 'MONTHLY',
    remaining: p.remaining,
    expiresAt: p.expiresAt ?? null,
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00Z'),
  }
}

const ORIGINAL_FLAG = process.env.CREDIT_WALLET_ENABLED

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CREDIT_WALLET_ENABLED = 'true'
  tx.creditGrant.update.mockResolvedValue({})
  tx.user.update.mockResolvedValue({})
  tx.creditTransaction.create.mockResolvedValue({ id: 'txn_1' })
  tx.creditTransactionGrantAllocation.createMany.mockResolvedValue({ count: 1 })
  mockPrisma.usage.upsert.mockResolvedValue({})
})

afterAll(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.CREDIT_WALLET_ENABLED
  else process.env.CREDIT_WALLET_ENABLED = ORIGINAL_FLAG
})

function asStarter(aiCredits: number) {
  mockPrisma.user.findUnique.mockResolvedValue({
    id: 'u1', subscriptionStatus: 'STARTER', aiCredits,
    monthlyGenerations: 5, email: 'a@b.com', name: 'A',
  })
}

describe('checkAndDeductCredits — wallet flag ON', () => {
  it('1. deducts from a single grant', async () => {
    asStarter(50)
    tx.$queryRawUnsafe.mockResolvedValue([row({ id: 'g1', remaining: 50 })])

    const res = await checkAndDeductCredits('u1', 'IMAGE_GENERATION') // cost 3

    expect(res.ok).toBe(true)
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
    expect(tx.creditGrant.update).toHaveBeenCalledTimes(1)
    expect(tx.creditGrant.update).toHaveBeenCalledWith({
      where: { id: 'g1' },
      data: { remaining: { decrement: 3 } },
    })
  })

  it('2. deducts across multiple grants and writes multiple allocation rows', async () => {
    asStarter(50)
    tx.$queryRawUnsafe.mockResolvedValue([
      row({ id: 'g1', remaining: 5, expiresAt: days(10) }),
      row({ id: 'g2', remaining: 5, expiresAt: days(20) }),
    ])

    const res = await checkAndDeductCredits('u1', 'RUN_FULL_STRATEGY') // cost 8

    expect(res.ok).toBe(true)
    expect(tx.creditGrant.update).toHaveBeenCalledTimes(2)
    expect(tx.creditTransactionGrantAllocation.createMany).toHaveBeenCalledWith({
      data: [
        { creditTransactionId: 'txn_1', creditGrantId: 'g1', amount: 5 },
        { creditTransactionId: 'txn_1', creditGrantId: 'g2', amount: 3 },
      ],
    })
  })

  it('3. sets User.aiCredits from locked grant truth after the exact deduction', async () => {
    asStarter(50)
    tx.$queryRawUnsafe.mockResolvedValue([row({ id: 'g1', remaining: 50 })])

    await checkAndDeductCredits('u1', 'RUN_FULL_STRATEGY') // cost 8

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { aiCredits: 42, monthlyGenerations: { increment: 1 } },
    })
  })

  it('4. creates a CreditTransaction debit with the negative amount', async () => {
    asStarter(50)
    tx.$queryRawUnsafe.mockResolvedValue([row({ id: 'g1', remaining: 50 })])

    await checkAndDeductCredits('u1', 'IMAGE_GENERATION') // cost 3

    expect(tx.creditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'u1', action: 'IMAGE_GENERATION', amount: -3 }),
      }),
    )
  })

  it('5. writes allocation rows whose amounts sum to the cost', async () => {
    asStarter(50)
    tx.$queryRawUnsafe.mockResolvedValue([
      row({ id: 'g1', remaining: 2, expiresAt: days(5) }),
      row({ id: 'g2', remaining: 10, expiresAt: days(9) }),
    ])

    await checkAndDeductCredits('u1', 'IMAGE_GENERATION') // cost 3

    const arg = tx.creditTransactionGrantAllocation.createMany.mock.calls[0][0]
    const sum = arg.data.reduce((s: number, a: { amount: number }) => s + a.amount, 0)
    expect(sum).toBe(3)
    expect(arg.data).toEqual([
      { creditTransactionId: 'txn_1', creditGrantId: 'g1', amount: 2 },
      { creditTransactionId: 'txn_1', creditGrantId: 'g2', amount: 1 },
    ])
  })

  it('6. insufficient grants → no debit and stale scalar cache is repaired', async () => {
    asStarter(50) // cache lies high; the grants are the source of truth
    tx.$queryRawUnsafe.mockResolvedValue([row({ id: 'g1', remaining: 2 })])

    const res = await checkAndDeductCredits('u1', 'RUN_FULL_STRATEGY') // cost 8

    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error).toBe('INSUFFICIENT_CREDITS')
      expect(res.currentCredits).toBe(2)
    }
    expect(tx.creditGrant.update).not.toHaveBeenCalled()
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { aiCredits: 2 },
    })
    expect(tx.creditTransaction.create).not.toHaveBeenCalled()
    expect(tx.creditTransactionGrantAllocation.createMany).not.toHaveBeenCalled()
  })

  it('7. unlimited (aiCredits === -1) bypasses grant reads entirely', async () => {
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
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    expect(tx.$queryRawUnsafe).not.toHaveBeenCalled()
  })

  it('8. costOverride drives the deduction amount for variable strategy pricing', async () => {
    asStarter(100)
    tx.$queryRawUnsafe.mockResolvedValue([row({ id: 'g1', remaining: 100 })])

    const res = await checkAndDeductCredits('u1', 'RUN_FULL_STRATEGY', 18)

    expect(res.ok).toBe(true)
    if (res.ok) expect(res.creditsUsed).toBe(18)
    expect(tx.creditGrant.update).toHaveBeenCalledWith({
      where: { id: 'g1' },
      data: { remaining: { decrement: 18 } },
    })
  })

  it('9. ignores expired grants (only the live grant is drawn)', async () => {
    asStarter(50)
    tx.$queryRawUnsafe.mockResolvedValue([
      row({ id: 'expired', remaining: 100, expiresAt: days(-1) }),
      row({ id: 'live', remaining: 10 }),
    ])

    await checkAndDeductCredits('u1', 'RUN_FULL_STRATEGY') // cost 8

    expect(tx.creditGrant.update).toHaveBeenCalledTimes(1)
    expect(tx.creditGrant.update).toHaveBeenCalledWith({
      where: { id: 'live' },
      data: { remaining: { decrement: 8 } },
    })
  })

  it('10. preserves the existing success response shape + additive transactionId', async () => {
    asStarter(50)
    tx.$queryRawUnsafe.mockResolvedValue([row({ id: 'g1', remaining: 50 })])

    const res = await checkAndDeductCredits('u1', 'IMAGE_GENERATION') // cost 3

    expect(res).toEqual({
      ok: true,
      creditsRemaining: 50 - CREDIT_COSTS.IMAGE_GENERATION,
      creditsUsed: CREDIT_COSTS.IMAGE_GENERATION,
      isUnlimited: false,
      transactionId: 'txn_1',
    })
  })
})
