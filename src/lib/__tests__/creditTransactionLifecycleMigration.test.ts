import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  'supabase/migrations/20260715094235_credit_transaction_lifecycle.sql',
  'utf8',
)

describe('credit transaction lifecycle migration', () => {
  it('adds reservation, settlement, refund, cost and idempotency fields', () => {
    for (const field of ['status', 'creditCost', 'operationKey', 'reservedAt', 'settledAt', 'refundedAt']) {
      expect(migration).toContain(`"${field}"`)
    }
    expect(migration).toContain("CHECK (\"status\" IN ('RESERVED', 'SETTLED', 'REFUNDED'))")
    expect(migration).toContain('"CreditTransaction_userId_operationKey_key"')
  })

  it('backfills AI debit cost without classifying grants or refunds as AI usage', () => {
    expect(migration).toMatch(/"creditCost" = ABS\("amount"\)[\s\S]*AND "amount" < 0;/)
    expect(migration).not.toMatch(/"creditCost" = ABS\("amount"\)[\s\S]*"amount" <> 0;/)
  })

  it('keeps the ledger server-only after schema changes', () => {
    expect(migration).toContain('ALTER TABLE public."CreditTransaction" ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON TABLE public."CreditTransaction" FROM anon, authenticated')
  })
})
