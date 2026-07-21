import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260720143701_landing_pages_and_conversion_evidence.sql'), 'utf8')

describe('landing page migration security and truth contract', () => {
  it('creates immutable revisions and a conversion evidence ledger', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "LandingPage"')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "LandingPageRevision"')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "ConversionEvent"')
    expect(migration).toContain('"publishedSnapshot" JSONB')
    expect(migration).toContain('"LandingPageRevision_landingPageId_version_key"')
  })

  it('enforces client-reported browsing and server-confirmed form submissions in SQL', () => {
    expect(migration).toContain('"ConversionEvent_truth_invariant"')
    expect(migration).toContain('"eventType" = \'FORM_SUBMITTED\' AND "verificationState" = \'SERVER_CONFIRMED\'')
    expect(migration).toContain('"ConversionEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL')
    expect(migration).toContain('"eventType" IN (\'PAGE_VIEW\', \'CTA_CLICK\') AND "verificationState" = \'CLIENT_REPORTED\'')
  })

  it('keeps all three tables unavailable to Supabase browser roles', () => {
    for (const table of ['LandingPage', 'LandingPageRevision', 'ConversionEvent']) {
      expect(migration).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`)
      expect(migration).toContain(`REVOKE ALL PRIVILEGES ON TABLE "${table}" FROM anon, authenticated`)
    }
  })
})
