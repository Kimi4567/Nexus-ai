import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260721122156_first_party_conversion_measurement.sql'), 'utf8')

describe('first-party conversion measurement migration', () => {
  it('stores optional operator-confirmed outcome value without weakening Lead isolation', () => {
    expect(migration).toContain('"convertedAt"')
    expect(migration).toContain('"conversionValue" DECIMAL(12,2)')
    expect(migration).toContain('"conversionCurrency"')
    expect(migration).toContain("\"conversionValueSource\" = 'MANUAL_CONFIRMED'")
    expect(migration).toContain('Lead_conversion_value_non_negative')
    expect(migration).not.toContain('DISABLE ROW LEVEL SECURITY')
    expect(migration).not.toContain('GRANT ALL')
  })
})
