import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Content Hub video reference routing truth', () => {
  it('routes a clicked image to product-fidelity preflight instead of discarding it in concept film', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/app/campaigns/[id]/content-hub/page.tsx'),
      'utf8',
    )

    expect(source).toContain("setVideoProductionMode(referenceMediaId ? 'CINEMATIC' : 'MOTION_DESIGN')")
    expect(source).toContain("useState<'MOTION_DESIGN' | 'CAMPAIGN_FILM' | 'CINEMATIC'>('MOTION_DESIGN')")
    expect(source).toContain('referenceMediaIds: videoReferenceMediaIds')
    expect(source).not.toContain('referenceMediaIds: professionalCampaignFilm ? [] : videoReferenceMediaIds')
    expect(source).toContain("setVideoProductionMode('CAMPAIGN_FILM')\n                      setVideoReferenceMediaIds([])")
    expect(source).toContain('CREATOR_REFERENCE_UNSUPPORTED')
    expect(source).toContain('يلزم 70/100 على الأقل')
    expect(source).not.toContain('يلزم 90/100')
  })

  it('does not promise that an unchecked image will become a matching video', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/components/content/PostCreativeMatch.tsx'),
      'utf8',
    )

    expect(source).toContain('Check product-safe video options with this asset')
    expect(source).not.toContain('Turn this asset into a video matching the copy')
  })
})
