import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260720154226_landing_page_experiments.sql'), 'utf8')

describe('landing-page experiment migration', () => {
  it('enforces a single variable, confirmed success metric, and bounded evidence thresholds', () => {
    expect(migration).toContain('"variable" IN (\'HEADLINE\', \'SUBHEADLINE\', \'CTA_LABEL\')')
    expect(migration).toContain('"successMetric" = \'FORM_SUBMITTED\'')
    expect(migration).toContain('"minimumVisitorsPerVariant" BETWEEN 50 AND 1000000')
    expect(migration).toContain('"minimumConversionsPerVariant" BETWEEN 1 AND 100000')
  })

  it('permits only one running experiment per page and validates event assignments', () => {
    expect(migration).toContain('"LandingPageExperiment_one_running_per_page_idx"')
    expect(migration).toContain('WHERE "status" = \'RUNNING\'')
    expect(migration).toContain('"ConversionEvent_experiment_assignment_valid"')
    expect(migration).toContain('"experimentVariant" IN (\'CONTROL\', \'CHALLENGER\')')
  })

  it('keeps the experiment table server-only behind RLS and revoked browser grants', () => {
    expect(migration).toContain('ALTER TABLE "LandingPageExperiment" ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON TABLE "LandingPageExperiment" FROM anon, authenticated')
  })
})
