import { describe, expect, it } from 'vitest'
import { guardConceptCreativeBrief } from '@/lib/ai/creativeBriefTruthGuard'

const context = {
  campaignName: 'Mizan Flow Cash Clarity',
  campaignGoal: 'Generate qualified demos for cash-flow and invoice software',
  audience: 'Owners and finance managers at service companies',
  brandName: 'Mizan Flow',
  allowedPlatforms: ['YOUTUBE_SHORTS', 'LINKEDIN', 'INSTAGRAM'],
}

describe('guardConceptCreativeBrief', () => {
  it('neutralizes the audited product-screen, feature, customer, and outcome inventions', () => {
    const guarded = guardConceptCreativeBrief({
      imagePrompts: [{
        platform: 'Instagram Stories',
        prompt: "A tablet displaying Mizan Flow's dashboard on a sleek desk.",
        notes: 'Show the bilingual interface.',
      }],
      storyboardScenes: [
        {
          sceneNumber: 1,
          platform: 'TikTok',
          description: "A business owner checks Mizan Flow's cash flow forecast on their phone.",
          visualNotes: 'Show the app screen.',
          textOverlay: 'Simplify your cash flow management',
        },
        {
          sceneNumber: 2,
          platform: 'Facebook Ad',
          description: 'A financial manager receives a notification on their smartwatch.',
          visualNotes: 'The customer smiles as the forecast improves.',
          textOverlay: 'Setup without a financial expert',
        },
      ],
      productionBrief: "Use laptops, tablets, and smartphones displaying Mizan Flow's interface. Talent should look satisfied.",
      creativeNotes: 'Focus on the interface and notifications to show improved cash flow.',
      platformLayouts: { facebook_ad: 'Show the dashboard.' },
    }, context)

    const corpus = JSON.stringify(guarded)
    expect(corpus).not.toMatch(/displaying Mizan Flow|show the app screen|receives a notification|customer smiles|forecast improves|without a financial expert/i)
    expect(corpus).toContain('No people, faces, hands, customers, product UI')
    expect(guarded.storyboardScenes?.every(scene => scene.textOverlay?.startsWith('none'))).toBe(true)
    expect(new Set(guarded.storyboardScenes?.map(scene => scene.platform))).toEqual(new Set(['YouTube Shorts', 'LinkedIn']))
    expect(Object.keys(guarded.platformLayouts || {})).toEqual(['youtube_shorts', 'linkedin', 'instagram_feed'])
  })

  it('rebuilds every concept field deterministically even when the model direction looks safe', () => {
    const guarded = guardConceptCreativeBrief({
      imagePrompts: [{
        platform: 'LinkedIn',
        prompt: 'Abstract invoice cards, due-date markers, and connected review checkpoints in a calm editorial grid.',
        notes: 'Keep typography separate.',
      }],
      storyboardScenes: [{
        sceneNumber: 1,
        platform: 'LinkedIn',
        description: 'Abstract invoice cards move into a review queue.',
        visualNotes: 'Static editorial composition with restrained transitions.',
        textOverlay: 'Review cash flow',
      }],
      productionBrief: 'Produce abstract editorial cards and connectors with clean negative space.',
      moodDescription: 'A friendly product mood.',
      creativeNotes: 'End with the brand logo and CTA.',
    }, context)

    expect(guarded.imagePrompts?.[0].prompt).toContain('abstract invoice cards')
    expect(guarded.imagePrompts?.[0].platform).toBe('YouTube Shorts')
    expect(guarded.imagePrompts?.[0].style).toBe('Abstract editorial workflow system with neutral category symbols')
    expect(guarded.storyboardScenes?.[0].description).not.toContain('move into a review queue')
    expect(guarded.storyboardScenes?.[0].visualNotes).not.toContain('Static editorial composition')
    expect(guarded.storyboardScenes?.[0].textOverlay).toContain('separate editable layer')
    expect(guarded.productionBrief).toContain('review-only abstract editorial background plates')
    expect(guarded.moodDescription).toContain('without depicting product use or customer outcomes')
    expect(guarded.creativeNotes).not.toContain('End with the brand logo')
  })
})
