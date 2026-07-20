import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  refund: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { creditTransaction: { findMany: mocks.findMany } },
}))
vi.mock('@/lib/credits', () => ({ refundCreditsForTransaction: mocks.refund }))

import {
  CREDIT_RESERVATION_RECONCILE_LIMIT,
  CREDIT_RESERVATION_STALE_AFTER_MS,
  reconcileStaleCreditReservations,
} from '@/lib/credits/reconcileReservations'

describe('stale credit reservation reconciliation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('selects only reservations older than the safety timeout', async () => {
    mocks.findMany.mockResolvedValue([])
    const now = new Date('2026-07-20T12:00:00.000Z')

    await reconcileStaleCreditReservations(now)

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        status: 'RESERVED',
        createdAt: { lt: new Date(now.getTime() - CREDIT_RESERVATION_STALE_AFTER_MS) },
      },
      orderBy: { createdAt: 'asc' },
      take: CREDIT_RESERVATION_RECONCILE_LIMIT,
      select: { id: true, userId: true },
    })
  })

  it('refunds each stale reservation by exact transaction id and reports retries honestly', async () => {
    mocks.findMany.mockResolvedValue([
      { id: 'txn-1', userId: 'user-1' },
      { id: 'txn-2', userId: 'user-2' },
      { id: 'txn-3', userId: 'user-3' },
    ])
    mocks.refund
      .mockResolvedValueOnce({ ok: true, status: 'refunded' })
      .mockResolvedValueOnce({ ok: true, status: 'noop' })
      .mockResolvedValueOnce({ ok: false, status: 'failed', error: 'database_unavailable' })

    const result = await reconcileStaleCreditReservations(new Date('2026-07-20T12:00:00.000Z'))

    expect(mocks.refund).toHaveBeenNthCalledWith(1, {
      userId: 'user-1',
      transactionId: 'txn-1',
      reason: 'Automatic reconciliation for an abandoned AI credit reservation',
    })
    expect(result).toEqual({
      scanned: 3,
      refunded: 1,
      alreadyResolved: 1,
      failed: 1,
      failures: [{ transactionId: 'txn-3', error: 'database_unavailable' }],
    })
  })
})
