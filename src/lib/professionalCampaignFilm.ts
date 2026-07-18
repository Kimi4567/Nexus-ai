export const PROFESSIONAL_CAMPAIGN_FILM_DURATION_SECONDS = 10 as const
export const PROFESSIONAL_CAMPAIGN_FILM_PROVIDER_CREDITS_ESTIMATE = 130
export const PROFESSIONAL_CAMPAIGN_FILM_PROVIDER_COST_USD_ESTIMATE = 1.3
export const PROFESSIONAL_CAMPAIGN_FILM_COMPOSITOR_VERSION = '2026-07-arabic-2' as const

export type ProfessionalCampaignFilmShot = {
  prompt: string
  duration: number
}

export type ProfessionalCampaignFilmBrief = {
  shots: ProfessionalCampaignFilmShot[]
  overlayCopy: {
    brand: string
    hook: string
    benefit: string
    cta: string
    language: 'ar' | 'en'
  }
  creativeDirection: string
}

function compact(value: unknown, limit: number): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, limit)
    : ''
}

function compactAtWordBoundary(value: unknown, limit: number): string {
  const normalized = compact(value, Math.max(limit + 24, limit))
  if (normalized.length <= limit) return normalized
  const candidate = normalized.slice(0, limit + 1)
  const wordBoundary = candidate.lastIndexOf(' ')
  return candidate
    .slice(0, wordBoundary >= Math.floor(limit * 0.62) ? wordBoundary : limit)
    .trim()
    .replace(/\s+(?:مع|في|من|على|إلى|عن|the|with|for|and|to)$/i, '')
}

function containsArabic(value: string): boolean {
  return /[\u0600-\u06FF]/.test(value)
}

function sentences(value: string): string[] {
  return value
    .split(/(?<=[.!?؟])\s+|[\n\r]+/)
    .map(item => item.trim().replace(/[.!?؟]+$/, ''))
    .filter(Boolean)
}

function safePromptAnchor(input: {
  brandName?: unknown
  industry?: unknown
  primaryOffer?: unknown
  description?: unknown
  videoDirection?: unknown
}): string {
  return [
    compact(input.brandName, 80),
    compact(input.industry, 100),
    compact(input.primaryOffer, 180),
    compact(input.description, 220),
    compact(input.videoDirection, 220),
  ].filter(Boolean).join('. ').slice(0, 480)
}

function finalizeShotPrompt(creative: string, anchor: string, brand: string): string {
  const control = 'No captions, logos, watermarks, or spoken dialogue. Generate continuous live-action-style motion; never use a still image, slideshow, framed screenshot, or frozen subject.'
  const continuity = `Campaign: ${anchor || `${brand} approved campaign`}. Keep the same adult lead, featured offer, premium art direction, and colors across all shots. Natural human and camera motion, physically plausible movement, commercial lighting.`
  return `${control} ${creative} ${continuity}`.slice(0, 512)
}

/**
 * Builds a bounded three-shot paid-social film from approved Brand Brain and
 * post copy. Generated footage contains no raster text; exact typography is
 * composed later by NEXUS so Arabic/English copy remains controllable.
 */
export function buildProfessionalCampaignFilmBrief(input: {
  brandName?: unknown
  industry?: unknown
  primaryOffer?: unknown
  description?: unknown
  caption?: unknown
  videoDirection?: unknown
}): ProfessionalCampaignFilmBrief {
  const brand = compact(input.brandName, 44) || 'Brand'
  const caption = compact(input.caption, 360)
  const lines = sentences(caption)
  const language: 'ar' | 'en' = containsArabic(caption) ? 'ar' : 'en'
  const fashion = /fashion|apparel|clothing|abaya|modest|garment|\u0639\u0628\u0627\u064a|\u0623\u0632\u064a\u0627\u0621|\u0645\u0644\u0627\u0628\u0633/i.test([
    compact(input.industry, 120),
    compact(input.primaryOffer, 180),
    compact(input.description, 240),
    caption,
  ].join(' '))
  const anchor = safePromptAnchor(input)
  const shots = fashion ? [
    {
      duration: 3,
      prompt: finalizeShotPrompt('Scroll-stopping vertical luxury fashion-commercial opening. A confident adult woman enters a refined contemporary setting wearing the hero garment; she walks naturally and the fabric moves with her. Smooth low-angle tracking camera, elegant editorial composition, immediate visual hook.', anchor, brand),
    },
    {
      duration: 3,
      prompt: finalizeShotPrompt('Macro benefit shot: close detail of the same garment, material, cuff, trim, and silhouette while the same adult model makes a graceful turn. Embroidery and fabric catch directional light, tactile movement, controlled slow motion, premium detail cinematography.', anchor, brand),
    },
    {
      duration: 4,
      prompt: finalizeShotPrompt('Hero payoff. The same adult woman in the same garment steps into flattering light, turns confidently, and the fabric flows. Cinematic camera arc resolves into a centered hero silhouette with clean negative space for a later brand end-card overlay. Premium instrumental fashion-ad sound design.', anchor, brand),
    },
  ] : [
    {
      duration: 3,
      prompt: finalizeShotPrompt("Scroll-stopping vertical commercial opening showing the target customer encountering the campaign's real use situation. Clear human action, purposeful camera move, premium natural lighting, immediate problem-to-interest hook.", anchor, brand),
    },
    {
      duration: 3,
      prompt: finalizeShotPrompt('Benefit demonstration in the same setting. Show the same adult subject actively using or experiencing the featured offer, with the value visually understandable through action rather than unsupported claims. Macro and medium detail coverage, polished commercial motion.', anchor, brand),
    },
    {
      duration: 4,
      prompt: finalizeShotPrompt('Confident hero payoff. The same adult subject reaches a clear positive outcome, followed by a clean premium composition with negative space for a later CTA end-card overlay. Deliberate camera arc, coherent finish, premium instrumental advertising sound design.', anchor, brand),
    },
  ]

  const hook = compactAtWordBoundary(lines[0], language === 'ar' ? 28 : 40)
    || (language === 'ar' ? 'لحظة تليق بك' : 'Made for your moment')
  const benefit = compactAtWordBoundary(lines[1], language === 'ar' ? 36 : 50)
    || compactAtWordBoundary(input.primaryOffer, language === 'ar' ? 36 : 50)
    || (language === 'ar' ? 'تفاصيل تصنع الفارق' : 'Details that make the difference')
  const cta = language === 'ar' ? 'اكتشفي المزيد' : 'Discover more'

  return {
    shots,
    overlayCopy: { brand, hook, benefit, cta, language },
    creativeDirection: `${brand} professional three-shot campaign film: hook, visible benefit, and deliberate branded end frame. No generic slideshow or static image motion.`,
  }
}
