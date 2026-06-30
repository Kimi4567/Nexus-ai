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
