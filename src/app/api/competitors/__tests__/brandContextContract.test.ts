import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const apiSource = readFileSync(
  new URL('../route.ts', import.meta.url),
  'utf8',
)
const patchSource = readFileSync(
  new URL('../[id]/route.ts', import.meta.url),
  'utf8',
)
const scanSource = readFileSync(
  new URL('../[id]/scan/route.ts', import.meta.url),
  'utf8',
)
const monitoringSource = readFileSync(
  new URL('../../../../lib/competitorMonitoring.ts', import.meta.url),
  'utf8',
)

describe('competitor Brand Brain context contract', () => {
  it('binds every new competitor and baseline snapshot to a Brand Brain fingerprint', () => {
    expect(apiSource).toContain('brandContextFingerprint(profile)')
    expect(apiSource).toContain('contextReviewedAt: new Date()')
    expect(monitoringSource).toContain('contentHash: { startsWith: `${contextFingerprint}:` }')
    expect(monitoringSource).toContain('const contentHash = `${contextFingerprint}:${evidenceHash}`')
  })

  it('blocks manual and scheduled scans while brand-context review is required', () => {
    expect(scanSource).toContain('BRAND_CONTEXT_REVIEW_REQUIRED')
    expect(monitoringSource).toContain('contextReviewRequired: false')
    expect(monitoringSource).toContain('Brand context review is required before monitoring can continue.')
  })

  it('requires an explicit current-brand confirmation before rebuilding the baseline', () => {
    expect(patchSource).toContain('confirmCurrentBrandContext')
    expect(patchSource).toContain('BRAND_CONTEXT_REVIEW_REQUIRED')
    expect(patchSource).toContain("baselineStatus: 'RUNNING'")
    expect(patchSource).toContain('baselineAt: null')
  })
})
