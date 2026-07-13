import { describe, expect, it } from 'vitest'
import {
  planWalletCutover,
  type CutoverGrant,
} from '@/lib/credits/walletCutover'

const NOW = new Date('2026-07-13T12:00:00.000Z')

function grant(overrides: Partial<CutoverGrant> & { id: string }): CutoverGrant {
  return {
    type: 'MIGRATED',
    remaining: 10,
    expiresAt: null,
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

describe('planWalletCutover', () => {
  it('creates only the missing delta when grants are below the legacy balance', () => {
    expect(
      planWalletCutover({
        legacyBalance: 24,
        subscriptionStatus: 'ACTIVE',
        grants: [grant({ id: 'existing', remaining: 19 })],
        now: NOW,
      }),
    ).toMatchObject({
      kind: 'RECONCILE',
      eligibleBefore: 19,
      targetBalance: 24,
      migratedGrantAmount: 5,
      reductions: [],
    })
  })

  it('reduces excess grants in spend order without changing the target balance', () => {
    const plan = planWalletCutover({
      legacyBalance: 4,
      subscriptionStatus: 'FREE',
      grants: [
        grant({ id: 'manual', type: 'MANUAL', remaining: 12 }),
        grant({ id: 'trial', type: 'TRIAL', remaining: 10, expiresAt: new Date('2026-07-20') }),
      ],
      now: NOW,
    })

    expect(plan).toMatchObject({
      kind: 'RECONCILE',
      eligibleBefore: 22,
      targetBalance: 4,
      migratedGrantAmount: 0,
      reductions: [
        { grantId: 'trial', amount: 10 },
        { grantId: 'manual', amount: 8 },
      ],
    })
  })

  it('ignores expired and inactive grants when calculating the wallet', () => {
    const plan = planWalletCutover({
      legacyBalance: 3,
      subscriptionStatus: 'FREE',
      grants: [
        grant({ id: 'expired', remaining: 100, expiresAt: new Date('2026-01-01') }),
        grant({ id: 'void', remaining: 100, status: 'VOID' }),
      ],
      now: NOW,
    })
    expect(plan).toMatchObject({ eligibleBefore: 0, migratedGrantAmount: 3 })
  })

  it('keeps only valid purchased credits on cancelled accounts', () => {
    const plan = planWalletCutover({
      legacyBalance: 500,
      subscriptionStatus: 'CANCELLED',
      grants: [
        grant({ id: 'monthly', type: 'MONTHLY', remaining: 500 }),
        grant({ id: 'pack', type: 'PURCHASED', remaining: 40, expiresAt: new Date('2027-01-01') }),
        grant({ id: 'old-pack', type: 'PURCHASED', remaining: 80, expiresAt: new Date('2026-01-01') }),
      ],
      now: NOW,
    })
    expect(plan).toMatchObject({
      kind: 'CANCELLED_PURCHASED_ONLY',
      targetBalance: 40,
      voidActiveNonPurchased: true,
      migratedGrantAmount: 0,
      reductions: [],
    })
  })

  it('leaves negative unlimited sentinels untouched', () => {
    expect(
      planWalletCutover({
        legacyBalance: -1,
        subscriptionStatus: 'ACTIVE',
        grants: [grant({ id: 'legacy', remaining: 99 })],
        now: NOW,
      }),
    ).toMatchObject({
      kind: 'SKIP_UNLIMITED',
      targetBalance: -1,
      reductions: [],
      migratedGrantAmount: 0,
    })
  })
})
