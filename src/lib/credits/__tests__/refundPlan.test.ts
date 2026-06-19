/**
 * B1c-c-1 — pure refund-to-source planner tests.
 *
 * planRefundToSource is pure: given a debit's allocation rows + the current
 * grant states, it decides how much goes back to each source grant vs. into a
 * fresh REFUND grant. No DB, no I/O.
 */

import { describe, it, expect } from 'vitest'
import {
  planRefundToSource,
  type RefundSourceGrant,
  type RefundAllocationInput,
} from '@/lib/credits/wallet'

const NOW = new Date('2026-06-19T12:00:00.000Z')
const days = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000)

function grant(p: Partial<RefundSourceGrant> & { id: string }): RefundSourceGrant {
  return { amount: 100, remaining: 50, status: 'ACTIVE', expiresAt: null, ...p }
}
const alloc = (creditGrantId: string, amount: number): RefundAllocationInput => ({ creditGrantId, amount })

describe('planRefundToSource', () => {
  it('1. restores a single active grant', () => {
    const plan = planRefundToSource([alloc('g1', 8)], [grant({ id: 'g1', amount: 100, remaining: 50 })], NOW)
    expect(plan.perGrantRestores).toEqual([{ grantId: 'g1', amount: 8 }])
    expect(plan.newRefundGrantAmount).toBe(0)
    expect(plan.refundTotal).toBe(8)
  })

  it('2. restores across split grants', () => {
    const plan = planRefundToSource(
      [alloc('g1', 5), alloc('g2', 3)],
      [grant({ id: 'g1', amount: 100, remaining: 95 }), grant({ id: 'g2', amount: 100, remaining: 97 })],
      NOW,
    )
    expect(plan.perGrantRestores).toEqual([
      { grantId: 'g1', amount: 5 },
      { grantId: 'g2', amount: 3 },
    ])
    expect(plan.newRefundGrantAmount).toBe(0)
    expect(plan.refundTotal).toBe(8)
  })

  it('3. caps at grant.amount, overflow goes to the refund bucket', () => {
    // grant has only 2 headroom (amount 100, remaining 98) but alloc is 5 → 3 overflow
    const plan = planRefundToSource([alloc('g1', 5)], [grant({ id: 'g1', amount: 100, remaining: 98 })], NOW)
    expect(plan.perGrantRestores).toEqual([{ grantId: 'g1', amount: 2 }])
    expect(plan.newRefundGrantAmount).toBe(3)
    expect(plan.refundTotal).toBe(5)
  })

  it('4. expired source grant → full amount to refund bucket', () => {
    const plan = planRefundToSource(
      [alloc('g1', 8)],
      [grant({ id: 'g1', status: 'ACTIVE', expiresAt: days(-1), remaining: 50 })],
      NOW,
    )
    expect(plan.perGrantRestores).toEqual([])
    expect(plan.newRefundGrantAmount).toBe(8)
    expect(plan.refundTotal).toBe(8)
  })

  it('5. RESET / VOID grant → full amount to refund bucket', () => {
    const reset = planRefundToSource([alloc('g1', 4)], [grant({ id: 'g1', status: 'RESET' })], NOW)
    expect(reset.newRefundGrantAmount).toBe(4)
    expect(reset.perGrantRestores).toEqual([])
    const v = planRefundToSource([alloc('g1', 4)], [grant({ id: 'g1', status: 'VOID' })], NOW)
    expect(v.newRefundGrantAmount).toBe(4)
  })

  it('6. missing grant → full amount to refund bucket', () => {
    const plan = planRefundToSource([alloc('ghost', 6)], [], NOW)
    expect(plan.perGrantRestores).toEqual([])
    expect(plan.newRefundGrantAmount).toBe(6)
    expect(plan.refundTotal).toBe(6)
  })

  it('7. exact-total invariant: restores + newRefundGrant === refundTotal', () => {
    const plan = planRefundToSource(
      [alloc('active', 5), alloc('capped', 5), alloc('expired', 5), alloc('missing', 5)],
      [
        grant({ id: 'active', amount: 100, remaining: 90 }), // 5 restorable
        grant({ id: 'capped', amount: 100, remaining: 98 }), // 2 restorable, 3 overflow
        grant({ id: 'expired', status: 'ACTIVE', expiresAt: days(-2), remaining: 0 }), // 5 bucket
      ],
      NOW,
    )
    const restored = plan.perGrantRestores.reduce((s, r) => s + r.amount, 0)
    expect(restored + plan.newRefundGrantAmount).toBe(plan.refundTotal)
    expect(plan.refundTotal).toBe(20)
    expect(restored).toBe(7) // 5 + 2
    expect(plan.newRefundGrantAmount).toBe(13) // 3 + 5 + 5
  })

  it('never restores beyond a grant.amount across multiple allocations to the same grant', () => {
    // two allocations to g1 (3 headroom total) summing to 5 → restore 3, overflow 2
    const plan = planRefundToSource(
      [alloc('g1', 2), alloc('g1', 3)],
      [grant({ id: 'g1', amount: 100, remaining: 97 })],
      NOW,
    )
    const restored = plan.perGrantRestores.reduce((s, r) => s + r.amount, 0)
    expect(restored).toBe(3)
    expect(plan.newRefundGrantAmount).toBe(2)
    expect(plan.refundTotal).toBe(5)
  })
})
