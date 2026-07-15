/**
 * B1c-c-1 — refundCreditsForTransaction (wallet refund-to-source) tests.
 *
 * Restores a debit's allocations to their source grants, mints a short-lived
 * REFUND grant for unavailable sources, keeps the aiCredits cache exact, writes
 * a linked REFUND ledger row, and is idempotent. Prisma is mocked; no DB.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockPrisma, tx, state } = vi.hoisted(() => {
  const state = {
    debit: null as null | { id: string; userId: string; amount: number; creditCost: number; status: string },
    grants: [] as Array<{ id: string; amount: number; remaining: number; status: string; expiresAt: Date | null }>,
    allocs: [] as Array<{ creditGrantId: string; amount: number }>,
    existingRefund: null as null | { id: string },
  }
  const tx = {
    $queryRawUnsafe: vi.fn(async (sql: string) => {
      if (sql.includes('FROM "CreditTransaction"')) return state.debit ? [state.debit] : []
      if (sql.includes('FROM "CreditGrant"')) return state.grants
      return []
    }),
    creditTransaction: {
      findFirst: vi.fn(async () => state.existingRefund),
      create: vi.fn(async () => ({ id: 'refund_txn' })),
      update: vi.fn(async () => ({})),
    },
    creditTransactionGrantAllocation: { findMany: vi.fn(async () => state.allocs) },
    creditGrant: { update: vi.fn(async () => ({})), create: vi.fn(async () => ({ id: 'new_grant' })) },
    user: { update: vi.fn(async () => ({})) },
  }
  return {
    state,
    tx,
    mockPrisma: { $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)) },
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/email/resend', () => ({ sendCreditsLowEmail: vi.fn() }))

import { refundCreditsForTransaction } from '@/lib/credits'

const NOW = Date.now()
const days = (n: number) => new Date(NOW + n * 86_400_000)

beforeEach(() => {
  vi.clearAllMocks()
  state.debit = { id: 'debit_1', userId: 'u1', amount: -8, creditCost: 8, status: 'RESERVED' }
  state.grants = []
  state.allocs = []
  state.existingRefund = null
})

describe('refundCreditsForTransaction', () => {
  it('1. refunds a single-grant debit back to its source grant', async () => {
    state.debit = { id: 'd1', userId: 'u1', amount: -3, creditCost: 3, status: 'RESERVED' }
    state.allocs = [{ creditGrantId: 'g1', amount: 3 }]
    state.grants = [{ id: 'g1', amount: 50, remaining: 47, status: 'ACTIVE', expiresAt: null }]

    await refundCreditsForTransaction({ userId: 'u1', transactionId: 'd1' })

    expect(tx.creditGrant.update).toHaveBeenCalledWith({ where: { id: 'g1' }, data: { remaining: { increment: 3 } } })
    expect(tx.creditGrant.create).not.toHaveBeenCalled()
  })

  it('2. refunds a split-grant debit to both source grants', async () => {
    state.debit = { id: 'd1', userId: 'u1', amount: -8, creditCost: 8, status: 'RESERVED' }
    state.allocs = [{ creditGrantId: 'g1', amount: 5 }, { creditGrantId: 'g2', amount: 3 }]
    state.grants = [
      { id: 'g1', amount: 50, remaining: 45, status: 'ACTIVE', expiresAt: days(30) },
      { id: 'g2', amount: 50, remaining: 47, status: 'ACTIVE', expiresAt: null },
    ]

    await refundCreditsForTransaction({ userId: 'u1', transactionId: 'd1' })

    expect(tx.creditGrant.update).toHaveBeenCalledTimes(2)
    expect(tx.creditGrant.update).toHaveBeenCalledWith({ where: { id: 'g1' }, data: { remaining: { increment: 5 } } })
    expect(tx.creditGrant.update).toHaveBeenCalledWith({ where: { id: 'g2' }, data: { remaining: { increment: 3 } } })
  })

  it('3. increments the aiCredits cache by the exact refund total', async () => {
    state.debit = { id: 'd1', userId: 'u1', amount: -8, creditCost: 8, status: 'RESERVED' }
    state.allocs = [{ creditGrantId: 'g1', amount: 5 }, { creditGrantId: 'g2', amount: 3 }]
    state.grants = [
      { id: 'g1', amount: 50, remaining: 45, status: 'ACTIVE', expiresAt: null },
      { id: 'g2', amount: 50, remaining: 47, status: 'ACTIVE', expiresAt: null },
    ]

    await refundCreditsForTransaction({ userId: 'u1', transactionId: 'd1' })

    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { aiCredits: { increment: 8 } } })
  })

  it('4. writes a REFUND transaction linked to the original debit', async () => {
    state.debit = { id: 'd1', userId: 'u1', amount: -3, creditCost: 3, status: 'RESERVED' }
    state.allocs = [{ creditGrantId: 'g1', amount: 3 }]
    state.grants = [{ id: 'g1', amount: 50, remaining: 47, status: 'ACTIVE', expiresAt: null }]

    await refundCreditsForTransaction({ userId: 'u1', transactionId: 'd1', reason: 'boom' })

    expect(tx.creditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u1', action: 'REFUND', amount: 3,
          entityId: 'd1', entityType: 'credit_transaction',
        }),
      }),
    )
  })

  it('5. is idempotent — a second refund of the same debit no-ops', async () => {
    state.debit = { id: 'd1', userId: 'u1', amount: -3, creditCost: 3, status: 'RESERVED' }
    state.existingRefund = { id: 'already' }

    await refundCreditsForTransaction({ userId: 'u1', transactionId: 'd1' })

    expect(tx.creditGrant.update).not.toHaveBeenCalled()
    expect(tx.creditGrant.create).not.toHaveBeenCalled()
    expect(tx.user.update).not.toHaveBeenCalled()
    expect(tx.creditTransaction.create).not.toHaveBeenCalled()
  })

  it('6. expired source grant → mints a REFUND grant with 14-day expiry, no restore', async () => {
    state.debit = { id: 'd1', userId: 'u1', amount: -8, creditCost: 8, status: 'RESERVED' }
    state.allocs = [{ creditGrantId: 'g1', amount: 8 }]
    state.grants = [{ id: 'g1', amount: 50, remaining: 0, status: 'ACTIVE', expiresAt: days(-1) }]

    await refundCreditsForTransaction({ userId: 'u1', transactionId: 'd1' })

    expect(tx.creditGrant.update).not.toHaveBeenCalled()
    const arg = (tx.creditGrant.create.mock.calls as any[])[0][0]
    expect(arg.data).toMatchObject({ userId: 'u1', type: 'REFUND', status: 'ACTIVE', amount: 8, remaining: 8, source: 'refund:credit_transaction:d1' })
    const expMs = arg.data.expiresAt.getTime()
    expect(expMs).toBeGreaterThan(NOW + 13 * 86_400_000)
    expect(expMs).toBeLessThan(NOW + 15 * 86_400_000)
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { aiCredits: { increment: 8 } } })
  })

  it('7. no allocations → fallback REFUND grant for the absolute debit amount', async () => {
    state.debit = { id: 'd1', userId: 'u1', amount: -6, creditCost: 6, status: 'RESERVED' }
    state.allocs = []

    await refundCreditsForTransaction({ userId: 'u1', transactionId: 'd1' })

    expect(tx.creditGrant.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'REFUND', amount: 6, remaining: 6 }) }),
    )
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { aiCredits: { increment: 6 } } })
  })

  it('8. missing debit → no-op', async () => {
    state.debit = null

    await refundCreditsForTransaction({ userId: 'u1', transactionId: 'missing' })

    expect(tx.creditGrant.update).not.toHaveBeenCalled()
    expect(tx.creditGrant.create).not.toHaveBeenCalled()
    expect(tx.user.update).not.toHaveBeenCalled()
    expect(tx.creditTransaction.create).not.toHaveBeenCalled()
  })

  it('9. non-debit (amount >= 0) or wrong-owner → no-op', async () => {
    state.debit = { id: 'd1', userId: 'u1', amount: 5, creditCost: 0, status: 'SETTLED' } // positive = not a debit
    await refundCreditsForTransaction({ userId: 'u1', transactionId: 'd1' })
    expect(tx.user.update).not.toHaveBeenCalled()

    vi.clearAllMocks()
    state.debit = { id: 'd1', userId: 'someone_else', amount: -3, creditCost: 3, status: 'RESERVED' } // wrong owner
    await refundCreditsForTransaction({ userId: 'u1', transactionId: 'd1' })
    expect(tx.user.update).not.toHaveBeenCalled()
  })

  it('10. never throws outward even if a write fails', async () => {
    state.debit = { id: 'd1', userId: 'u1', amount: -3, creditCost: 3, status: 'RESERVED' }
    state.allocs = [{ creditGrantId: 'g1', amount: 3 }]
    state.grants = [{ id: 'g1', amount: 50, remaining: 47, status: 'ACTIVE', expiresAt: null }]
    tx.user.update.mockRejectedValueOnce(new Error('db down'))

    await expect(refundCreditsForTransaction({ userId: 'u1', transactionId: 'd1' })).resolves.toEqual({
      ok: false,
      status: 'failed',
      error: 'db down',
    })
  })
})
