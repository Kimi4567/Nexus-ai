import { describe, expect, it } from 'vitest'
import { getBillingRuntimeGate, getStripeSecretKeyMode } from '@/lib/billingRuntime'

const complete = {
  NEXT_PUBLIC_BILLING_ENABLED: 'true',
  STRIPE_SECRET_KEY: 'sk_test_valid',
  STRIPE_WEBHOOK_SECRET: 'whsec_valid',
  STRIPE_PRICE_PRO: 'price_growth',
  STRIPE_PRICE_BUSINESS: 'price_autopilot',
}

describe('billing runtime safety gate', () => {
  it('classifies only explicit Stripe secret-key prefixes', () => {
    expect(getStripeSecretKeyMode(undefined)).toBe('missing')
    expect(getStripeSecretKeyMode('sk_test_valid')).toBe('test')
    expect(getStripeSecretKeyMode('sk_live_valid')).toBe('live')
    expect(getStripeSecretKeyMode('sk_unknown')).toBe('invalid')
  })

  it('enables a complete Test Mode configuration as sandbox', () => {
    expect(getBillingRuntimeGate(complete)).toMatchObject({
      requested: true,
      ready: true,
      mode: 'sandbox',
      liveModeBlocked: false,
    })
  })

  it('fails closed for invalid, placeholder, or duplicated values', () => {
    expect(getBillingRuntimeGate({ ...complete, STRIPE_SECRET_KEY: 'replace-me' }).ready).toBe(false)
    expect(getBillingRuntimeGate({ ...complete, STRIPE_WEBHOOK_SECRET: 'missing-prefix' }).ready).toBe(false)
    expect(getBillingRuntimeGate({ ...complete, STRIPE_PRICE_BUSINESS: 'price_growth' }).ready).toBe(false)
  })

  it('requires a separate explicit approval before a live key can activate', () => {
    const blocked = getBillingRuntimeGate({ ...complete, STRIPE_SECRET_KEY: 'sk_live_valid' })
    expect(blocked).toMatchObject({ ready: false, mode: 'disabled', liveModeBlocked: true })

    const approved = getBillingRuntimeGate({
      ...complete,
      STRIPE_SECRET_KEY: 'sk_live_valid',
      BILLING_LIVE_MODE_APPROVED: 'true',
    })
    expect(approved).toMatchObject({ ready: true, mode: 'live', liveModeBlocked: false })
  })
})
