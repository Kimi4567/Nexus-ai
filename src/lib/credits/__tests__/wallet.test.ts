/**
 * B1c-b — pure credit-wallet planner tests.
 *
 * selectGrantsToSpend / isGrantEligible are pure: no DB, no env, no I/O.
 * They decide WHICH grants a debit draws from and HOW MUCH from each.
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  selectGrantsToSpend,
  isGrantEligible,
  isCreditWalletEnabled,
  type SpendableGrant,
} from '@/lib/credits/wallet'

const NOW = new Date('2026-06-19T12:00:00.000Z')
const days = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000)

function grant(p: Partial<SpendableGrant> & { id: string }): SpendableGrant {
  return {
    type: 'MONTHLY',
    remaining: 10,
    expiresAt: null,
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...p,
  }
}

describe('selectGrantsToSpend', () => {
  it('1. spends from a single grant when it covers the cost', () => {
    const res = selectGrantsToSpend([grant({ id: 'g1', remaining: 20 })], 8, NOW)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.allocations).toEqual([{ grantId: 'g1', amount: 8 }])
      expect(res.totalSpent).toBe(8)
    }
  })

  it('2. splits across multiple grants when one is not enough', () => {
    const res = selectGrantsToSpend(
      [
        grant({ id: 'g1', remaining: 5, expiresAt: days(10) }),
        grant({ id: 'g2', remaining: 5, expiresAt: days(20) }),
      ],
      8,
      NOW,
    )
    expect(res.ok).toBe(true)
    if (res.ok) {
      // g1 (sooner expiry) fully drained, then 3 from g2
      expect(res.allocations).toEqual([
        { grantId: 'g1', amount: 5 },
        { grantId: 'g2', amount: 3 },
      ])
      expect(res.totalSpent).toBe(8)
    }
  })

  it('3. spends soonest-expiry-first', () => {
    const res = selectGrantsToSpend(
      [
        grant({ id: 'later', remaining: 10, expiresAt: days(30) }),
        grant({ id: 'sooner', remaining: 10, expiresAt: days(3) }),
      ],
      4,
      NOW,
    )
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.allocations[0].grantId).toBe('sooner')
  })

  it('4. spends dated grants before never-expiring (null) grants', () => {
    const res = selectGrantsToSpend(
      [
        grant({ id: 'never', remaining: 10, expiresAt: null }),
        grant({ id: 'dated', remaining: 10, expiresAt: days(15) }),
      ],
      4,
      NOW,
    )
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.allocations[0].grantId).toBe('dated')
  })

  it('5. tie-breaks equal expiry by type priority (TRIAL before PURCHASED)', () => {
    const res = selectGrantsToSpend(
      [
        grant({ id: 'purchased', type: 'PURCHASED', remaining: 10, expiresAt: days(5) }),
        grant({ id: 'trial', type: 'TRIAL', remaining: 10, expiresAt: days(5) }),
      ],
      4,
      NOW,
    )
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.allocations[0].grantId).toBe('trial')
  })

  it('6. returns ok:false with eligible remaining when underfunded (no partial plan)', () => {
    const res = selectGrantsToSpend(
      [grant({ id: 'g1', remaining: 3 }), grant({ id: 'g2', remaining: 2 })],
      8,
      NOW,
    )
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.eligibleRemaining).toBe(5)
  })

  it('7. ignores expired / non-ACTIVE / empty grants', () => {
    const res = selectGrantsToSpend(
      [
        grant({ id: 'expired', remaining: 100, expiresAt: days(-1) }),
        grant({ id: 'void', remaining: 100, status: 'VOID' }),
        grant({ id: 'reset', remaining: 100, status: 'RESET' }),
        grant({ id: 'empty', remaining: 0 }),
        grant({ id: 'good', remaining: 10 }),
      ],
      8,
      NOW,
    )
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.allocations).toEqual([{ grantId: 'good', amount: 8 }])
  })

  it('8. spends MIGRATED non-expiring grants correctly', () => {
    const res = selectGrantsToSpend(
      [grant({ id: 'm', type: 'MIGRATED', remaining: 132, expiresAt: null })],
      8,
      NOW,
    )
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.allocations).toEqual([{ grantId: 'm', amount: 8 }])
  })

  it('cost 0 returns ok with an empty allocation (no spend)', () => {
    const res = selectGrantsToSpend([grant({ id: 'g1', remaining: 10 })], 0, NOW)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.allocations).toEqual([])
      expect(res.totalSpent).toBe(0)
    }
  })

  it('boundary: eligible total exactly equals cost', () => {
    const res = selectGrantsToSpend(
      [grant({ id: 'g1', remaining: 3 }), grant({ id: 'g2', remaining: 5 })],
      8,
      NOW,
    )
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.totalSpent).toBe(8)
  })
})

describe('isGrantEligible', () => {
  it('accepts an ACTIVE, non-expired grant with remaining > 0', () => {
    expect(isGrantEligible(grant({ id: 'g', remaining: 1, expiresAt: days(1) }), NOW)).toBe(true)
  })
  it('rejects expired, empty, or non-ACTIVE grants', () => {
    expect(isGrantEligible(grant({ id: 'g', expiresAt: days(-1) }), NOW)).toBe(false)
    expect(isGrantEligible(grant({ id: 'g', remaining: 0 }), NOW)).toBe(false)
    expect(isGrantEligible(grant({ id: 'g', status: 'EXPIRED' }), NOW)).toBe(false)
  })
})

describe('isCreditWalletEnabled', () => {
  const original = process.env.CREDIT_WALLET_ENABLED
  afterEach(() => {
    if (original === undefined) delete process.env.CREDIT_WALLET_ENABLED
    else process.env.CREDIT_WALLET_ENABLED = original
  })

  it('is OFF by default (unset)', () => {
    delete process.env.CREDIT_WALLET_ENABLED
    expect(isCreditWalletEnabled()).toBe(false)
  })
  it('is OFF for any value other than exactly "true"', () => {
    for (const v of ['false', '1', 'yes', 'TRUE', '']) {
      process.env.CREDIT_WALLET_ENABLED = v
      expect(isCreditWalletEnabled()).toBe(false)
    }
  })
  it('is ON only for exactly "true"', () => {
    process.env.CREDIT_WALLET_ENABLED = 'true'
    expect(isCreditWalletEnabled()).toBe(true)
  })
})
