import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    creditTransaction: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/email/resend', () => ({ sendCreditsLowEmail: vi.fn() }))

import { checkAndDeductCredits, creditCheckHttpStatus } from '@/lib/credits'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('billable AI operation idempotency', () => {
  it('rejects a known operation before reading or changing the wallet', async () => {
    mockPrisma.creditTransaction.findUnique.mockResolvedValue({
      id: 'txn_existing',
      status: 'SETTLED',
      entityId: 'campaign_1',
      entityType: 'campaign',
    })

    const result = await checkAndDeductCredits('user_1', 'CAMPAIGN_GENERATION', undefined, {
      entityId: 'campaign_1',
      entityType: 'campaign',
      operationKey: 'scoped_hash',
    })

    expect(result).toMatchObject({
      ok: false,
      error: 'CREDIT_OPERATION_REPLAY',
      transactionId: 'txn_existing',
      operationStatus: 'SETTLED',
    })
    if (!result.ok) expect(creditCheckHttpStatus(result)).toBe(409)
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled()
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('turns a concurrent unique-key race into a replay response', async () => {
    mockPrisma.creditTransaction.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'txn_winner',
        status: 'RESERVED',
        entityId: 'campaign_1',
        entityType: 'campaign',
      })
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      subscriptionStatus: 'STARTER',
      aiCredits: 50,
      monthlyGenerations: 2,
      email: null,
      name: null,
    })
    mockPrisma.$transaction.mockRejectedValue({ code: 'P2002' })

    const result = await checkAndDeductCredits('user_1', 'CAMPAIGN_GENERATION', undefined, {
      entityId: 'campaign_1',
      entityType: 'campaign',
      operationKey: 'scoped_hash',
    })

    expect(result).toMatchObject({
      ok: false,
      error: 'CREDIT_OPERATION_REPLAY',
      transactionId: 'txn_winner',
      operationStatus: 'RESERVED',
    })
  })
})
