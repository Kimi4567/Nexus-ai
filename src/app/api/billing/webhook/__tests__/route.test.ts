/**
 * B1d-c-1 — billing webhook provisionSubscription creates a parallel MONTHLY grant.
 *
 * On an ACTIVE paid provision (checkout.session.completed / customer.subscription.updated),
 * the existing aiCredits overwrite is unchanged AND a MONTHLY CreditGrant is created
 * for the cycle (idempotent), with prior non-purchased grants reset (except the new one).
 * Stripe + Prisma + email are mocked; no live billing.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockPrisma, tx, stripe, mockStripeHelpers } = vi.hoisted(() => {
  const tx = {
    subscription: { upsert: vi.fn() },
    user: { update: vi.fn() },
    creditGrant: { createMany: vi.fn(), updateMany: vi.fn() },
  }
  const stripe = {
    webhooks: { constructEvent: vi.fn() },
    subscriptions: { retrieve: vi.fn() },
  }
  return {
    tx,
    stripe,
    mockPrisma: {
      $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
      user: { findUnique: vi.fn() },
    },
    mockStripeHelpers: {
      isBillingConfigured: vi.fn(() => true),
      getStripeClient: vi.fn(() => stripe),
      billingNotConfiguredResponse: vi.fn(() => ({ error: 'not configured' })),
      planFromPriceId: vi.fn(() => 'pro'),
      PLAN_CREDITS: { free: 10, starter: 50, pro: 150, business: 500, agency: 500 } as Record<string, number>,
    },
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/stripe', () => mockStripeHelpers)
vi.mock('@/lib/email/resend', () => ({ sendUpgradeConfirmationEmail: vi.fn() }))

import { POST } from '../route'

const SECS_START = 1781800000
const SECS_END = 1784400000
const START_ISO = new Date(SECS_START * 1000).toISOString()
const SOURCE = `monthly:sub_1:${START_ISO}`

const stripeSub = (status = 'active') => ({
  id: 'sub_1',
  status,
  metadata: { userId: 'u1', plan: 'pro' },
  items: { data: [{ price: { id: 'price_1', unit_amount: 1500 } }] },
  customer: 'cus_1',
  current_period_start: SECS_START,
  current_period_end: SECS_END,
})

const makeReq = () =>
  ({
    headers: { get: (k: string) => (k === 'stripe-signature' ? 'sig' : null) },
    text: async () => 'rawbody',
  }) as any

beforeEach(() => {
  vi.clearAllMocks()
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
  delete process.env.RESEND_API_KEY // skip the upgrade-email branch
  tx.subscription.upsert.mockResolvedValue({})
  tx.user.update.mockResolvedValue({})
  tx.creditGrant.createMany.mockResolvedValue({ count: 1 })
  tx.creditGrant.updateMany.mockResolvedValue({ count: 0 })
  stripe.subscriptions.retrieve.mockResolvedValue(stripeSub('active'))
})

describe('billing webhook — B1d-c-1 MONTHLY grant on provision', () => {
  it('checkout.session.completed (active) overwrites aiCredits AND creates a MONTHLY grant + reset', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed', id: 'evt_1',
      data: { object: { mode: 'subscription', subscription: 'sub_1', metadata: { userId: 'u1', plan: 'pro' } } },
    })

    await POST(makeReq())

    // aiCredits overwrite unchanged (ACTIVE → 150).
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'u1' },
      data: expect.objectContaining({ subscriptionStatus: 'ACTIVE', aiCredits: 150 }),
    }))
    // MONTHLY grant created with correct shape.
    expect(tx.creditGrant.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({
        userId: 'u1', type: 'MONTHLY', amount: 150, remaining: 150,
        source: SOURCE, billingCycleId: SOURCE, status: 'ACTIVE',
      })],
      skipDuplicates: true,
    }))
    const arg = tx.creditGrant.createMany.mock.calls[0][0] as any
    expect(arg.data[0].expiresAt).toEqual(new Date(SECS_END * 1000))
    // Reset prior non-purchased EXCEPT the new MONTHLY (because it was created).
    expect(tx.creditGrant.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', status: 'ACTIVE', type: { not: 'PURCHASED' }, source: { not: SOURCE } },
      data: { status: 'RESET', remaining: 0 },
    })
  })

  it('customer.subscription.updated (active) creates a MONTHLY grant', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated', id: 'evt_2',
      data: { object: stripeSub('active') },
    })

    await POST(makeReq())

    expect(tx.creditGrant.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ type: 'MONTHLY', amount: 150, source: SOURCE })],
      skipDuplicates: true,
    }))
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ aiCredits: 150 }),
    }))
  })

  it('duplicate same-cycle provision does not reset again (createMany count 0)', async () => {
    tx.creditGrant.createMany.mockResolvedValueOnce({ count: 0 }) // grant already exists
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated', id: 'evt_3',
      data: { object: stripeSub('active') },
    })

    await POST(makeReq())

    expect(tx.creditGrant.updateMany).not.toHaveBeenCalled() // no second reset
  })

  it('non-active status (past_due) creates no MONTHLY grant and no aiCredits overwrite', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated', id: 'evt_4',
      data: { object: stripeSub('past_due') },
    })

    await POST(makeReq())

    expect(tx.creditGrant.createMany).not.toHaveBeenCalled()
    expect(tx.creditGrant.updateMany).not.toHaveBeenCalled()
    // user.update ran but WITHOUT an aiCredits key (ACTIVE-only condition).
    const data = (tx.user.update.mock.calls[0][0] as any).data
    expect(data.aiCredits).toBeUndefined()
    expect(data.subscriptionStatus).toBe('PAST_DUE')
  })
})
