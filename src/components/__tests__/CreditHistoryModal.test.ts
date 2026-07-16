import { describe, expect, it } from 'vitest'
import {
  applyCreditHistoryCorrections,
  type Transaction,
} from '@/components/CreditHistoryModal'

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx-original',
    action: 'RUN_FULL_STRATEGY',
    description: 'Organic Light · exact 9 organic post directions',
    amount: -12,
    entityId: 'workspace-1',
    entityType: 'workspace_strategy_run',
    pricingVersion: '2026-07-16-v2',
    status: 'SETTLED',
    creditCost: 12,
    reservedAt: null,
    settledAt: '2026-07-16T06:07:01.000Z',
    refundedAt: null,
    createdAt: '2026-07-16T06:07:00.000Z',
    ...overrides,
  }
}

describe('applyCreditHistoryCorrections', () => {
  it('applies an append-only description correction without creating a second monetary row', () => {
    const correction = transaction({
      id: 'tx-correction',
      action: 'AUDIT_CORRECTION',
      description: 'Organic Light · delivered 3 after Trial plan cap (9 requested)',
      amount: 0,
      creditCost: 0,
      entityId: 'tx-original',
      entityType: 'credit_transaction',
      createdAt: '2026-07-16T09:00:00.000Z',
    })

    const rows = applyCreditHistoryCorrections([
      correction,
      transaction({}),
    ])

    expect(rows).toHaveLength(1)
    expect(rows[0].transaction.amount).toBe(-12)
    expect(rows[0].transaction.description).toContain('delivered 3')
    expect(rows[0].correction?.id).toBe('tx-correction')
  })

  it('preserves a transaction when no valid correction exists', () => {
    const original = transaction({})
    const rows = applyCreditHistoryCorrections([original])

    expect(rows).toEqual([{ transaction: original, correction: null }])
  })
})
