import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase/migrations/20260715065149_brand_evidence_library.sql', 'utf8')
const truthMigration = readFileSync('supabase/migrations/20260715080455_add_brand_evidence_truth_status.sql', 'utf8')
const powerpointMigration = readFileSync('supabase/migrations/20260715092300_allow_powerpoint_brand_evidence.sql', 'utf8')

describe('brand evidence database security migration', () => {
  it('keeps evidence tables deny-by-default through the Data API', () => {
    expect(migration).toContain('ALTER TABLE "BrandEvidenceDocument" ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('ALTER TABLE "BrandEvidenceClaim" ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON TABLE "BrandEvidenceDocument" FROM anon, authenticated')
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON TABLE "BrandEvidenceClaim" FROM anon, authenticated')
  })

  it('creates a private size- and MIME-limited storage bucket', () => {
    expect(migration).toContain("'brand-evidence'")
    expect(migration).toMatch(/'brand-evidence',\s*'brand-evidence',\s*false,\s*6291456/s)
    expect(migration).toContain("'application/pdf'")
    expect(migration).toContain("'application/vnd.openxmlformats-officedocument.wordprocessingml.document'")
    expect(powerpointMigration).toContain("WHERE id = 'brand-evidence'")
    expect(powerpointMigration).toContain("'application/vnd.openxmlformats-officedocument.presentationml.presentation'")
  })

  it('keeps truth classification separate and safely backfills reviewed proof', () => {
    expect(truthMigration).toContain('"truthStatus" TEXT NOT NULL DEFAULT \'PROPOSED\'')
    expect(truthMigration).toContain('"conflictClaimId" TEXT')
    expect(truthMigration).toContain("SET \"truthStatus\" = 'CONFIRMED'")
    expect(truthMigration).toContain('ALTER TABLE "BrandEvidenceClaim" ENABLE ROW LEVEL SECURITY')
    expect(truthMigration).toContain('REVOKE ALL PRIVILEGES ON TABLE "BrandEvidenceClaim" FROM anon, authenticated')
  })
})
