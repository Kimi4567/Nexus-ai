import { beforeEach, describe, expect, it, vi } from 'vitest'

const { auth, prisma, stripe, stripeHelpers, rateLimit, databaseReadiness } = vi.hoisted(() => ({
  auth: { getUser: vi.fn() },
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    subscription: { findUnique: vi.fn() },
  },
  stripe: {
    customers: { create: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
  },
  stripeHelpers: {
    billingNotConfiguredResponse: vi.fn(() => ({ error: 'not configured' })),
    getStripeClient: vi.fn(),
    isBillingConfigured: vi.fn(() => true),
    STRIPE_PRICES: { pro: 'price_growth', business: 'price_autopilot' },
    validateSubscriptionStripePrice: vi.fn(),
  },
  rateLimit: vi.fn(() => true),
  databaseReadiness: vi.fn(),
}))

vi.mock('@/lib/supabaseAuth', () => ({ adminClient: { auth } }))
vi.mock('@/lib/prisma', () => ({ prisma }))
vi.mock('@/lib/stripe', () => stripeHelpers)
vi.mock('@/lib/dbRateLimit', () => ({ checkoutRateLimit: rateLimit }))
vi.mock('@/lib/requestBaseUrl', () => ({ getRequestBaseUrl: () => 'https://www.nexus-grow.com' }))
vi.mock('@/lib/billingDatabaseReadiness', () => ({
  getBillingDatabaseReadiness: databaseReadiness,
  billingDatabaseUnavailableResponse: () => ({
    error: 'migration required',
    code: 'BILLING_MIGRATION_REQUIRED',
  }),
}))

import { POST } from '../route'

const request = (plan: string, requestId = '73d6b695-3bd1-46ec-bcfe-44ccfe8a71a1') => ({
  headers: { get: (name: string) => name === 'authorization' ? 'Bearer token' : null },
  json: async () => ({ plan, requestId }),
}) as any

beforeEach(() => {
  vi.clearAllMocks()
  stripeHelpers.getStripeClient.mockReturnValue(stripe)
  stripeHelpers.isBillingConfigured.mockReturnValue(true)
  stripeHelpers.validateSubscriptionStripePrice.mockResolvedValue(false)
  auth.getUser.mockResolvedValue({ data: { user: { id: 'user_1' } }, error: null })
  databaseReadiness.mockResolvedValue({ ready: true, state: 'ready' })
  prisma.subscription.findUnique.mockResolvedValue(null)
})

describe('subscription checkout pricing truth', () => {
  it('fails closed before Stripe when the durable webhook ledger is missing', async () => {
    databaseReadiness.mockResolvedValue({ ready: false, state: 'migration_required' })

    const response = await POST(request('growth'))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.code).toBe('BILLING_MIGRATION_REQUIRED')
    expect(stripeHelpers.validateSubscriptionStripePrice).not.toHaveBeenCalled()
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('fails before customer or Checkout creation when Stripe Price does not match the schedule', async () => {
    const response = await POST(request('growth'))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toMatchObject({ code: 'SUBSCRIPTION_PRICE_MISMATCH' })
    expect(stripeHelpers.validateSubscriptionStripePrice).toHaveBeenCalledWith(stripe, 'pro')
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
    expect(stripe.customers.create).not.toHaveBeenCalled()
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('rejects a missing request id before Stripe is called', async () => {
    const response = await POST(request('growth', 'short'))
    expect(response.status).toBe(400)
    expect(stripeHelpers.validateSubscriptionStripePrice).not.toHaveBeenCalled()
  })

  it('sends an existing paid subscriber to subscription management instead of creating a second subscription', async () => {
    stripeHelpers.validateSubscriptionStripePrice.mockResolvedValue(true)
    prisma.user.findUnique.mockResolvedValue({ stripeCustomerId: 'cus_1', email: 'owner@example.com', name: 'Owner' })
    prisma.subscription.findUnique.mockResolvedValue({ stripeId: 'sub_1', status: 'ACTIVE' })

    const response = await POST(request('autopilot'))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('MANAGE_EXISTING_SUBSCRIPTION')
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('creates an idempotent, user-linked subscription Checkout Session', async () => {
    stripeHelpers.validateSubscriptionStripePrice.mockResolvedValue(true)
    prisma.user.findUnique.mockResolvedValue({ stripeCustomerId: 'cus_1', email: 'owner@example.com', name: 'Owner' })
    stripe.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.test/session' })

    const response = await POST(request('growth'))

    expect(response.status).toBe(200)
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_1',
        client_reference_id: 'user_1',
        metadata: { userId: 'user_1', plan: 'pro' },
        subscription_data: { metadata: { userId: 'user_1', plan: 'pro' } },
      }),
      { idempotencyKey: 'subscription-checkout:user_1:pro:73d6b695-3bd1-46ec-bcfe-44ccfe8a71a1' },
    )
  })
})
