import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const workflow = readFileSync(join(root, '.github/workflows/quality-gates.yml'), 'utf8')
const runner = readFileSync(join(root, 'scripts/verify-marketing-migrations.sh'), 'utf8')
const baseline = readFileSync(join(root, 'scripts/sql/marketing-foundation-baseline.sql'), 'utf8')
const verification = readFileSync(join(root, 'scripts/sql/verify-marketing-foundation.sql'), 'utf8')
const prisma = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8')
const crmOperations = readFileSync(
  join(root, 'supabase/migrations/20260720125414_crm_assignment_followup_and_intake.sql'),
  'utf8',
)

describe('marketing migration contract harness', () => {
  it('runs the feature migrations in their required order against only an explicitly disposable local database', () => {
    const order = [
      '20260720110000_billing_webhook_event_idempotency.sql',
      '20260720121119_crm_lead_operations_foundation.sql',
      '20260720125414_crm_assignment_followup_and_intake.sql',
      '20260720132727_customer_lifecycle_controls.sql',
      '20260720143701_landing_pages_and_conversion_evidence.sql',
      '20260720154226_landing_page_experiments.sql',
      '20260720161301_landing_page_seo_foundation.sql',
      '20260720181911_enforce_marketing_workspace_coherence.sql',
      '20260721122156_first_party_conversion_measurement.sql',
    ]

    for (let index = 1; index < order.length; index += 1) {
      expect(runner.indexOf(order[index - 1])).toBeLessThan(runner.indexOf(order[index]))
    }
    expect(runner).toContain('ALLOW_EPHEMERAL_MARKETING_MIGRATION_TEST')
    expect(runner).toContain('Refusing to run against a non-local database host.')
    expect(runner).not.toContain('--linked')
    expect(runner).not.toContain('db push')
  })

  it('simulates legacy Data API grants and verifies RLS plus revoked browser access', () => {
    expect(baseline).toContain('ALTER DEFAULT PRIVILEGES IN SCHEMA public')
    expect(baseline).toContain('TO anon, authenticated')
    expect(verification).toContain('NOT c.relrowsecurity')
    expect(verification).toContain("has_table_privilege(role_name")
    expect(verification).toContain("ARRAY['anon', 'authenticated']")
  })

  it('executes data-level truth invariants rather than checking SQL text alone', () => {
    expect(verification).toContain("'SERVER_CONFIRMED', 'invalid-click'")
    expect(verification).toContain('Expected indexable page without metadata to be rejected')
    expect(verification).toContain('Expected workspace-scoped lead deduplication to reject a duplicate')
    expect(verification).toContain('Expected one-running-experiment invariant to reject a second experiment')
    expect(verification).toContain('marketing_migration_contract_passed')
  })

  it('runs automatically in CI and covers foreign keys used during user deletion', () => {
    expect(workflow).toContain('marketing-migration-contract:')
    expect(workflow).toContain('image: postgres:17-alpine')
    expect(workflow).toContain('npm run db:verify-marketing-migrations')

    for (const index of ['Lead_assignedToId_idx', 'LeadTask_createdById_idx', 'LeadCaptureForm_createdById_idx']) {
      expect(crmOperations).toContain(`"${index}"`)
    }
    expect(prisma).toContain('@@index([assignedToId])')
    expect(prisma).toContain('@@index([createdById])')
  })
})
