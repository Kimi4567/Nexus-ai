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
})
