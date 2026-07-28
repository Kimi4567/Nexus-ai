/**
 * B1d-c-1 — billing webhook provisionSubscription creates a parallel MONTHLY grant.
 *
 * On a verified paid provision (checkout.session.completed / invoice paid),
 * the existing aiCredits overwrite is unchanged AND a MONTHLY CreditGrant is created
 * for the cycle (idempotent), with prior MONTHLY grants reset (except the new one).
 * Stripe + Prisma + email are mocked; no live billing.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockPrisma, tx, stripe, mockStripeHelpers } = vi.hoisted(() => {
  const tx = {
    subscription: { upsert: vi.fn(), updateMany: vi.fn() },
    user: { update: vi.fn() },
    creditGrant: {
      createMany: vi.fn(),
      updateMany: vi.fn(),
      aggregate: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    creditTransaction: { create: vi.fn(), aggregate: vi.fn() },
  }
  const stripe = {
    webhooks: { constructEvent: vi.fn() },
    subscriptions: { retrieve: vi.fn() },
    invoices: { retrieve: vi.fn() },
    paymentIntents: { retrieve: vi.fn() },
  }
  return {
    tx,
    stripe,
    mockPrisma: {
      $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
      user: { findUnique: vi.fn(), update: vi.fn() },
      subscription: { findUnique: vi.fn(), updateMany: vi.fn() },
      billingWebhookEvent: {
        createMany: vi.fn(),
        findUnique: vi.fn(),
        updateMany: vi.fn(),
        update: vi.fn(),
      },
    },
    mockStripeHelpers: {
      isBillingConfigured: vi.fn(() => true),
      getStripeClient: vi.fn(() => stripe),
      billingNotConfiguredResponse: vi.fn(() => ({ error: 'not configured' })),
      resolveStripeSubscriptionPlan: vi.fn<(priceId: string, plan?: unknown) => string | null>(() => 'pro'),
      PLAN_CREDITS: { free: 15, starter: 50, pro: 60, business: 180, agency: 180 } as Record<string, number>,
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
  mockStripeHelpers.PLAN_CREDITS.pro = 60
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
  delete process.env.RESEND_API_KEY // skip the upgrade-email branch
  tx.subscription.upsert.mockResolvedValue({})
  tx.user.update.mockResolvedValue({})
  tx.creditGrant.createMany.mockResolvedValue({ count: 1 })
  tx.creditGrant.updateMany.mockResolvedValue({ count: 0 })
  tx.creditGrant.aggregate.mockResolvedValue({ _sum: { remaining: 125 } })
  tx.creditGrant.findFirst.mockResolvedValue({ id: 'grant_purchase', remaining: 300 })
  tx.creditGrant.update.mockResolvedValue({})
  tx.creditTransaction.create.mockResolvedValue({ id: 'ct_pack' })
  tx.creditTransaction.aggregate.mockResolvedValue({ _sum: { creditCost: 0 } })
  tx.subscription.updateMany.mockResolvedValue({ count: 1 })
  mockPrisma.user.update.mockResolvedValue({})
  mockPrisma.user.findUnique.mockResolvedValue(null)
  mockPrisma.subscription.findUnique.mockResolvedValue(null)
  mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 })
  mockPrisma.billingWebhookEvent.createMany.mockResolvedValue({ count: 1 })
  mockPrisma.billingWebhookEvent.findUnique.mockResolvedValue(null)
  mockPrisma.billingWebhookEvent.updateMany.mockResolvedValue({ count: 1 })
  mockPrisma.billingWebhookEvent.update.mockResolvedValue({})
  stripe.subscriptions.retrieve.mockResolvedValue(stripeSub('active'))
  stripe.invoices.retrieve.mockResolvedValue({
    id: 'in_subscription_refund',
    subscription: 'sub_1',
    period_start: SECS_START,
    amount_paid: 9_900,
    currency: 'usd',
  })
  stripe.paymentIntents.retrieve.mockResolvedValue({
    id: 'pi_subscription_refund',
    invoice: 'in_subscription_refund',
  })
})

describe('billing webhook — event idempotency', () => {
  it('acknowledges an already processed Stripe event without applying it again', async () => {
    mockPrisma.billingWebhookEvent.createMany.mockResolvedValueOnce({ count: 0 })
    mockPrisma.billingWebhookEvent.findUnique.mockResolvedValueOnce({ status: 'PROCESSED' })
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated', id: 'evt_duplicate',
      created: SECS_START,
      data: { object: stripeSub('active') },
    })

    const response = await POST(makeReq())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ received: true, duplicate: true })
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('returns retryable failure while another worker holds the event lease', async () => {
    mockPrisma.billingWebhookEvent.createMany.mockResolvedValueOnce({ count: 0 })
    mockPrisma.billingWebhookEvent.findUnique.mockResolvedValueOnce({
      status: 'PROCESSING',
      updatedAt: new Date(),
    })
    mockPrisma.billingWebhookEvent.updateMany.mockResolvedValueOnce({ count: 0 })
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated', id: 'evt_processing',
      created: SECS_START,
      data: { object: stripeSub('active') },
    })

    const response = await POST(makeReq())

    expect(response.status).toBe(503)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })
})

describe('billing webhook — B1d-c-1 MONTHLY grant on provision', () => {
  it('fails closed when the Stripe price and declared plan cannot be resolved', async () => {
    mockStripeHelpers.resolveStripeSubscriptionPlan.mockReturnValueOnce(null)
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated', id: 'evt_unknown_price',
      data: { object: stripeSub('active') },
    })

    const response = await POST(makeReq())

    expect(response.status).toBe(500)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    expect(tx.creditGrant.createMany).not.toHaveBeenCalled()
    expect(mockPrisma.billingWebhookEvent.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'evt_unknown_price', status: 'PROCESSING' },
      data: expect.objectContaining({ status: 'FAILED' }),
    }))
  })

  it('checkout.session.completed syncs entitlement but waits for invoice.paid before granting credits', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed', id: 'evt_1',
      data: { object: { mode: 'subscription', subscription: 'sub_1', metadata: { userId: 'u1', plan: 'pro' } } },
    })

    await POST(makeReq())

    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'u1' },
      data: expect.objectContaining({ subscriptionStatus: 'ACTIVE' }),
    }))
    const update = (tx.user.update.mock.calls[0][0] as any).data
    expect(update.aiCredits).toBeUndefined()
    expect(tx.creditGrant.createMany).not.toHaveBeenCalled()
    expect(tx.creditGrant.updateMany).not.toHaveBeenCalled()
  })

  it('customer.subscription.updated (active) syncs entitlement state without re-granting credits', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated', id: 'evt_2',
      data: { object: stripeSub('active') },
    })

    await POST(makeReq())

    expect(tx.creditGrant.createMany).not.toHaveBeenCalled()
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ subscriptionStatus: 'ACTIVE' }),
    }))
    const update = (tx.user.update.mock.calls[0][0] as any).data
    expect(update.aiCredits).toBeUndefined()
  })

  it('accepts Stripe period dates from the subscription item shape', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      id: 'evt_item_periods',
      data: {
        object: {
          ...stripeSub('active'),
          current_period_start: undefined,
          current_period_end: undefined,
          items: {
            data: [{
              price: { id: 'price_1', unit_amount: 1500 },
              current_period_start: SECS_START,
              current_period_end: SECS_END,
            }],
          },
        },
      },
    })

    await POST(makeReq())

    expect(tx.subscription.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        currentPeriodStart: new Date(SECS_START * 1000),
        currentPeriodEnd: new Date(SECS_END * 1000),
      }),
    }))
    expect(tx.creditGrant.createMany).not.toHaveBeenCalled()
  })

  it('retrieves Stripe truth when an update event omits period dates', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      id: 'evt_missing_periods',
      data: {
        object: {
          ...stripeSub('active'),
          current_period_start: undefined,
          current_period_end: undefined,
        },
      },
    })

    await POST(makeReq())

    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_1', {
      expand: ['items.data.price'],
    })
    expect(tx.subscription.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        currentPeriodStart: new Date(SECS_START * 1000),
        currentPeriodEnd: new Date(SECS_END * 1000),
      }),
    }))
  })

  it('subscription metadata/status updates never mutate the monthly grant ledger', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated', id: 'evt_3',
      data: { object: stripeSub('active') },
    })

    await POST(makeReq())

    expect(tx.creditGrant.createMany).not.toHaveBeenCalled()
    expect(tx.creditGrant.updateMany).not.toHaveBeenCalled()
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

  it.each(['incomplete', 'unpaid', 'paused'])('%s never provisions paid access or monthly credits', async (status) => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated', id: `evt_${status}`,
      data: { object: stripeSub(status) },
    })

    await POST(makeReq())

    const data = (tx.user.update.mock.calls[0][0] as any).data
    expect(data.subscriptionStatus).toBe('PAST_DUE')
    expect(data.aiCredits).toBeUndefined()
    expect(tx.creditGrant.createMany).not.toHaveBeenCalled()
  })

  it('stores a scheduled cancellation date while access remains active through period end', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated', id: 'evt_cancel_scheduled',
      data: { object: {
        ...stripeSub('active'),
        cancel_at_period_end: true,
        cancel_at: SECS_END,
      } },
    })

    await POST(makeReq())

    expect(tx.subscription.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        status: 'ACTIVE',
        cancelledAt: new Date(SECS_END * 1000),
      }),
    }))
  })
})

describe('billing webhook — one-time credit packs', () => {
  it('fulfils a server-priced custom wallet purchase', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed', id: 'evt_wallet',
      data: { object: {
        id: 'cs_wallet_1',
        mode: 'payment',
        client_reference_id: 'u1',
        payment_status: 'paid',
        currency: 'usd',
        amount_subtotal: 26_000,
        amount_total: 26_000,
        payment_intent: 'pi_wallet_1',
        created: SECS_START,
        metadata: {
          kind: 'credit_wallet_purchase',
          userId: 'u1',
          credits: '300',
          amountCents: '26000',
          pricingVersion: '2026-07-16-v2',
        },
      } },
    })

    await POST(makeReq())

    expect(tx.creditGrant.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({
        userId: 'u1', type: 'PURCHASED', amount: 300, remaining: 300,
        source: 'stripe:checkout:cs_wallet_1', status: 'ACTIVE',
      })],
      skipDuplicates: true,
    }))
    expect(tx.creditTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'CREDIT_PACK_PURCHASE', amount: 300 }),
    }))
  })

  it('refuses custom wallet purchases when the paid total does not match the signed quote', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed', id: 'evt_wallet_bad',
      data: { object: {
        id: 'cs_wallet_bad', mode: 'payment', client_reference_id: 'u1',
        payment_status: 'paid', currency: 'usd', amount_subtotal: 26_000,
        amount_total: 1, payment_intent: 'pi_wallet_bad', created: SECS_START,
        metadata: {
          kind: 'credit_wallet_purchase', userId: 'u1', credits: '300',
          amountCents: '26000', pricingVersion: '2026-07-16-v2',
        },
      } },
    })

    await POST(makeReq())
    expect(tx.creditGrant.createMany).not.toHaveBeenCalled()
    expect(tx.creditTransaction.create).not.toHaveBeenCalled()
  })

  it('fulfils a paid trusted pack idempotently into PURCHASED credits', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed', id: 'evt_pack',
      data: { object: {
        id: 'cs_pack_1',
        mode: 'payment',
        payment_status: 'paid',
        amount_subtotal: 2900,
        created: SECS_START,
        metadata: { kind: 'credit_pack', userId: 'u1', packId: 'boost-100' },
      } },
    })

    await POST(makeReq())

    expect(tx.creditGrant.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({
        userId: 'u1', type: 'PURCHASED', amount: 100, remaining: 100,
        source: 'stripe:checkout:cs_pack_1', status: 'ACTIVE',
      })],
      skipDuplicates: true,
    }))
    expect(tx.creditTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'CREDIT_PACK_PURCHASE', amount: 100 }),
    }))
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { aiCredits: 125 } })
  })

  it('revokes only the purchased grant when Stripe fully refunds a wallet purchase', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'charge.refunded', id: 'evt_refund_wallet',
      data: { object: {
        id: 'ch_wallet_1',
        amount: 26_000,
        amount_refunded: 26_000,
        currency: 'usd',
        payment_intent: 'pi_wallet_1',
        metadata: {
          kind: 'credit_wallet_purchase',
          userId: 'u1',
          credits: '300',
          amountCents: '26000',
          pricingVersion: '2026-07-16-v2',
        },
      } },
    })

    const response = await POST(makeReq())

    expect(response.status).toBe(200)
    expect(tx.creditGrant.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'u1',
        type: 'PURCHASED',
        billingCycleId: 'stripe:payment-intent:pi_wallet_1',
      }),
    }))
    expect(tx.creditGrant.update).toHaveBeenCalledWith({
      where: { id: 'grant_purchase' },
      data: { remaining: 0, status: 'VOID' },
    })
    expect(tx.creditTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'CREDIT_PURCHASE_REFUND',
        amount: -300,
        entityId: 'ch_wallet_1',
        operationKey: 'stripe-refund:evt_refund_wallet',
      }),
    }))
  })

  it('reconciles a subscription invoice refund against only that cycle monthly grant', async () => {
    tx.creditGrant.findFirst.mockResolvedValueOnce({
      id: 'grant_monthly', amount: 180, remaining: 180, status: 'ACTIVE',
    })
    stripe.invoices.retrieve.mockResolvedValueOnce({
      id: 'in_subscription_refund',
      subscription: 'sub_1',
      // Root invoice period deliberately differs from the service line.
      period_start: SECS_START - 86_400,
      period_end: SECS_END - 86_400,
      amount_paid: 9_900,
      currency: 'usd',
      lines: {
        data: [{
          type: 'subscription',
          proration: false,
          subscription: 'sub_1',
          period: { start: SECS_START, end: SECS_END },
        }],
      },
    })
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'charge.refunded', id: 'evt_refund_subscription',
      data: { object: {
        id: 'ch_subscription_1',
        amount: 9_900,
        amount_refunded: 4_950,
        currency: 'usd',
        invoice: 'in_subscription_refund',
        metadata: {},
      } },
    })

    const response = await POST(makeReq())

    expect(response.status).toBe(200)
    expect(stripe.invoices.retrieve).toHaveBeenCalledWith('in_subscription_refund')
    expect(tx.creditGrant.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'u1',
        type: 'MONTHLY',
        billingCycleId: SOURCE,
      },
      select: { id: true, amount: true, remaining: true, status: true },
    })
    expect(tx.creditGrant.update).toHaveBeenCalledWith({
      where: { id: 'grant_monthly' },
      data: { remaining: 90 },
    })
    expect(tx.creditTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'SUBSCRIPTION_INVOICE_REFUND',
        amount: -90,
        creditCost: 90,
        entityId: 'ch_subscription_1',
        operationKey: 'stripe-invoice-refund:evt_refund_subscription',
      }),
    }))
    expect(tx.subscription.upsert).not.toHaveBeenCalled()
    expect(tx.subscription.updateMany).not.toHaveBeenCalled()
  })

  it('resolves the subscription invoice through the PaymentIntent when Charge.invoice is omitted', async () => {
    tx.creditGrant.findFirst.mockResolvedValueOnce({
      id: 'grant_monthly', amount: 60, remaining: 60, status: 'ACTIVE',
    })
    stripe.invoices.retrieve.mockResolvedValueOnce({
      id: 'in_subscription_refund',
      subscription: 'sub_1',
      period_start: SECS_START,
      amount_paid: 4_900,
      currency: 'usd',
    })
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'charge.refunded', id: 'evt_refund_subscription_payment_intent',
      data: { object: {
        id: 'ch_subscription_payment_intent',
        amount: 4_900,
        amount_refunded: 2_450,
        currency: 'usd',
        invoice: null,
        payment_intent: 'pi_subscription_refund',
        metadata: {},
      } },
    })

    const response = await POST(makeReq())

    expect(response.status).toBe(200)
    expect(stripe.paymentIntents.retrieve).toHaveBeenCalledWith('pi_subscription_refund')
    expect(stripe.invoices.retrieve).toHaveBeenCalledWith('in_subscription_refund')
    expect(tx.creditGrant.update).toHaveBeenCalledWith({
      where: { id: 'grant_monthly' },
      data: { remaining: 30 },
    })
    expect(tx.creditTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'SUBSCRIPTION_INVOICE_REFUND',
        amount: -30,
        creditCost: 30,
        entityId: 'ch_subscription_payment_intent',
      }),
    }))
  })

  it('refuses an unpaid or amount-mismatched pack', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed', id: 'evt_bad_pack',
      data: { object: {
        id: 'cs_bad', mode: 'payment', payment_status: 'unpaid', amount_subtotal: 1,
        created: SECS_START,
        metadata: { kind: 'credit_pack', userId: 'u1', packId: 'boost-100' },
      } },
    })

    await POST(makeReq())
    expect(tx.creditGrant.createMany).not.toHaveBeenCalled()
    expect(tx.creditTransaction.create).not.toHaveBeenCalled()
  })
})

// ── B1d-c-2 — invoice.payment_succeeded renewal MONTHLY grant ───────────────
describe('billing webhook — B1d-c-2 renewal MONTHLY grant', () => {
  const invoiceEvent = (id: string) => ({
    type: 'invoice.payment_succeeded', id,
    data: { object: { subscription: 'sub_1' } },
  })

  it('renewal overwrites aiCredits AND creates a MONTHLY grant + reset', async () => {
    stripe.webhooks.constructEvent.mockReturnValue(invoiceEvent('inv_1'))

    await POST(makeReq())

    // aiCredits overwrite follows the Growth monthly allowance.
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'u1' },
      data: expect.objectContaining({ subscriptionStatus: 'ACTIVE', aiCredits: 60 }),
    }))
    // MONTHLY grant with correct source/billingCycleId/expiry/amount.
    expect(tx.creditGrant.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({
        userId: 'u1', type: 'MONTHLY', amount: 60, remaining: 60,
        source: SOURCE, billingCycleId: SOURCE, status: 'ACTIVE',
      })],
      skipDuplicates: true,
    }))
    const arg = tx.creditGrant.createMany.mock.calls[0][0] as any
    expect(arg.data[0].expiresAt).toEqual(new Date(SECS_END * 1000))
    // Reset prior MONTHLY EXCEPT the new cycle (created === true).
    expect(tx.creditGrant.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', status: 'ACTIVE', type: { in: ['MONTHLY', 'MIGRATED'] }, source: { not: SOURCE } },
      data: { status: 'RESET', remaining: 0 },
    })
  })

  it('duplicate same-cycle invoice does not duplicate the grant and only retires leftover MIGRATED credit', async () => {
    tx.creditGrant.createMany.mockResolvedValueOnce({ count: 0 }) // already exists
    stripe.webhooks.constructEvent.mockReturnValue(invoiceEvent('inv_2'))

    await POST(makeReq())

    expect(tx.creditGrant.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', status: 'ACTIVE', type: 'MIGRATED' },
      data: { status: 'RESET', remaining: 0 },
    })
  })

  it('unlimited (credits -1) sets aiCredits 999999 but creates no MONTHLY grant', async () => {
    mockStripeHelpers.PLAN_CREDITS.pro = -1
    stripe.webhooks.constructEvent.mockReturnValue(invoiceEvent('inv_3'))

    await POST(makeReq())

    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ subscriptionStatus: 'ACTIVE', aiCredits: 999999 }),
    }))
    expect(tx.creditGrant.createMany).not.toHaveBeenCalled()
  })

  it('missing invoice.subscription → no transaction, no grant', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'invoice.payment_succeeded', id: 'inv_4', data: { object: {} },
    })

    await POST(makeReq())

    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    expect(tx.creditGrant.createMany).not.toHaveBeenCalled()
  })

  it('missing userId on the subscription → no transaction, no grant', async () => {
    stripe.subscriptions.retrieve.mockResolvedValueOnce({ ...stripeSub('active'), metadata: {} })
    stripe.webhooks.constructEvent.mockReturnValue(invoiceEvent('inv_5'))

    await POST(makeReq())

    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('supports Stripe invoice.paid as the authoritative renewal event', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'invoice.paid', id: 'evt_invoice_paid',
      data: {
        object: {
          id: 'in_paid',
          subscription: 'sub_1',
          period_start: SECS_START,
          period_end: SECS_END,
        },
      },
    })

    const response = await POST(makeReq())

    expect(response.status).toBe(200)
    expect(tx.subscription.upsert).toHaveBeenCalled()
    expect(tx.creditGrant.createMany).toHaveBeenCalled()
  })

  it('uses the paid invoice cycle when the subscription has already advanced', async () => {
    const invoiceStart = SECS_START - 86_400
    const invoiceEnd = SECS_END - 86_400
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'invoice.paid',
      id: 'evt_historical_invoice',
      data: {
        object: {
          id: 'in_historical',
          subscription: 'sub_1',
          period_start: SECS_START,
          period_end: SECS_END,
          lines: {
            data: [{
              type: 'subscription',
              proration: false,
              subscription: 'sub_1',
              period: { start: invoiceStart, end: invoiceEnd },
            }],
          },
        },
      },
    })

    await POST(makeReq())

    const source = `monthly:sub_1:${new Date(invoiceStart * 1000).toISOString()}`
    expect(tx.creditGrant.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({
        source,
        billingCycleId: source,
        expiresAt: new Date(invoiceEnd * 1000),
      })],
    }))
  })

  it('invalid/missing current_period dates → aiCredits still overwritten, grant skipped', async () => {
    stripe.subscriptions.retrieve.mockResolvedValueOnce({
      ...stripeSub('active'),
      current_period_start: undefined,
      current_period_end: undefined,
    })
    stripe.webhooks.constructEvent.mockReturnValue(invoiceEvent('inv_6'))

    await POST(makeReq())

    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ subscriptionStatus: 'ACTIVE', aiCredits: 60 }),
    }))
    expect(tx.creditGrant.createMany).not.toHaveBeenCalled() // grant safely skipped
  })

  it('invoice.payment_failed does not create or reset any grant', async () => {
    stripe.subscriptions.retrieve.mockResolvedValueOnce(stripeSub('past_due'))
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'invoice.payment_failed', id: 'inv_7', data: { object: { subscription: 'sub_1' } },
    })

    await POST(makeReq())

    expect(tx.creditGrant.createMany).not.toHaveBeenCalled()
    expect(tx.creditGrant.updateMany).not.toHaveBeenCalled()
  })
})

// ── B1d-c-3 — subscription.deleted voids monthly grants ────────────────────
describe('billing webhook — B1d-c-3 cancellation voids grants', () => {
  const deletedEvent = () => ({
    type: 'customer.subscription.deleted', id: 'evt_del',
    data: { object: { id: 'sub_1', metadata: { userId: 'u1' } } },
  })

  it('cancellation keeps aiCredits=0 AND voids ACTIVE MONTHLY grants', async () => {
    stripe.webhooks.constructEvent.mockReturnValue(deletedEvent())

    await POST(makeReq())

    // Existing cancel behavior unchanged.
    expect(tx.subscription.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'u1', stripeId: 'sub_1' },
      data: expect.objectContaining({ status: 'CANCELLED' }),
    }))
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'u1' },
      data: { subscriptionStatus: 'CANCELLED', aiCredits: 0 },
    }))
    // Only subscription MONTHLY grants are voided; independent balances survive.
    expect(tx.creditGrant.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', status: 'ACTIVE', type: { in: ['MONTHLY', 'MIGRATED'] } },
      data: { status: 'VOID', remaining: 0 },
    })
    // No grant creation on cancel.
    expect(tx.creditGrant.createMany).not.toHaveBeenCalled()
  })

  it('missing userId → no transaction, no void', async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.deleted', id: 'evt_del2',
      data: { object: { id: 'sub_1', metadata: {} } },
    })

    await POST(makeReq())

    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    expect(tx.creditGrant.updateMany).not.toHaveBeenCalled()
  })

  it('recovers a legacy deleted subscription owner from the saved stripe subscription id', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValueOnce({ userId: 'u1' })
    stripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.deleted', id: 'evt_del_legacy',
      data: { object: { ...stripeSub('canceled'), metadata: {} } },
    })

    const response = await POST(makeReq())

    expect(response.status).toBe(200)
    expect(tx.subscription.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'u1', stripeId: 'sub_1' },
    }))
  })

  it('repeat cancellation is idempotent (void matches nothing)', async () => {
    tx.creditGrant.updateMany.mockResolvedValueOnce({ count: 0 }) // already voided
    stripe.webhooks.constructEvent.mockReturnValue(deletedEvent())

    await POST(makeReq()) // must not throw

    expect(tx.user.update).toHaveBeenCalled()
  })
})
