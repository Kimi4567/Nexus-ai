import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = readFileSync(
  resolve(process.cwd(), 'src/app/campaigns/[id]/content-hub/page.tsx'),
  'utf8',
)

const CAMPAIGN_FILM_PANEL_COPY = 'A complete ad film — not an animated still'

describe('Content Hub — Video Studio layout', () => {
  it('renders the campaign-film explanation exactly once inside Video Studio', () => {
    const panelIndex = SRC.indexOf(CAMPAIGN_FILM_PANEL_COPY)
    const studioIndex = SRC.indexOf('id="nexus-video-studio-title"')
    const executionContractIndex = SRC.indexOf(
      "isAr ? 'عقد التنفيذ' : 'Execution contract'",
      panelIndex,
    )

    expect(panelIndex).toBeGreaterThan(studioIndex)
    expect(panelIndex).toBeLessThan(executionContractIndex)
    expect(SRC.match(new RegExp(CAMPAIGN_FILM_PANEL_COPY, 'g'))).toHaveLength(1)
  })

  it('keeps the bulk image action free of Video Studio campaign-film content', () => {
    const bulkImageButtonIndex = SRC.indexOf('openBulkImageConfirm')
    const videoStudioIndex = SRC.indexOf('id="nexus-video-studio-title"')
    const bulkImageSection = SRC.slice(bulkImageButtonIndex, videoStudioIndex)

    expect(bulkImageButtonIndex).toBeGreaterThan(-1)
    expect(videoStudioIndex).toBeGreaterThan(bulkImageButtonIndex)
    expect(bulkImageSection).not.toContain(CAMPAIGN_FILM_PANEL_COPY)
  })
})
