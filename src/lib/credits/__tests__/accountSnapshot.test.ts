import { describe, expect, it } from 'vitest'
import { resolveCreditDisplay } from '@/lib/credits/accountSnapshot'

describe('resolveCreditDisplay', () => {
  it('shows the pending 12-credit trial consistently before its lazy grant exists', () => {
    expect(resolveCreditDisplay({
      subscriptionStatus: 'FREE',
      aiCredits: 0,
      monthlyGenerations: 0,
      planName: 'free',
      hasActiveSubscription: false,
      walletEnabled: true,
      grants: [],
    })).toMatchObject({
      remaining: 12,
      used: 0,
      max: 12,
      isUnlimited: false,
      creditBreakdown: null,
      pendingStarterCredits: true,
    })
  })

  it('uses only eligible ledger grants after the starter grant exists', () => {
    expect(resolveCreditDisplay({
      subscriptionStatus: 'FREE',
      aiCredits: 9,
      monthlyGenerations: 1,
      planName: 'free',
      hasActiveSubscription: false,
      walletEnabled: true,
      grants: [{ type: 'TRIAL', remaining: 9, expiresAt: new Date('2026-07-27T00:00:00Z') }],
    })).toMatchObject({
      remaining: 9,
      used: 3,
      max: 12,
      pendingStarterCredits: false,
      creditBreakdown: { trial: 9 },
    })
  })

  it('keeps purchased credits in the total without treating them as renewable monthly credits', () => {
    expect(resolveCreditDisplay({
      subscriptionStatus: 'ACTIVE',
      aiCredits: 170,
      monthlyGenerations: 2,
      planName: 'pro',
      hasActiveSubscription: true,
      walletEnabled: true,
      grants: [
        { type: 'MONTHLY', remaining: 120, expiresAt: new Date('2026-08-01T00:00:00Z') },
        { type: 'PURCHASED', remaining: 50, expiresAt: new Date('2027-07-01T00:00:00Z') },
      ],
    })).toMatchObject({
      remaining: 170,
      used: 30,
      max: 150,
      creditBreakdown: { monthly: 120, purchased: 50 },
    })
  })

  it('shows a migrated balance as its own auditable bucket instead of three misleading zero buckets', () => {
    expect(resolveCreditDisplay({
      subscriptionStatus: 'ACTIVE',
      aiCredits: 171,
      monthlyGenerations: 56,
      planName: 'pro',
      hasActiveSubscription: true,
      walletEnabled: true,
      grants: [{ type: 'MIGRATED', remaining: 171, expiresAt: null }],
    })).toMatchObject({
      remaining: 171,
      creditBreakdown: {
        monthly: 0,
        purchased: 0,
        trial: 0,
        migrated: 171,
      },
    })
  })
})
