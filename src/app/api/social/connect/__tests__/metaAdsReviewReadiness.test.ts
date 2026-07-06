import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const readRepoFile = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('Meta Ads app review readiness contract', () => {
  it('keeps the paid submission runbook scoped to Marketing API permissions only', () => {
    const runbook = readRepoFile('docs/META_ADS_SUBMISSION_RUNBOOK.md')

    expect(runbook).toContain('ads_management')
    expect(runbook).toContain('ads_read')
    expect(runbook).toContain('business_management')
    expect(runbook).toContain('Do not request `read_insights`')
    expect(runbook).toContain('Organic Facebook / Instagram scopes | No')
    expect(runbook).toContain('Paused draft first; final activation is separate')
    expect(runbook).toContain('Manual publish means the user published outside NEXUS')
  })

  it('requires legal pages to disclose paid activation and manual-publish boundaries', () => {
    const terms = readRepoFile('src/app/terms/page.tsx')
    const privacy = readRepoFile('src/app/privacy/page.tsx')

    expect(terms).toContain('Connecting Meta Ads or creating a paid plan is not spend approval')
    expect(terms).toContain('Manual publish means you published outside NEXUS')
    expect(terms).toContain('separate final activation approval confirms launch, budget, and spend')

    expect(privacy).toContain('NEXUS does not launch paid ads or start budget spend')
    expect(privacy).toContain('Platform creation is paused-draft only')
    expect(privacy).toContain('activation requires separate final approval')
  })

  it('keeps the reviewer demo read-only and explicit about paid execution gates', () => {
    const demo = readRepoFile('src/app/meta-ads-review-demo/page.tsx')

    expect(demo).toContain('This read-only page explains the paid Meta Ads flow')
    expect(demo).toContain('Paused platform drafts do not spend budget')
    expect(demo).toContain('Activation requires separate final launch, spend, and budget acknowledgements')
    expect(demo).not.toContain('Launch now')
    expect(demo).not.toContain('Spend now')
  })
})
