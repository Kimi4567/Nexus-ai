import { describe, expect, it } from 'vitest'
import { getBillingRuntimeGate, getStripeSecretKeyMode } from '@/lib/billingRuntime'

const complete = {
  NEXT_PUBLIC_BILLING_ENABLED: 'true',
  STRIPE_SECRET_KEY: 'sk_test_valid',
  STRIPE_WEBHOOK_SECRET: 'whsec_valid',
  STRIPE_PRICE_PRO: 'price_growth',
  STRIPE_PRICE_BUSINESS: 'price_autopilot',
}

const completeLiveApproval = {
  BILLING_LIVE_MODE_APPROVED: 'true',
  COMMERCIAL_LAUNCH_APPROVED: 'true',
  LEGAL_ENTITY_NAME: 'Nexus Example LLC',
  LEGAL_ENTITY_ADDRESS: '123 Example Street, Dubai',
  LEGAL_ENTITY_JURISDICTION: 'Dubai, United Arab Emirates',
  LEGAL_GOVERNING_LAW: 'Laws of the United Arab Emirates',
  LEGAL_TERMS_VERSION: '2026-07-22',
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

  it('requires explicit billing and complete commercial/legal approval before a live key can activate', () => {
    const blocked = getBillingRuntimeGate({ ...complete, STRIPE_SECRET_KEY: 'sk_live_valid' })
    expect(blocked).toMatchObject({ ready: false, mode: 'disabled', liveModeBlocked: true })
    expect(blocked.liveBlockers).toContain('billingLiveModeApproved')
    expect(blocked.liveBlockers).toContain('entityName')

    const approved = getBillingRuntimeGate({
      ...complete,
      STRIPE_SECRET_KEY: 'sk_live_valid',
      ...completeLiveApproval,
    })
    expect(approved).toMatchObject({
      ready: true,
      mode: 'live',
      liveModeBlocked: false,
      commercialLegalReady: true,
    })
    expect(approved.liveBlockers).toEqual([])
  })

  it('rejects placeholder legal values even when both launch flags are enabled', () => {
    const blocked = getBillingRuntimeGate({
      ...complete,
      STRIPE_SECRET_KEY: 'sk_live_valid',
      ...completeLiveApproval,
      LEGAL_ENTITY_NAME: 'your-company',
    })
    expect(blocked.ready).toBe(false)
    expect(blocked.liveBlockers).toContain('entityName')
  })
})
