import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260720161301_landing_page_seo_foundation.sql'), 'utf8')

describe('landing-page SEO migration', () => {
  it('defaults both draft and published search visibility to noindex', () => {
    expect(migration).toContain('"seoIndexable" BOOLEAN NOT NULL DEFAULT false')
    expect(migration).toContain('"publishedSeoIndexable" BOOLEAN NOT NULL DEFAULT false')
  })

  it('requires usable metadata before an indexing request can be persisted', () => {
    expect(migration).toContain('"LandingPage_indexable_metadata_required"')
    expect(migration).toContain('char_length(btrim("seoTitle")) BETWEEN 10 AND 70')
    expect(migration).toContain('char_length(btrim("seoDescription")) BETWEEN 50 AND 180')
  })

  it('uses a partial sitemap index over live, explicitly indexable snapshots', () => {
    expect(migration).toContain('"LandingPage_public_sitemap_idx"')
    expect(migration).toContain('WHERE "status" = \'PUBLISHED\'')
    expect(migration).toContain('AND "publishedSeoIndexable" = true')
    expect(migration).toContain('AND "publishedHash" IS NOT NULL')
  })
})
