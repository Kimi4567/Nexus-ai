import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const schema = readFileSync('prisma/schema.prisma', 'utf8')
const migration = readFileSync(
  'supabase/migrations/20260720110000_billing_webhook_event_idempotency.sql',
  'utf8',
)

describe('billing webhook event migration', () => {
  it('keeps Prisma and the canonical Supabase migration aligned', () => {
    expect(schema).toContain('model BillingWebhookEvent')
    for (const field of ['attemptCount', 'eventCreatedAt', 'processedAt', 'error']) {
      expect(migration).toContain(`"${field}"`)
    }
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "BillingWebhookEvent"')
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS "BillingWebhookEvent_status_updatedAt_idx"')
  })

  it('keeps signed provider evidence server-only and is safe to rerun', () => {
    expect(migration).toContain('SAFE TO RERUN')
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON TABLE "BillingWebhookEvent" FROM anon, authenticated')
    expect(migration).not.toMatch(/DROP TABLE|TRUNCATE/i)
  })
})
