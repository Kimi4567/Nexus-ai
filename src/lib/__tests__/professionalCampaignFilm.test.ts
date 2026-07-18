import { describe, expect, it } from 'vitest'
import {
  buildProfessionalCampaignFilmBrief,
  PROFESSIONAL_CAMPAIGN_FILM_DURATION_SECONDS,
} from '../professionalCampaignFilm'

describe('professional campaign film brief', () => {
  it('builds a three-shot Arabic fashion film with exact total duration', () => {
    const brief = buildProfessionalCampaignFilmBrief({
      brandName: 'NOORAYA',
      industry: 'Abaya fashion',
      primaryOffer: 'Deep navy embroidered abayas',
      caption: 'أناقة تتحرك معك. تفاصيل مصممة لكل يوم.',
    })

    expect(brief.shots).toHaveLength(3)
    expect(brief.shots.reduce((sum, shot) => sum + shot.duration, 0)).toBe(PROFESSIONAL_CAMPAIGN_FILM_DURATION_SECONDS)
    const prompts = brief.shots.map(shot => shot.prompt).join(' ')
    expect(prompts).toContain('No captions')
    expect(prompts).not.toMatch(/render|typeset|write (?:the )?(?:caption|copy|text)/i)
    expect(brief.overlayCopy).toMatchObject({
      brand: 'NOORAYA',
      language: 'ar',
      hook: 'أناقة تتحرك معك',
    })
  })

  it('does not promise a static image-motion result', () => {
    const brief = buildProfessionalCampaignFilmBrief({
      brandName: 'NEXUS',
      industry: 'SaaS',
      caption: 'Turn strategy into execution. Keep every decision reviewable.',
    })

    expect(brief.creativeDirection).toContain('No generic slideshow or static image motion')
    expect(brief.shots.every(shot => /action|motion|camera|using|subject/i.test(shot.prompt))).toBe(true)
  })

  it('keeps Arabic ad overlays short enough for a premium mobile composition', () => {
    const brief = buildProfessionalCampaignFilmBrief({
      brandName: 'NOORAYA',
      industry: 'Abaya fashion',
      caption: 'تألقي بأناقة كل يوم مع عباياتنا. اكتشفي المزيد عن الأناقة اليومية.',
    })

    expect(brief.overlayCopy.hook).toBe('تألقي بأناقة كل يوم')
    expect(brief.overlayCopy.hook.length).toBeLessThanOrEqual(28)
    expect(brief.overlayCopy.benefit.length).toBeLessThanOrEqual(36)
  })
})
