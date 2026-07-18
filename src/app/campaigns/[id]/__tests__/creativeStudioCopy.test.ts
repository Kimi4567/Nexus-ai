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
    expect(CAMPAIGN_SRC).toMatch(/not automatically attached to posts/)
    expect(CAMPAIGN_SRC).toMatch(/Campaign concept visuals are gallery assets for review/)
    expect(CAMPAIGN_SRC).toMatch(/previews are never attached or published automatically/)
    expect(CAMPAIGN_SRC).toContain('Advanced creative tools and details')
  })

  it('makes the Creative tab follow the selected strategy scope and campaign state', () => {
    expect(CAMPAIGN_SRC).toContain('creativeStrategyScopeLabel')
    expect(CAMPAIGN_SRC).toContain('Creative path for organic strategy only')
    expect(CAMPAIGN_SRC).toContain('Creative path for paid planning only')
    expect(CAMPAIGN_SRC).toContain('Creative path for a full strategy')
    expect(CAMPAIGN_SRC).toContain('Review strategy quality first')
    expect(CAMPAIGN_SRC).toContain('Prepare the content plan before creative decisions')
    expect(CAMPAIGN_SRC).toContain('This is an organic-only run, so paid creative is not presented as an active execution step.')
    expect(CAMPAIGN_SRC).toContain('Paid creative is outside this strategy run')
  })

  it('keeps the campaign room first viewport focused on the practical next step', () => {
    expect(CAMPAIGN_SRC).toContain('data-campaign-first-viewport-action')
    expect(CAMPAIGN_SRC).toContain('Practical next step')
    expect(CAMPAIGN_SRC).toContain('Next creative step')
    expect(CAMPAIGN_SRC).not.toContain('Creative path now')
    expect(CAMPAIGN_SRC).toContain('showFullCampaignOperatingFlow')
    expect(CAMPAIGN_SRC).toContain('activeTab === 0')
    expect(CAMPAIGN_SRC).toContain('id="campaign-room-workspace"')
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
    expect(CAMPAIGN_SRC).toContain('Content Hub posts already exist. Open the creative brief planner first to define asset and layer needs before any concept visual generation.')
    expect(CAMPAIGN_SRC).toContain('Review the strategy and create Content Hub posts first, then open the creative brief planner before any visual generation.')
    expect(CAMPAIGN_SRC).toContain('This page does not treat zero media counts as readiness.')
    expect(CAMPAIGN_SRC).toContain('Review-only visual direction')
    expect(CAMPAIGN_SRC).toContain('Plan concepts and production notes without creating a final asset')
    expect(CAMPAIGN_SRC).not.toContain('Generate concept directions for review')
  })

  it('asks for the creative brief before post media review when a campaign has posts but no brief', () => {
    const briefGateIndex = CAMPAIGN_SRC.indexOf('if (!creativeBrief)')
    const mediaReviewIndex = CAMPAIGN_SRC.indexOf('operatingState.truthFlags.hasContentPlan && operatingState.counts.pendingGenerationPosts > 0')
    expect(briefGateIndex).toBeGreaterThan(-1)
    expect(mediaReviewIndex).toBeGreaterThan(-1)
    expect(briefGateIndex).toBeLessThan(mediaReviewIndex)
    expect(CAMPAIGN_SRC).toContain('The creative brief planner is the organizing step before image and layer decisions.')
    expect(CAMPAIGN_SRC).toContain('previews and assets are not automatically attached to posts')
  })

  it('frames the campaign visual generator as concept-gallery output only', () => {
    expect(VISUAL_GENERATOR_SRC).toMatch(/Campaign concept visuals/)
    expect(VISUAL_GENERATOR_SRC).toMatch(/Generate campaign concept visual/)
    expect(VISUAL_GENERATOR_SRC).not.toMatch(/Generate visual['"`]/)
    expect(VISUAL_GENERATOR_SRC).not.toMatch(/Campaign Visuals/)
  })

  it('identifies studio as a review-only creative workspace with locked execution', () => {
    expect(STUDIO_SRC).toMatch(/Creative direction preview/)
    expect(STUDIO_SRC).toContain('journeyStage="production"')
    expect(STUDIO_SRC).toMatch(/Review visual direction and brand assets before attaching media to posts/)
    expect(STUDIO_SRC).toMatch(/Confirm the creative direction/)
    expect(STUDIO_SRC).toMatch(/Generation starts from a specific post in Content Hub after cost review and confirmation/)
    expect(STUDIO_SRC).toMatch(/This desk is preview-only/)
    expect(STUDIO_SRC).toMatch(/CTA waits for an approved destination/)
    expect(STUDIO_SRC).not.toMatch(/Learn more/)
    expect(STUDIO_SRC).not.toMatch(/Confirmed generation flow later/)
    expect(STUDIO_SRC).not.toMatch(/Planned — unavailable/)
  })

  it('keeps the global studio tied to saved brand and campaign truth instead of a fragrance demo', () => {
    expect(STUDIO_SRC).toContain("fetch('/api/campaigns?limit=20&sort=updatedAt'")
    expect(STUDIO_SRC).toContain('No performance promise is shown before analytics are connected and real data exists.')
    expect(STUDIO_SRC).toContain('Saved data only')
    expect(STUDIO_SRC).toContain('Campaign or brand')
    expect(STUDIO_SRC).not.toContain('Planned — unavailable')
    expect(STUDIO_SRC).not.toMatch(/New fragrance product|premium fragrances|NEXUS PERFUMES|Shop fragrance/)
    expect(STUDIO_SRC).not.toMatch(/250K\+|8%\+|3%\+/)
  })
})
