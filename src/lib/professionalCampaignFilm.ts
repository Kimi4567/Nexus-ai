export const PROFESSIONAL_CAMPAIGN_FILM_DURATION_SECONDS = 10 as const
export const PROFESSIONAL_CAMPAIGN_FILM_PROVIDER_CREDITS_ESTIMATE = 130
export const PROFESSIONAL_CAMPAIGN_FILM_PROVIDER_COST_USD_ESTIMATE = 1.3
export const PROFESSIONAL_CAMPAIGN_FILM_COMPOSITOR_VERSION = '2026-07-professional-layers-7' as const

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

export function buildProfessionalCampaignFilmVoiceoverScript(
  overlayCopy: ProfessionalCampaignFilmBrief['overlayCopy'],
): string {
  const separator = overlayCopy.language === 'ar' ? '، ' : '. '
  return [overlayCopy.hook, overlayCopy.benefit, overlayCopy.cta]
    .map(value => compact(value, 90))
    .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index)
    .join(separator)
    .slice(0, 240)
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

function isOfferDetailClaim(value: string): boolean {
  const hasPrice = /(?:\bAED\b|\bد\.?\s*إ\b|درهم|dirhams?|\$|€|£)\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*(?:\bAED\b|\bد\.?\s*إ\b|درهم|dirhams?|\$|€|£)/iu.test(value)
  const hasQuantity = /(?:\d+\s*(?:kg|kgs|kilograms?|g|grams?|كجم|كيلو(?:غرام)?|غرام)|كيلوغرام\s+(?:واحد|واحدة)|one\s+kilogram)/iu.test(value)
  return hasPrice && hasQuantity
}

