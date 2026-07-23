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

  it('honors an approved people-free concept direction without inventing a customer or process', () => {
    const brief = buildProfessionalCampaignFilmBrief({
      brandName: 'Luma Roast Lab',
      industry: 'Coffee subscription',
      primaryOffer: 'One kilogram monthly',
      caption: 'هل يساعدك الاشتراك الشهري؟ راجع الكمية والسعر قبل الطلب.',
      videoDirection: 'Use neutral close-up details and abstract transitions. Use no people, hands, customer or expert likenesses, labels, readable text, branded facilities, or implied process evidence.',
    })

    const prompts = brief.shots.map(shot => shot.prompt).join(' ')
    expect(prompts).toContain('No people, faces, hands')
    expect(prompts).toContain('generic unbranded category materials')
    expect(prompts).toContain('No people, faces, hands, staff, customers, experts, packaging, containers, jars, cups, pouring, brewing, serving, tasting')
    expect(prompts).toContain('no documentary proof or process evidence')
    expect(prompts).not.toContain('same adult lead')
    expect(prompts).not.toContain('target customer')
    expect(prompts).not.toContain('real use situation')
    expect(prompts).toContain('Campaign context: Luma Roast Lab. Coffee subscription')
    expect(brief.shots.every(shot => shot.prompt.length <= 512)).toBe(true)
    expect(brief.overlayCopy.cta).toBe('عرض التفاصيل')
  })

  it('treats long exclusion lists from production directions as people-free concept films', () => {
    const brief = buildProfessionalCampaignFilmBrief({
      brandName: 'Luma Roast Lab Certification',
      industry: 'Coffee subscription',
      primaryOffer: '1kg freshly roasted monthly, AED149',
      caption: 'هل يناسبك اشتراك قهوة شهري؟ راجع الكمية والسعر والتوصيل قبل الطلب.',
      videoDirection: 'Generated concept film only; no real-product fidelity claim. Use no screens, screenshots, readable text, logos, customer or expert likenesses, branded facilities, proof or implied operational evidence.',
    })

    const prompts = brief.shots.map(shot => shot.prompt).join(' ')
    expect(prompts).toContain('No people, faces, hands')
    expect(prompts).toContain('no documentary proof or process evidence')
    expect(prompts).toContain('generic unbranded category materials')
    expect(prompts).toContain('containers, jars, cups, pouring, brewing, serving, tasting')
    expect(prompts).not.toContain('category objects')
    expect(prompts).not.toMatch(/same adult|target customer|real use situation/i)
    expect(brief.overlayCopy.cta).toBe('عرض التفاصيل')
  })
})
