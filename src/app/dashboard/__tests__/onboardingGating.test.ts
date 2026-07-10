/** Dashboard workspace gating and evidence-backed command-center contract. */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = readFileSync(resolve(process.cwd(), 'src/app/dashboard/page.tsx'), 'utf8')
describe('Dashboard onboarding gating', () => {
  it('D0.3 gates dashboard rendering until workspace check completes', () => {
    expect(SRC).toMatch(/WorkspaceGateState = 'checking' \| 'hasWorkspace' \| 'noWorkspace' \| 'error'/)
    expect(SRC).toMatch(/workspaceGate === 'checking'/)
    expect(SRC).toMatch(/workspaceGate === 'error'/)
    expect(SRC).toMatch(/router\.replace\('\/onboarding'\)/)
    expect(SRC).not.toMatch(/router\.push\('\/onboarding'\)/)
  })

  it('D0.3 does not treat workspace fetch failure as onboarding', () => {
    expect(SRC).toMatch(/setWorkspaceGate\('error'\)/)
    expect(SRC).toMatch(/We could not verify your workspace/)
    expect(SRC).toMatch(/إعادة المحاولة/)
  })

  it('uses real stats and explicit evidence stages for the command center', () => {
    expect(SRC).toMatch(/postsWithAnalytics: d\.stats\?\.performanceEvidence\?\.postsWithAnalytics \?\? 0/)
    expect(SRC).toMatch(/const workflowChecks = \[/)
    expect(SRC).toMatch(/brandReadiness\?\.ready === true/)
    expect(SRC).toMatch(/strategyAvailable/)
    expect(SRC).toMatch(/postsWithAnalytics > 0/)
    expect(SRC).toMatch(/Recorded activities/)
  })

  it('keeps the first operating action strategy-led and context-aware', () => {
    expect(SRC).toMatch(/href: '\/strategy'/)
    expect(SRC).toMatch(/Create a clear operating strategy/)
    expect(SRC).toMatch(/Review content and media decisions/)
    expect(SRC).toMatch(/Prepare platform connections/)
    expect(SRC).toMatch(/Monitor performance when analytics exists/)
  })

  it('does not render invented operating health, ROAS, or campaign progress', () => {
    expect(SRC).not.toContain('setupScore')
    expect(SRC).not.toContain('Overall health')
    expect(SRC).not.toContain('Operating score')
    expect(SRC).not.toContain("'ROAS'")
    expect(SRC).not.toMatch(/const progress = Math\./)
  })

  it('shows the real draft campaign count in the workflow ledger', () => {
    expect(SRC).toMatch(/draftCampaigns: d\.stats\?\.campaigns\?\.draft \?\? 0/)
    expect(SRC).toMatch(/const draftCount = stats\?\.draftCampaigns \?\? campaigns\.filter/)
    expect(SRC).toMatch(/label: ar \? 'مسودات حملات' : 'Campaign drafts', value: draftCount/)
  })
})
