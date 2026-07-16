import { beforeEach, describe, expect, it, vi } from 'vitest'

const { auth, prisma, stripe, stripeHelpers, rateLimit } = vi.hoisted(() => ({
  auth: { getUser: vi.fn() },
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
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
}))

vi.mock('@/lib/supabaseAuth', () => ({ adminClient: { auth } }))
vi.mock('@/lib/prisma', () => ({ prisma }))
vi.mock('@/lib/stripe', () => stripeHelpers)
vi.mock('@/lib/dbRateLimit', () => ({ checkoutRateLimit: rateLimit }))
vi.mock('@/lib/requestBaseUrl', () => ({ getRequestBaseUrl: () => 'https://www.nexus-grow.com' }))

import { POST } from '../route'

const request = (plan: string) => ({
  headers: { get: (name: string) => name === 'authorization' ? 'Bearer token' : null },
  json: async () => ({ plan }),
}) as any

beforeEach(() => {
  vi.clearAllMocks()
  stripeHelpers.getStripeClient.mockReturnValue(stripe)
  stripeHelpers.isBillingConfigured.mockReturnValue(true)
  stripeHelpers.validateSubscriptionStripePrice.mockResolvedValue(false)
  auth.getUser.mockResolvedValue({ data: { user: { id: 'user_1' } }, error: null })
})

describe('subscription checkout pricing truth', () => {
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
})
