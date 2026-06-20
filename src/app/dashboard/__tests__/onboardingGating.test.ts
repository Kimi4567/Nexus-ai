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
})
