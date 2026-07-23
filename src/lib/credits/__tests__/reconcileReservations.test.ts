import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  refund: vi.fn(),
  visualFindUnique: vi.fn(),
  visualUpdateMany: vi.fn(),
  socialPostUpdateMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    creditTransaction: { findMany: mocks.findMany },
    generatedVisual: {
      findUnique: mocks.visualFindUnique,
      updateMany: mocks.visualUpdateMany,
    },
    socialPost: { updateMany: mocks.socialPostUpdateMany },
  },
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
      select: { id: true, userId: true, entityId: true, entityType: true },
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
      artifactsRepaired: 0,
      failed: 1,
      failures: [{ transactionId: 'txn-3', error: 'database_unavailable' }],
    })
  })

  it('closes an abandoned image audit row and its post after restoring the reservation', async () => {
    mocks.findMany.mockResolvedValue([{
      id: 'txn-image',
      userId: 'user-1',
      entityId: 'visual-1',
      entityType: 'generated_visual_image',
    }])
    mocks.refund.mockResolvedValue({ ok: true, status: 'refunded' })
    mocks.visualFindUnique.mockResolvedValue({
      id: 'visual-1',
      workspaceId: 'workspace-1',
      campaignId: 'campaign-1',
      parentId: 'social-post:post-1',
      status: 'GENERATING',
    })
    mocks.visualUpdateMany.mockResolvedValue({ count: 1 })
    mocks.socialPostUpdateMany.mockResolvedValue({ count: 1 })

    const result = await reconcileStaleCreditReservations(new Date('2026-07-20T12:00:00.000Z'))

    expect(mocks.visualUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'visual-1', status: 'GENERATING' },
      data: expect.objectContaining({
        status: 'FAILED',
        creditTransactionId: 'txn-image',
        qualityStatus: 'ERROR',
      }),
    }))
    expect(mocks.socialPostUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'post-1', imageUrl: null, uploadedMediaId: null }),
      data: expect.objectContaining({ generationStatus: 'FAILED' }),
    }))
    expect(result).toMatchObject({ refunded: 1, artifactsRepaired: 1, failed: 0 })
  })
})