function isDeliveryWindowClaim(value: string): boolean {
  const hasLocation = /(?:دبي|dubai)/iu.test(value)
  const hasWindow = /(?:\b48\b|٤٨)\s*(?:ساعة|ساعات|hours?|hrs?)/iu.test(value)
  return hasLocation && hasWindow
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

function finalizeShotPrompt(
  creative: string,
  anchor: string,
  brand: string,
  options: { peopleMode?: 'ADULT_LEAD' | 'NO_PEOPLE' } = {},
): string {
  const noPeople = options.peopleMode === 'NO_PEOPLE'
  if (noPeople) {
    const control = 'No people, faces, hands, staff, customers, experts, packaging, containers, jars, cups, pouring, brewing, serving, tasting, logos, labels, readable text, screens, branded facilities, watermarks, or dialogue. Use generic unbranded category materials only; no documentary proof or process evidence.'
    const context = compact(anchor || `${brand} approved campaign`, 40)
    return `${control} ${compact(creative, 160)} Campaign context: ${context}.`.slice(0, 512)
  }
  const control = 'No captions, logos, watermarks, or spoken dialogue. Generate continuous live-action-style motion; never use a still image, slideshow, framed screenshot, or frozen subject.'
  const continuity = `Campaign: ${anchor || `${brand} approved campaign`}. Keep the same adult lead, featured offer, premium art direction, and colors across all shots. Natural human and camera motion, physically plausible movement, commercial lighting.`
  return `${control} ${creative} ${continuity}`.slice(0, 512)
}

function requestsPeopleFreeConcept(value: unknown): boolean {
  const direction = compact(value, 900)
  return /(?:no|without|avoid).{0,140}(?:people|persons?|humans?|faces?|hands?|customers?|experts?|staff|employees?|likeness)|people[- ]free|person[- ]free|no real-product fidelity|generic unbranded|(?:بدون|لا).{0,80}(?:أشخاص|وجوه|أيدي|عملاء|خبراء|موظفين)/i.test(direction)
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
  const peopleFreeConcept = requestsPeopleFreeConcept(input.videoDirection)
  const offerDetailClaim = lines.find(isOfferDetailClaim) ?? ''
  const deliveryWindowClaim = lines.find(isDeliveryWindowClaim) ?? ''
  const anchor = safePromptAnchor(peopleFreeConcept
    ? { ...input, videoDirection: undefined }
    : input)
  const peopleFreeShots = deliveryWindowClaim ? [
    {
      duration: 3,
      prompt: finalizeShotPrompt('Abstract service-window concept, not operational or delivery proof: generic coffee beans and warm light cross a refined geometric city grid with a fast camera push.', anchor, brand, { peopleMode: 'NO_PEOPLE' }),
    },
    {
      duration: 3,
      prompt: finalizeShotPrompt('Conceptual timing only: no vehicle, courier, parcel, address, map, or documentary evidence. Continue the coffee-and-city geometry with precise circular motion and a match cut.', anchor, brand, { peopleMode: 'NO_PEOPLE' }),
    },
    {
      duration: 4,
      prompt: finalizeShotPrompt('Premium abstract payoff: resolve the same generic beans, light path, and city geometry into a centered moving composition with negative space for the reviewed service-window CTA.', anchor, brand, { peopleMode: 'NO_PEOPLE' }),
    },
  ] : offerDetailClaim ? [
    {
      duration: 3,
      prompt: finalizeShotPrompt('Monthly coffee-subscription concept: generic beans enter a measured repeating rhythm with a decisive macro reveal, fast camera push, contrast, and clean negative space.', anchor, brand, { peopleMode: 'NO_PEOPLE' }),
    },
    {
      duration: 3,
      prompt: finalizeShotPrompt('Continue the same beans in measured repeating rhythm and monthly cadence. Use polished macro and overhead motion with a match cut; exact price and quantity come later as typography.', anchor, brand, { peopleMode: 'NO_PEOPLE' }),
    },
    {
      duration: 4,
      prompt: finalizeShotPrompt('Offer-details payoff: resolve the same generic beans and rhythm into a centered moving composition with negative space for the reviewed quantity-and-price end card.', anchor, brand, { peopleMode: 'NO_PEOPLE' }),
    },
  ] : [
    {
      duration: 3,
      prompt: finalizeShotPrompt('Scroll-stopping vertical editorial opening. Use a decisive macro reveal of generic category raw materials with immediate purposeful movement, a fast controlled camera push, strong contrast, and clean negative space. The hook must be visually clear inside the first second without showing packaging, vessels, or process proof.', anchor, brand, { peopleMode: 'NO_PEOPLE' }),
    },
    {
      duration: 3,
      prompt: finalizeShotPrompt('Benefit concept expressed only through a coherent abstract change in the same generic raw materials: measured arrangement, repeatable rhythm, and a clear visual progression. Use polished macro and medium details, restrained abstract transitions, and no documentary, serving, or first-party evidence.', anchor, brand, { peopleMode: 'NO_PEOPLE' }),
    },
    {
      duration: 4,
      prompt: finalizeShotPrompt('Confident concept payoff. Resolve the same generic unbranded raw materials into one centered abstract hero composition with deliberate camera motion and generous clean negative space for a later CTA end card. Premium instrumental advertising sound design; no product-fidelity claim.', anchor, brand, { peopleMode: 'NO_PEOPLE' }),
    },
  ]
  const shots = peopleFreeConcept ? peopleFreeShots : fashion ? [
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

  const hook = offerDetailClaim
    ? (language === 'ar' ? 'تفاصيل الاشتراك الشهري' : 'Monthly subscription details')
    : deliveryWindowClaim
      ? (language === 'ar' ? 'تفاصيل التوصيل' : 'Delivery details')
      : compactAtWordBoundary(lines[0], language === 'ar' ? 28 : 40)
        || (language === 'ar' ? 'لحظة تليق بك' : 'Made for your moment')
  const benefit = offerDetailClaim
    ? compactAtWordBoundary(offerDetailClaim, language === 'ar' ? 64 : 72)
    : deliveryWindowClaim
      ? compactAtWordBoundary(deliveryWindowClaim, language === 'ar' ? 56 : 64)
      : compactAtWordBoundary(lines[1], language === 'ar' ? 36 : 50)
        || compactAtWordBoundary(input.primaryOffer, language === 'ar' ? 36 : 50)
        || (language === 'ar' ? 'تفاصيل تصنع الفارق' : 'Details that make the difference')
  const cta = offerDetailClaim || deliveryWindowClaim
    ? (language === 'ar' ? 'راجع التفاصيل' : 'Review the details')
    : (language === 'ar' ? 'عرض التفاصيل' : 'Discover more')
  const conceptLabel = offerDetailClaim
    ? 'reviewed offer-details concept'
    : deliveryWindowClaim
      ? 'reviewed service-window concept'
      : 'hook, visible benefit, and deliberate branded end frame'

  return {
    shots,
    overlayCopy: { brand, hook, benefit, cta, language },
    creativeDirection: `${brand} professional three-shot campaign film: ${conceptLabel}. No generic slideshow or static image motion.`,
  }
}
