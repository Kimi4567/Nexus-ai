import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockPrisma, state, tx } = vi.hoisted(() => {
  const state = {
    row: null as null | {
      id: string
      userId: string
      action: string
      status: string
      creditCost: number
    },
  }
  const tx = {
    $queryRawUnsafe: vi.fn(async () => state.row ? [state.row] : []),
    creditTransaction: {
      update: vi.fn(async ({ data }: { data: { status: string } }) => {
        if (state.row) state.row.status = data.status
        return state.row
      }),
    },
    user: {
      update: vi.fn(async () => ({ aiCredits: 42, email: null, name: null })),
    },
  }
  const mockPrisma = {
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    usage: { upsert: vi.fn(async () => ({})) },
  }
  return { mockPrisma, state, tx }
})

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/email/resend', () => ({ sendCreditsLowEmail: vi.fn() }))

import { settleCreditDeduction } from '@/lib/credits'

const deduction = {
  ok: true as const,
  creditsRemaining: 42,
  creditsUsed: 8,
  isUnlimited: false,
  transactionId: 'txn_1',
  operationStatus: 'RESERVED' as const,
}

beforeEach(() => {
  vi.clearAllMocks()
  state.row = {
    id: 'txn_1',
    userId: 'user_1',
    action: 'RUN_FULL_STRATEGY',
    status: 'RESERVED',
    creditCost: 8,
  }
})

describe('credit reservation lifecycle', () => {
  it('settles a held debit and records successful usage exactly once', async () => {
    const result = await settleCreditDeduction({
      userId: 'user_1',
      action: 'RUN_FULL_STRATEGY',
      deduction,
    })

    expect(result).toEqual({ ok: true, status: 'settled' })
    expect(tx.creditTransaction.update).toHaveBeenCalledWith({
      where: { id: 'txn_1' },
      data: expect.objectContaining({ status: 'SETTLED', settledAt: expect.any(Date) }),
    })
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user_1' },
      data: { monthlyGenerations: { increment: 1 } },
    }))
    expect(mockPrisma.usage.upsert).toHaveBeenCalledTimes(1)
  })

  it('does not double-count an already settled operation', async () => {
    state.row!.status = 'SETTLED'

    const result = await settleCreditDeduction({
      userId: 'user_1',
      action: 'RUN_FULL_STRATEGY',
      deduction,
    })

    expect(result).toEqual({ ok: true, status: 'already_settled' })
    expect(tx.creditTransaction.update).not.toHaveBeenCalled()
    expect(tx.user.update).not.toHaveBeenCalled()
    expect(mockPrisma.usage.upsert).not.toHaveBeenCalled()
  })

  it('refuses to settle a reservation that was already refunded', async () => {
    state.row!.status = 'REFUNDED'

    const result = await settleCreditDeduction({
      userId: 'user_1',
      action: 'RUN_FULL_STRATEGY',
      deduction,
    })

    expect(result).toEqual({
      ok: false,
      status: 'failed',
      error: 'credit_reservation_already_refunded',
    })
    expect(tx.user.update).not.toHaveBeenCalled()
  })

  it('records economic usage for an unlimited-plan zero-debit reservation', async () => {
    const unlimitedDeduction = {
      ...deduction,
      creditsRemaining: -1,
      creditsUsed: 0,
      isUnlimited: true,
    }

    const result = await settleCreditDeduction({
      userId: 'user_1',
      action: 'RUN_FULL_STRATEGY',
      deduction: unlimitedDeduction,
    })

    expect(result).toEqual({ ok: true, status: 'settled' })
    expect(mockPrisma.usage.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ aiCreditsUsed: 8, generationsCount: 1 }),
    }))
  })
})
