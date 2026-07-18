import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const readSource = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('new-user journey clarity regressions', () => {
  it('keeps Brand Brain coverage, context, conflicts, and saves honest', () => {
    const brand = readSource('src/app/brand/page.tsx')
    const strategy = readSource('src/app/strategy/page.tsx')

    expect(brand).toContain('Saved planning context')
    expect(brand).toContain('Market / location')
    expect(brand).toContain('Output language')
    expect(brand).toContain('coreIdentityFilled}/{coreIdentityTotal')
    expect(brand).toContain('placeholder={placeholder}')
    expect(brand).toContain('Saving Brand Brain and verifying the new revision')
    expect(strategy).toContain('brandTruthConflictDetails')
    expect(strategy).toContain('brandTruthBlocked && hasStrategy')
  })

  it('does not render false empty approval or Today states while truth is loading', () => {
    const approvals = readSource('src/app/approvals/page.tsx')
    const dashboard = readSource('src/app/dashboard/page.tsx')

    expect(approvals).toContain('Refreshing the canonical approval queue')
    expect(approvals).toContain('lastLoadedAt')
    expect(dashboard).toContain('Verifying Brand Brain, campaigns, connections, and the live execution decision')
    expect(dashboard).toContain('setLastUpdated(new Date())')
  })

  it('shows a risk summary before bulk copy approval and keeps one canonical creative action', () => {
    const contentHub = readSource('src/app/campaigns/[id]/content-hub/page.tsx')
    const campaign = readSource('src/app/campaigns/[id]/page.tsx')

    expect(contentHub).toContain('approvalReviewSummary')
    expect(contentHub).toContain('Pre-approval review summary')
    expect(contentHub).toContain('Claim risks')
    expect(contentHub).toContain('Destination/CTA risks')
    expect(campaign).toContain('this step has one canonical action')
  })
})
