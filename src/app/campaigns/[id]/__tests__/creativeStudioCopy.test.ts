import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const CAMPAIGN_SRC = readFileSync(
  resolve(process.cwd(), 'src/app/campaigns/[id]/page.tsx'),
  'utf8',
)

const STUDIO_SRC = readFileSync(
  resolve(process.cwd(), 'src/app/studio/page.tsx'),
  'utf8',
)

const VISUAL_GENERATOR_SRC = readFileSync(
  resolve(process.cwd(), 'src/components/VisualGenerator.tsx'),
  'utf8',
)

const CAMPAIGN_PROOF_SRC = readFileSync(
  resolve(process.cwd(), 'src/components/campaign/CampaignProofOfWork.tsx'),
  'utf8',
)

const TOUCHED_APP_SRC = `${CAMPAIGN_SRC}\n${STUDIO_SRC}\n${VISUAL_GENERATOR_SRC}`

describe('CS-1 creative IA copy', () => {
  it('does not claim a Canva-like or full visual design studio in touched app surfaces', () => {
    expect(TOUCHED_APP_SRC).not.toMatch(/Canva/)
    expect(TOUCHED_APP_SRC).not.toMatch(/full Creative Studio/)
    expect(TOUCHED_APP_SRC).not.toMatch(/design anything/)
  })

  it('keeps campaign creative workflow copy planning and review oriented', () => {
    expect(CAMPAIGN_SRC).not.toMatch(/Brand Brain learning loop/)
    expect(CAMPAIGN_SRC).not.toMatch(/fully automated/)
    expect(CAMPAIGN_SRC).not.toMatch(/ad-ready/)
    expect(CAMPAIGN_SRC).not.toMatch(/publish-ready/)
    expect(CAMPAIGN_SRC).toMatch(/Final post media is reviewed in Content Hub/)
    expect(CAMPAIGN_SRC).toMatch(/Campaign concept visuals are gallery assets for review/)
    expect(CAMPAIGN_SRC).toMatch(/NEXUS does not publish, schedule, or start paid campaigns from this tab/)
  })

  it('makes the Creative tab follow the selected strategy scope and campaign state', () => {
    expect(CAMPAIGN_SRC).toContain('creativeStrategyScopeLabel')
    expect(CAMPAIGN_SRC).toContain('Creative path for organic strategy only')
    expect(CAMPAIGN_SRC).toContain('Creative path for paid planning only')
    expect(CAMPAIGN_SRC).toContain('Creative path for a full strategy')
    expect(CAMPAIGN_SRC).toContain('Review strategy quality first')
    expect(CAMPAIGN_SRC).toContain('Prepare the content plan before creative decisions')
    expect(CAMPAIGN_SRC).toContain('This is an organic-only strategy. Paid ad creative, budget, and platform launch decisions are outside this run.')
    expect(CAMPAIGN_SRC).toContain('Paid creative is outside this strategy run')
  })

  it('keeps the campaign room first viewport focused on the practical next step', () => {
    expect(CAMPAIGN_SRC).toContain('data-campaign-first-viewport-action')
    expect(CAMPAIGN_SRC).toContain('Practical next step')
    expect(CAMPAIGN_SRC).toContain('Creative path now')
    expect(CAMPAIGN_SRC).toContain('compact />')
    expect(CAMPAIGN_PROOF_SRC).toContain('data-campaign-proof-compact')
    expect(CAMPAIGN_PROOF_SRC).toContain('compact?: boolean')
  })

  it('does not present concept visual generation as the normal next step before post and brief readiness', () => {
    expect(CAMPAIGN_SRC).toContain('creativeCanUseConceptGallery')
    expect(CAMPAIGN_SRC).toContain('creativeOperatingSequence')
    expect(CAMPAIGN_SRC).toContain('Creative brief')
    expect(CAMPAIGN_SRC).toContain('Post media decisions')
    expect(CAMPAIGN_SRC).toContain('Optional concept visuals')
    expect(CAMPAIGN_SRC).toContain('Concept gallery is not the current step')
    expect(CAMPAIGN_SRC).toContain('Content Hub posts already exist. Open the creative brief first to define asset and layer needs before any concept visual generation.')
    expect(CAMPAIGN_SRC).toContain('Review the strategy and create Content Hub posts first, then open the creative brief before any visual generation.')
    expect(CAMPAIGN_SRC).toContain('This page does not treat zero media counts as readiness.')
    expect(CAMPAIGN_SRC).toContain('Plan concept directions for review')
    expect(CAMPAIGN_SRC).not.toContain('Generate concept directions for review')
  })

  it('asks for the creative brief before post media review when a campaign has posts but no brief', () => {
    const briefGateIndex = CAMPAIGN_SRC.indexOf('if (!creativeBrief)')
    const mediaReviewIndex = CAMPAIGN_SRC.indexOf('operatingState.truthFlags.hasContentPlan && operatingState.counts.pendingGenerationPosts > 0')
    expect(briefGateIndex).toBeGreaterThan(-1)
    expect(mediaReviewIndex).toBeGreaterThan(-1)
    expect(briefGateIndex).toBeLessThan(mediaReviewIndex)
    expect(CAMPAIGN_SRC).toContain('The creative brief is the organizing step before image and layer decisions.')
  })

  it('frames the campaign visual generator as concept-gallery output only', () => {
    expect(VISUAL_GENERATOR_SRC).toMatch(/Campaign concept visuals/)
    expect(VISUAL_GENERATOR_SRC).toMatch(/Generate campaign concept visual/)
    expect(VISUAL_GENERATOR_SRC).not.toMatch(/Generate visual['"`]/)
    expect(VISUAL_GENERATOR_SRC).not.toMatch(/Campaign Visuals/)
  })

  it('identifies studio as a text lab, not a publishing or design editor', () => {
    expect(STUDIO_SRC).toMatch(/NEX Content Lab/)
    expect(STUDIO_SRC).toMatch(/Script & Copy Lab/)
    expect(STUDIO_SRC).toMatch(/not a visual design editor/)
    expect(STUDIO_SRC).toMatch(/does not publish content/)
  })
})
