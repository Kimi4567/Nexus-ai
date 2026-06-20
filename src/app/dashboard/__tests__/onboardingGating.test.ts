/**
 * Trust Sprint #7 — dashboard wires the onboarding gating and keeps stats/cards.
 *
 * Source-level guard: confirms the dashboard routes the three onboarding surfaces
 * (welcome / checklist / journey bar) through the visibility helper, and that the
 * existing stats cards + activity were NOT removed by the consolidation.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = readFileSync(resolve(process.cwd(), 'src/app/dashboard/page.tsx'), 'utf8')
const INTELLIGENCE_SRC = readFileSync(resolve(process.cwd(), 'src/lib/marketing-intelligence.ts'), 'utf8')

describe('Dashboard onboarding gating', () => {
  it('routes all three onboarding surfaces through getOnboardingVisibility', () => {
    expect(SRC).toMatch(/getOnboardingVisibility/)
    expect(SRC).toMatch(/onboarding\.showWelcome/)
    expect(SRC).toMatch(/onboarding\.showChecklist/)
    expect(SRC).toMatch(/onboarding\.showJourneyBar/)
  })

  it('6. existing dashboard stats cards + activity still render (not removed)', () => {
    expect(SRC).toMatch(/NexusMetricCard/)
    expect(SRC).toMatch(/dashboard\.statCampaignLabel/)
  })

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

  it('D1.1 detects early execution mode from existing dashboard data only', () => {
    expect(SRC).toMatch(/isEarlyOperatingMode/)
    expect(SRC).toMatch(/const isEarlyExecutionDashboard = Boolean\(stats && isEarlyOperatingMode/)
    expect(SRC).toMatch(/const publishingState = intelligence\?\.publishingState \?\? 'none'/)
    expect(SRC).toMatch(/publishedPostsTotal: stats\.publishedPostsTotal/)
    expect(SRC).toMatch(/campaignStatuses: campaigns\.map\(c => c\.status\)/)
  })

  it('D1.1 makes the early operating next step the first major dashboard surface', () => {
    const focusIndex = SRC.indexOf('Early Operating Mode')
    const journeyIndex = SRC.indexOf('Marketing Journey Bar')
    const statsIndex = SRC.indexOf('Stats Row')
    const briefIndex = SRC.indexOf('Marketing Operating Brief')

    expect(focusIndex).toBeGreaterThan(-1)
    expect(focusIndex).toBeLessThan(journeyIndex)
    expect(focusIndex).toBeLessThan(statsIndex)
    expect(focusIndex).toBeLessThan(briefIndex)
    expect(SRC).toMatch(/Your next step/)
    expect(SRC).toMatch(/This is the most useful next step based on what NEXUS currently knows/)
    expect(SRC).toMatch(/Open the strategy workflow/)
    expect(SRC).toMatch(/افتح مسار الاستراتيجية/)
    expect(SRC).toMatch(/nextBestAction\.id === 'run-full-strategy'/)
    expect(INTELLIGENCE_SRC).toMatch(/'Open the strategy workflow'/)
    expect(INTELLIGENCE_SRC).toMatch(/'افتح مسار الاستراتيجية'/)
    expect(INTELLIGENCE_SRC).not.toMatch(/'Run full strategy'/)
    expect(INTELLIGENCE_SRC).not.toMatch(/'شغّل الاستراتيجية الكاملة'/)
  })

  it('D1.1 demotes competing early operating dashboard surfaces', () => {
    expect(SRC).toMatch(/onboarding\.showJourneyBar && !isEarlyExecutionDashboard/)
    expect(SRC).toMatch(/!isEarlyExecutionDashboard && \(\s*<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">/)
    expect(SRC).toMatch(/!isEarlyExecutionDashboard && \(\s*<NexusGlassCard padding="lg">/)
    expect(SRC).toMatch(/href=\{isEarlyExecutionDashboard \? '\/strategy' : '\/campaigns\/new'\}/)
    expect(SRC).toMatch(/!isEarlyExecutionDashboard && <BrainLearnedSummary/)
    expect(SRC).toMatch(/!isEarlyExecutionDashboard && \(\s*<div ref=\{suggestionsSectionRef\}/)
    expect(SRC).toMatch(/\{!isEarlyExecutionDashboard && <span style=\{\{ color: 'var\(--nx-text-3\)' \}\}> 👋<\/span>\}/)
    expect(SRC).toMatch(/!isEarlyExecutionDashboard && \(\s*<div className="flex items-center gap-2">/)
    expect(SRC).toMatch(/Active campaigns/)
    expect(SRC).toMatch(/الحملات النشطة/)
  })
})
