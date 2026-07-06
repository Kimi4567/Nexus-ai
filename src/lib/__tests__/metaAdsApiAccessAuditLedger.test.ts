import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const schema = readFileSync('prisma/schema.prisma', 'utf8')
const migration = readFileSync('prisma/migrations/meta_ads_api_access_review_ledger.sql', 'utf8')
const docs = readFileSync('docs/META-ADS-ACCESS1-reviewed-api-readiness.md', 'utf8')

describe('Meta Ads API access audit ledger contract', () => {
  it('adds a durable Prisma model linked to AdAccount', () => {
    expect(schema).toContain('model AdAccountApiAccessReview')
    expect(schema).toContain('apiAccessReviews AdAccountApiAccessReview[]')
    expect(schema).toContain('previousHasApiAccess  Boolean')
    expect(schema).toContain('nextHasApiAccess      Boolean')
    expect(schema).toContain('reviewedById          String')
    expect(schema).toContain('evidenceUrl           String?     @db.Text')
  })

  it('ships an idempotent SQL migration for production Supabase', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "AdAccountApiAccessReview"')
    expect(migration).toContain('ALTER TABLE "AdAccountApiAccessReview" ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id")')
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS "AdAccountApiAccessReview_adAccountId_createdAt_idx"')
    expect(migration).toContain('SAFE TO RERUN')
    expect(migration).not.toContain('DROP TABLE')
    expect(migration).not.toContain('TRUNCATE')
  })

  it('documents that the admin route now has a durable audit log', () => {
    expect(docs).toContain('AdAccountApiAccessReview')
    expect(docs).toContain('Durable Audit Ledger')
    expect(docs).toContain('No Meta App Review submission is performed')
    expect(docs).toContain('No credits are spent')
  })
})
