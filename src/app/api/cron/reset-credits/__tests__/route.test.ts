/**
 * Billing-cycle reconciliation creates one idempotent MONTHLY grant and updates
 * the legacy scalar cache only when a genuinely new Stripe cycle is observed.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockPrisma, mockStripeHelpers } = vi.hoisted(() => ({
  mockPrisma: {
    subscription: { findMany: vi.fn() },
    user: { update: vi.fn() },
    creditGrant: { createMany: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
  mockStripeHelpers: {
    PLAN_CREDITS: { starter: 50, pro: 150, business: 500, agency: 500 } as Record<string, number>,
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/stripe', () => mockStripeHelpers)

import { GET } from '../route'

const START = new Date('2026-06-01T00:00:00.000Z')
const END = new Date('2026-07-01T00:00:00.000Z')
const SOURCE = 'monthly:sub_1:2026-06-01T00:00:00.000Z'

const makeReq = (authorization = 'Bearer cron_secret') =>
  ({
    headers: { get: (key: string) => (key === 'authorization' ? authorization : null) },
  }) as any

const activeSub = (overrides: Record<string, unknown> = {}) => ({
  userId: 'u1',
  plan: 'PRO',
  monthlyCredits: 150,
  stripeId: 'sub_1',
  currentPeriodStart: START,
  currentPeriodEnd: END,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'cron_secret'
  delete process.env.CREDIT_WALLET_ENABLED
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma))
  mockPrisma.subscription.findMany.mockResolvedValue([activeSub()])
  mockPrisma.user.update.mockResolvedValue({})
  mockPrisma.creditGrant.createMany.mockResolvedValue({ count: 1 })
  mockPrisma.creditGrant.updateMany.mockResolvedValue({ count: 1 })
})

describe('cron/reset-credits — B1d-d grant-aware reset', () => {
  it('creates a MONTHLY grant for a valid active subscription cycle', async () => {
    const res = await GET(makeReq())
    const body = await res.json()

    expect(body).toMatchObject({ ok: true, processed: 1, reset: 1, errors: 0, grantsCreated: 1 })
    expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith({
      where: {
        status: 'ACTIVE',
        plan: { in: ['STARTER', 'PRO', 'BUSINESS', 'AGENCY'] },
      },
      select: {
        userId: true,
        plan: true,
        monthlyCredits: true,
        stripeId: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
      },
    })
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { aiCredits: 150 },
    })
    expect(mockPrisma.creditGrant.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({
        userId: 'u1',
        type: 'MONTHLY',
        amount: 150,
        remaining: 150,
        expiresAt: END,
        source: SOURCE,
        billingCycleId: SOURCE,
        status: 'ACTIVE',
      })],
      skipDuplicates: true,
    }))
  })

  it('dedupes an existing monthly grant and does not reset again', async () => {
    mockPrisma.creditGrant.createMany.mockResolvedValueOnce({ count: 0 })

    const res = await GET(makeReq())
    const body = await res.json()

    expect(body).toMatchObject({ ok: true, reset: 0, grantsCreated: 0, grantsSkipped: 1 })
    expect(mockPrisma.creditGrant.createMany).toHaveBeenCalledTimes(1)
    expect(mockPrisma.creditGrant.updateMany).not.toHaveBeenCalled()
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it('leaves PURCHASED grants untouched by resetting only non-purchased grants', async () => {
    await GET(makeReq())

    expect(mockPrisma.creditGrant.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', status: 'ACTIVE', type: { not: 'PURCHASED' }, source: { not: SOURCE } },
      data: { status: 'RESET', remaining: 0 },
    })
  })

  it('resets prior ACTIVE non-PURCHASED grants only when a new monthly grant is created', async () => {
    await GET(makeReq())
    expect(mockPrisma.creditGrant.updateMany).toHaveBeenCalledTimes(1)

    vi.clearAllMocks()
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma))
    mockPrisma.subscription.findMany.mockResolvedValue([activeSub()])
    mockPrisma.user.update.mockResolvedValue({})
    mockPrisma.creditGrant.createMany.mockResolvedValue({ count: 0 })

    await GET(makeReq())
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
    expect(mockPrisma.creditGrant.updateMany).not.toHaveBeenCalled()
  })

  it('skips reconciliation when Stripe period data is missing without inventing a reset date', async () => {
    mockPrisma.subscription.findMany.mockResolvedValueOnce([
      activeSub({ currentPeriodStart: null, currentPeriodEnd: null }),
    ])

    const res = await GET(makeReq())
    const body = await res.json()

    expect(body).toMatchObject({ ok: true, reset: 0, errors: 0, grantsSkipped: 1 })
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
    expect(mockPrisma.creditGrant.createMany).not.toHaveBeenCalled()
    expect(mockPrisma.creditGrant.updateMany).not.toHaveBeenCalled()
  })

  it('fails safely when cycle-ledger reconciliation fails instead of minting scalar credit', async () => {
    delete process.env.CREDIT_WALLET_ENABLED
    mockPrisma.creditGrant.createMany.mockRejectedValueOnce(new Error('ledger unavailable'))

    const res = await GET(makeReq())
    const body = await res.json()

    expect(body).toMatchObject({ ok: true, reset: 0, errors: 1, grantErrors: 1 })
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it('does not change the existing active paid subscription selection', async () => {
    await GET(makeReq())

    const call = mockPrisma.subscription.findMany.mock.calls[0][0]
    expect(call.where).toEqual({
      status: 'ACTIVE',
      plan: { in: ['STARTER', 'PRO', 'BUSINESS', 'AGENCY'] },
    })
  })

  it('does not import or call billing webhook flows', async () => {
    await GET(makeReq())

    expect(mockPrisma.subscription.findMany).toHaveBeenCalledTimes(1)
    expect(mockPrisma.user.update).toHaveBeenCalledTimes(1)
    expect(mockPrisma.subscription).not.toHaveProperty('upsert')
    expect(mockPrisma.subscription).not.toHaveProperty('updateMany')
  })
})
