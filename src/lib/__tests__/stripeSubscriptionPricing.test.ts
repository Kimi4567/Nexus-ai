import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

async function loadStripeModule() {
  vi.resetModules()
  process.env.STRIPE_PRICE_STARTER = 'price_starter'
  process.env.STRIPE_PRICE_PRO = 'price_growth'
  process.env.STRIPE_PRICE_BUSINESS = 'price_autopilot'
  return import('../stripe')
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.restoreAllMocks()
})

describe('subscription pricing truth', () => {
  it('never maps an unknown Stripe Price ID to Growth', async () => {
    const { planFromPriceId, resolveStripeSubscriptionPlan } = await loadStripeModule()

    expect(planFromPriceId('price_unknown')).toBeNull()
    expect(resolveStripeSubscriptionPlan('price_unknown', 'pro')).toBeNull()
    expect(resolveStripeSubscriptionPlan('price_growth', 'business')).toBeNull()
    expect(resolveStripeSubscriptionPlan('price_growth', 'growth')).toBe('pro')
    expect(resolveStripeSubscriptionPlan('price_autopilot', 'agency')).toBe('business')
  })

  it('accepts only the active USD monthly Price matching the public amount', async () => {
    const { validateSubscriptionStripePrice } = await loadStripeModule()
    const retrieve = vi.fn().mockResolvedValue({
      active: true,
      currency: 'usd',
      unit_amount: 4900,
      type: 'recurring',
      recurring: { interval: 'month', interval_count: 1 },
    })
    const stripe = { prices: { retrieve } } as any

    await expect(validateSubscriptionStripePrice(stripe, 'pro')).resolves.toBe(true)
    expect(retrieve).toHaveBeenCalledWith('price_growth')

    retrieve.mockResolvedValueOnce({
      active: true,
      currency: 'usd',
      unit_amount: 1500,
      type: 'recurring',
      recurring: { interval: 'month', interval_count: 1 },
    })
    await expect(validateSubscriptionStripePrice(stripe, 'pro')).resolves.toBe(false)

    retrieve.mockResolvedValueOnce({
      active: true,
      currency: 'usd',
      unit_amount: 9900,
      type: 'recurring',
      recurring: { interval: 'year', interval_count: 1 },
    })
    await expect(validateSubscriptionStripePrice(stripe, 'business')).resolves.toBe(false)
  })
})
