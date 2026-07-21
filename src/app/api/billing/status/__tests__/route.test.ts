import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  accountSnapshot: vi.fn(),
  databaseReadiness: vi.fn(),
  validatePrices: vi.fn(),
}))

vi.mock('@/lib/supabaseAuth', () => ({
  adminClient: { auth: { getUser: mocks.getUser } },
}))
vi.mock('@/lib/credits/accountSnapshot', () => ({
  getCreditAccountSnapshot: mocks.accountSnapshot,
}))
vi.mock('@/lib/billingDatabaseReadiness', () => ({
  getBillingDatabaseReadiness: mocks.databaseReadiness,
}))
vi.mock('@/lib/stripe', () => ({
  getBillingMode: vi.fn(() => 'sandbox'),
  getStripeClient: vi.fn(() => ({})),
  isBillingConfigured: vi.fn(() => true),
  isCreditWalletPurchaseConfigured: vi.fn(() => true),
  validateCreditWalletStripePrices: mocks.validatePrices,
}))

import { GET } from '@/app/api/billing/status/route'

const request = {
  headers: { get: () => 'Bearer token' },
} as any

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  mocks.accountSnapshot.mockResolvedValue({
    planName: 'Free',
    hasActiveSubscription: false,
    walletEnabled: true,
    user: { subscriptionStatus: 'FREE', stripeCustomerId: null },
    subscription: null,
    credits: {
      remaining: 15,
      used: 0,
      max: 15,
      creditBreakdown: null,
    },
  })
  mocks.databaseReadiness.mockResolvedValue({ ready: true, state: 'ready' })
  mocks.validatePrices.mockResolvedValue(true)
})

describe('GET /api/billing/status', () => {
  it('does not advertise billing or wallet checkout before the migration is applied', async () => {
    mocks.databaseReadiness.mockResolvedValue({ ready: false, state: 'migration_required' })

    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      billingEnabled: false,
      billingDatabaseStatus: 'migration_required',
      creditPurchasesEnabled: false,
      creditPurchasesStatus: 'migration_required',
    })
    expect(mocks.validatePrices).not.toHaveBeenCalled()
  })

  it('advertises sandbox checkout only after database and immutable prices verify', async () => {
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      billingEnabled: true,
      billingDatabaseStatus: 'ready',
      creditPurchasesEnabled: true,
      creditPurchasesStatus: 'ready',
    })
  })
})
