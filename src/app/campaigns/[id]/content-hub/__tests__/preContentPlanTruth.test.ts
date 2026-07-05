/**
 * Content Hub pre-content state must read like a marketing workflow handoff,
 * not an unexplained credit-spending button.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = readFileSync(
  resolve(process.cwd(), 'src/app/campaigns/[id]/content-hub/page.tsx'),
  'utf8',
)

describe('Content Hub — pre-content plan truth', () => {
  it('shows a strategy-to-content handoff before posts exist', () => {
    expect(SRC).toMatch(/Pre-content planning stage/)
    expect(SRC).toMatch(/strategy is the direction source/)
    expect(SRC).toMatch(/Review strategy first/)
  })

  it('requires explicit confirmation before first draft content plan generation', () => {
    expect(SRC).toMatch(/showGeneratePlanConfirm/)
    expect(SRC).toMatch(/Confirm draft content plan generation/)
    expect(SRC).toMatch(/I understand this creates draft content only for review/)
    expect(SRC).toMatch(/disabled=\{generatingPlan \|\| !generatePlanAcknowledged\}/)
  })

  it('keeps first content plan generation separate from publish and learning claims', () => {
    expect(SRC).toMatch(/No post will be approved, scheduled, or published/)
    expect(SRC).toMatch(/Autopilot is not activated/)
    expect(SRC).toMatch(/Brand Brain is not updated as performance learning/)
  })

  it('does not let the pre-content primary button call generation directly', () => {
    expect(SRC).not.toMatch(/posts\.length === 0[\s\S]{0,3000}onClick=\{contentPlanLocked \? \(\) => router\.push\('\/billing'\) : \(\) => generatePlan\(\)\}/)
  })
})
