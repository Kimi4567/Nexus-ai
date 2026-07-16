import { afterEach, describe, expect, it, vi } from 'vitest'

const ORIGINAL = {
  one: process.env.STRIPE_PRICE_CREDIT_WALLET_TIER_1,
  two: process.env.STRIPE_PRICE_CREDIT_WALLET_TIER_2,
  three: process.env.STRIPE_PRICE_CREDIT_WALLET_TIER_3,
  four: process.env.STRIPE_PRICE_CREDIT_WALLET_TIER_4,
}

async function loadStripeModule() {
  vi.resetModules()
  return import('@/lib/stripe')
}

afterEach(() => {
  const values = [ORIGINAL.one, ORIGINAL.two, ORIGINAL.three, ORIGINAL.four]
  const keys = [1, 2, 3, 4].map((n) => `STRIPE_PRICE_CREDIT_WALLET_TIER_${n}`)
  keys.forEach((key, index) => {
    if (values[index] === undefined) delete process.env[key]
    else process.env[key] = values[index]
  })
  vi.resetModules()
})

describe('Stripe credit wallet line items', () => {
  it('splits a quantity across immutable progressive price tiers', async () => {
    process.env.STRIPE_PRICE_CREDIT_WALLET_TIER_1 = 'price_1'
    process.env.STRIPE_PRICE_CREDIT_WALLET_TIER_2 = 'price_2'
    process.env.STRIPE_PRICE_CREDIT_WALLET_TIER_3 = 'price_3'
    process.env.STRIPE_PRICE_CREDIT_WALLET_TIER_4 = 'price_4'
    const { getCreditWalletLineItems } = await loadStripeModule()

    expect(getCreditWalletLineItems(500)).toEqual([
      { price: 'price_1', quantity: 50 },
      { price: 'price_2', quantity: 100 },
      { price: 'price_3', quantity: 150 },
      { price: 'price_4', quantity: 200 },
    ])
  })

  it('stays unavailable until every trusted tier price is configured', async () => {
    process.env.STRIPE_PRICE_CREDIT_WALLET_TIER_1 = 'price_1'
    delete process.env.STRIPE_PRICE_CREDIT_WALLET_TIER_2
    delete process.env.STRIPE_PRICE_CREDIT_WALLET_TIER_3
    delete process.env.STRIPE_PRICE_CREDIT_WALLET_TIER_4
    const { isCreditWalletPurchaseConfigured, getCreditWalletLineItems } = await loadStripeModule()

    expect(isCreditWalletPurchaseConfigured()).toBe(false)
    expect(getCreditWalletLineItems(100)).toBeNull()
  })
})
