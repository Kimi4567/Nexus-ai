import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getCreditActionPolicy } from '@/lib/credits'
import { CURRENT_CREDIT_PRICING_VERSION } from '@/lib/credits/pricing'

describe('credit pricing version', () => {
  it('is included in every current AI action policy and receipt source', () => {
    expect(getCreditActionPolicy('RUN_FULL_STRATEGY').pricingVersion)
      .toBe(CURRENT_CREDIT_PRICING_VERSION)
    expect(getCreditActionPolicy('IMAGE_GENERATION').pricingVersion)
      .toBe(CURRENT_CREDIT_PRICING_VERSION)
  })

  it('keeps legacy rows nullable instead of rewriting history as current pricing', () => {
    const migration = readFileSync(
      'supabase/migrations/20260715071631_credit_pricing_version.sql',
      'utf8',
    )
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "pricingVersion" TEXT;')
    expect(migration).not.toMatch(/pricingVersion"\s+TEXT\s+NOT NULL|pricingVersion"\s+TEXT\s+DEFAULT/i)
  })
})
