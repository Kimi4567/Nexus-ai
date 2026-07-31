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

  it('shows separate copy, media, and scheduling decisions with execution limits', () => {
    const contentHub = readSource('src/app/campaigns/[id]/content-hub/page.tsx')
    const campaign = readSource('src/app/campaigns/[id]/page.tsx')

    expect(contentHub).toContain('approvalReviewSummary')
    expect(contentHub).toContain('Claim risks')
    expect(contentHub).toContain('Destination/CTA risks')
    expect(contentHub).toContain('Copy approval decision')
    expect(contentHub).toContain('Separate media decision')
    expect(contentHub).toContain('Separate scheduling decision')
    expect(contentHub).toContain('reviewedPackageScheduleDates')
    expect(contentHub).toContain('Cost: 0 credits. No media approval, scheduling, external publishing, platform linking, Autopilot activation, or budget spend.')
    expect(contentHub).not.toContain('one reviewed package decision')
    expect(contentHub).not.toContain('to make the package decision ready')
    expect(campaign).toContain('this step has one canonical action')
  })
})
