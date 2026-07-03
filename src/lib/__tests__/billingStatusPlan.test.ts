import { describe, expect, it } from 'vitest'
import { resolveBillingStatusPlan } from '@/lib/billingStatusPlan'

describe('resolveBillingStatusPlan', () => {
  it('uses an active Stripe subscription row when present', () => {
    expect(resolveBillingStatusPlan({
      subscriptionPlan: 'pro',
      subscriptionStatus: 'ACTIVE',
      userSubscriptionStatus: 'FREE',
    })).toEqual({ plan: 'pro', hasActiveSubscription: true })
  })

  it('treats admin-set User.subscriptionStatus ACTIVE as paid when no subscription row exists', () => {
    expect(resolveBillingStatusPlan({
      subscriptionPlan: null,
      subscriptionStatus: null,
      userSubscriptionStatus: 'ACTIVE',
    })).toEqual({ plan: 'active', hasActiveSubscription: true })
  })

  it('normalizes legacy display aliases', () => {
    expect(resolveBillingStatusPlan({
      subscriptionPlan: 'Growth',
      subscriptionStatus: 'trialing',
      userSubscriptionStatus: 'FREE',
    }).plan).toBe('pro')

    expect(resolveBillingStatusPlan({
      subscriptionPlan: 'AGENCY',
      subscriptionStatus: 'active',
      userSubscriptionStatus: 'FREE',
    }).plan).toBe('business')
  })

  it('falls back to free when neither source is active', () => {
    expect(resolveBillingStatusPlan({
      subscriptionPlan: 'pro',
      subscriptionStatus: 'CANCELLED',
      userSubscriptionStatus: 'FREE',
    })).toEqual({ plan: 'free', hasActiveSubscription: false })
  })
})
