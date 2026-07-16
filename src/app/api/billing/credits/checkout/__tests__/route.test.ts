import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  findUser: vi.fn(),
  updateUser: vi.fn(),
  createSession: vi.fn(),
  createCustomer: vi.fn(),
  validateWalletPrices: vi.fn(),
  walletEnabled: vi.fn(() => true),
  rateLimit: vi.fn(() => true),
}))

vi.mock('@/lib/supabaseAuth', () => ({
  adminClient: { auth: { getUser: mocks.getUser } },
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: mocks.findUser, update: mocks.updateUser },
  },
}))
vi.mock('@/lib/credits/wallet', () => ({
  isCreditWalletEnabled: mocks.walletEnabled,
}))
vi.mock('@/lib/dbRateLimit', () => ({ checkoutRateLimit: mocks.rateLimit }))
vi.mock('@/lib/stripe', () => ({
  billingNotConfiguredResponse: vi.fn(() => ({ error: 'not configured' })),
  isBillingConfigured: vi.fn(() => true),
  isCreditWalletPurchaseConfigured: vi.fn(() => true),
  validateCreditWalletStripePrices: mocks.validateWalletPrices,
  getCreditWalletLineItems: vi.fn((credits: number) => credits === 300
    ? [
        { price: 'price_tier_1', quantity: 50 },
        { price: 'price_tier_2', quantity: 100 },
        { price: 'price_tier_3', quantity: 150 },
      ]
    : [{ price: 'price_tier_1', quantity: credits }]),
  getStripeClient: vi.fn(() => ({
    customers: { create: mocks.createCustomer },
    checkout: { sessions: { create: mocks.createSession } },
  })),
}))

import { POST } from '../route'

function request(body: Record<string, unknown>) {
  return {
    headers: { get: () => 'Bearer token' },
    json: async () => body,
  } as any
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_APP_URL = 'https://nexus.example'
  mocks.walletEnabled.mockReturnValue(true)
  mocks.rateLimit.mockReturnValue(true)
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  mocks.findUser.mockResolvedValue({
    stripeCustomerId: 'cus_1',
    email: 'customer@example.com',
    name: 'Customer',
  })
  mocks.createSession.mockResolvedValue({ url: 'https://checkout.stripe.test/session' })
  mocks.validateWalletPrices.mockResolvedValue(true)
})

describe('POST /api/billing/credits/checkout', () => {
  it('uses only the server quote and binds it to signed Stripe metadata', async () => {
    const response = await POST(request({
      credits: 300,
      amountCents: 1,
      requestId: '73d6b695-3bd1-46ec-bcfe-44ccfe8a71a1',
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.quote).toMatchObject({ credits: 300, amountCents: 26_000 })
    expect(mocks.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_1',
        client_reference_id: 'user-1',
        mode: 'payment',
        line_items: [
          { price: 'price_tier_1', quantity: 50 },
          { price: 'price_tier_2', quantity: 100 },
          { price: 'price_tier_3', quantity: 150 },
        ],
        metadata: {
          kind: 'credit_wallet_purchase',
          userId: 'user-1',
          credits: '300',
          amountCents: '26000',
          pricingVersion: '2026-07-16-v2',
        },
      }),
      { idempotencyKey: 'credit-wallet:user-1:73d6b695-3bd1-46ec-bcfe-44ccfe8a71a1' },
    )
  })

  it.each([19, 21, 505, 100.5])('rejects unsafe quantity %s before Stripe', async (credits) => {
    const response = await POST(request({
      credits,
      requestId: '73d6b695-3bd1-46ec-bcfe-44ccfe8a71a1',
    }))
    expect(response.status).toBe(400)
    expect(mocks.createSession).not.toHaveBeenCalled()
  })

  it('does not sell credits while the ledger wallet is disabled', async () => {
    mocks.walletEnabled.mockReturnValue(false)
    const response = await POST(request({
      credits: 100,
      requestId: '73d6b695-3bd1-46ec-bcfe-44ccfe8a71a1',
    }))
    expect(response.status).toBe(503)
    expect(mocks.createSession).not.toHaveBeenCalled()
  })
})
