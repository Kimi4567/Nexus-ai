import { describe, it, expect } from 'vitest'
import { getBillingDisplayTruth } from '@/lib/billingDisplayTruth'

describe('getBillingDisplayTruth', () => {
  it('unknown/unloaded billing → unavailable labels (no Free/Active/No credits)', () => {
    const r = getBillingDisplayTruth({
      plan: null,
      status: null,
      hasActiveSubscription: undefined,
      creditsRemaining: null,
      creditsMax: null,
      billingLoaded: false,
      locale: 'en',
    })
    expect(r.isUnknown).toBe(true)
    expect(r.statusLabel).toBe('Plan status unavailable')
    expect(r.statusLabel).not.toBe('Active')
    expect(r.planLabel).not.toBe('Free')
    expect(r.creditHelper).not.toContain('out of credits')
  })

  it('free/no active subscription → Free + one-time compatible messaging', () => {
    const r = getBillingDisplayTruth({
      plan: 'free',
      status: 'none',
      hasActiveSubscription: false,
      creditsRemaining: 8,
      creditsMax: 0,
      billingLoaded: true,
      locale: 'en',
    })
    expect(r.planLabel).toBe('Free')
    expect(r.statusLabel).toBe('No active subscription')
    expect(r.showUpgrade).toBe(true)
  })

  it('paid active growth/pro id → Growth + Active', () => {
    const r = getBillingDisplayTruth({
      plan: 'pro',
      status: 'active',
      hasActiveSubscription: true,
      creditsRemaining: 80,
      creditsMax: 150,
      billingLoaded: true,
      locale: 'en',
    })
    expect(r.planLabel).toBe('Growth')
    expect(r.statusLabel).toBe('Active')
    expect(r.statusTone).toBe('success')
  })

  it('cancelled → not Active', () => {
    const r = getBillingDisplayTruth({
      plan: 'pro',
      status: 'cancelled',
      hasActiveSubscription: true,
      creditsRemaining: 20,
      creditsMax: 150,
      billingLoaded: true,
      locale: 'en',
    })
    expect(r.statusLabel).toBe('Cancelled')
    expect(r.statusLabel).not.toBe('Active')
  })

  it('past_due/unpaid → payment issue', () => {
    const a = getBillingDisplayTruth({
      plan: 'pro',
      status: 'past_due',
      hasActiveSubscription: true,
      creditsRemaining: 20,
      creditsMax: 150,
      billingLoaded: true,
      locale: 'en',
    })
    const b = getBillingDisplayTruth({
      plan: 'pro',
      status: 'unpaid',
      hasActiveSubscription: true,
      creditsRemaining: 20,
      creditsMax: 150,
      billingLoaded: true,
      locale: 'en',
    })
    expect(a.statusLabel).toBe('Payment issue')
    expect(b.statusLabel).toBe('Payment issue')
  })

  it('zero credits → explicit zero-credit message + upgrade CTA', () => {
    const r = getBillingDisplayTruth({
      plan: 'free',
      status: 'none',
      hasActiveSubscription: false,
      creditsRemaining: 0,
      creditsMax: 0,
      billingLoaded: true,
      locale: 'en',
    })
    expect(r.isZeroCredits).toBe(true)
    expect(r.creditHelper).toContain('out of credits')
    expect(r.ctaLabel).toBe('Upgrade plan')
  })

  it('low credits → low warning', () => {
    const r = getBillingDisplayTruth({
      plan: 'starter',
      status: 'active',
      hasActiveSubscription: true,
      creditsRemaining: 2,
      creditsMax: 50,
      billingLoaded: true,
      locale: 'en',
    })
    expect(r.isLowCredits).toBe(true)
    expect(r.creditHelper).toBe('Credits are running low.')
  })

  it('enough credits → normal helper copy', () => {
    const r = getBillingDisplayTruth({
      plan: 'starter',
      status: 'active',
      hasActiveSubscription: true,
      creditsRemaining: 22,
      creditsMax: 50,
      billingLoaded: true,
      locale: 'en',
    })
    expect(r.isZeroCredits).toBe(false)
    expect(r.isLowCredits).toBe(false)
    expect(r.creditHelper).toContain('Credits are used when NEXUS generates strategy')
  })

  it('unlimited sentinel is not treated as low/zero', () => {
    const r = getBillingDisplayTruth({
      plan: 'pro',
      status: 'active',
      hasActiveSubscription: true,
      creditsRemaining: -1,
      creditsMax: -1,
      billingLoaded: true,
      locale: 'en',
    })
    expect(r.isZeroCredits).toBe(false)
    expect(r.isLowCredits).toBe(false)
    expect(r.statusLabel).toBe('Active')
  })
})
