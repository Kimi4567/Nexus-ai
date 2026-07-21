import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260720121119_crm_lead_operations_foundation.sql'),
  'utf8',
)
const operationsMigration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260720125414_crm_assignment_followup_and_intake.sql'),
  'utf8',
)

describe('CRM migration security contract', () => {
  it('creates contact, consent, attribution, and append-only activity foundations', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "Lead"')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "LeadActivity"')
    expect(migration).toContain('"Lead_contact_required"')
    expect(migration).toContain('"Lead_score_range"')
    expect(migration).toContain('"consentStatus"')
    expect(migration).toContain('"attribution"')
  })

  it('locks customer PII away from Supabase browser roles', () => {
    expect(migration).toContain('ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('ALTER TABLE "LeadActivity" ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON TABLE "Lead" FROM anon, authenticated')
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON TABLE "LeadActivity" FROM anon, authenticated')
  })
})

describe('CRM operations migration security contract', () => {
  it('adds ownership, SLA, tasks, and public capture foundations', () => {
    expect(operationsMigration).toContain('ADD COLUMN IF NOT EXISTS "assignedToId"')
    expect(operationsMigration).toContain('ADD COLUMN IF NOT EXISTS "responseDueAt"')
    expect(operationsMigration).toContain('CREATE TABLE IF NOT EXISTS "LeadTask"')
    expect(operationsMigration).toContain('CREATE TABLE IF NOT EXISTS "LeadCaptureForm"')
    expect(operationsMigration).toContain('"LeadTask_status_valid"')
    expect(operationsMigration).toContain('"LeadCaptureForm_status_valid"')
  })

  it('keeps operational CRM tables server-only', () => {
    for (const table of ['LeadTask', 'LeadCaptureForm']) {
      expect(operationsMigration).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`)
      expect(operationsMigration).toContain(`REVOKE ALL PRIVILEGES ON TABLE "${table}" FROM anon, authenticated`)
    }
  })
})
