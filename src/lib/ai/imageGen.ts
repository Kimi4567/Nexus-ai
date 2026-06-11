/**
 * NEXUS Visual Intelligence — Professional Ad Image Prompt Builder
 *
 * Generates advertising-agency-grade image prompts by combining:
 *   1. Caption analysis  → what specific scene to show (via GPT-4o mini)
 *   2. Brand Brain       → colors, industry, tone, brand name
 *   3. Language          → Arabic or English (drives text rendering strategy)
 *   4. Platform          → dimensions and composition format
 *
 * Design philosophy: every generated image must feel like it came from a
 * world-class advertising agency, not a generic AI image tool.
 * Each post caption drives a UNIQUE visual concept — two posts from the same
 * brand should look distinctly different.
 *
 * Text strategy (both languages — background-only approach):
 *   AI model      → generates a text-free background scene (explicit NO_TEXT instruction)
 *   English posts → brandComposite adds headline as SVG text layer via Sharp
 *   Arabic posts  → brandComposite adds headline via Satori + Noto Naskh Arabic (RTL)
 *   Sharp         → platform crop + logo overlay + brand accent bar (both languages)
 *   This ensures zero garbled/wrong AI text in any generated image.
 */

import {
  detectLanguage,
  extractVisualConcept,
  type VisualConcept,
} from '@/lib/ai/conceptExtractor'

// ─── Types ────────────────────────────────────────────────────────────────────

export type VisualStyle =
  | 'Minimal'
  | 'Luxury'
  | 'Corporate'
  | 'Editorial'
  | 'Cinematic'
  | 'Bold'
  | 'Gen Z'
  | 'Premium'
  | 'Futuristic'
  | 'Elegant'

export type VisualType = 'HERO' | 'SOCIAL_PREVIEW' | 'AD_CREATIVE' | 'THUMBNAIL' | 'ALTERNATE'

export interface VisualContext {
  // User-selected layout choices (kept for backward compat)
  visualType: VisualType
  visualStyle: VisualStyle
  // Campaign fields
  campaignName?: string
  campaignGoal?: string
  campaignTone?: string
  audience?: string
  // Brand Brain — primary drivers of visual quality
  brandName?: string
  brandToneWords?: string[]
  primaryOffer?: string
  industry?: string
  colorPalette?: string       // e.g. "deep blue, #4f46e5, gold"
  visualStylePref?: string
  uniqueAdvantages?: string
  // Strategy fields
  positioning?: string
  visualDirection?: string
  differentiation?: string
  keyMessage?: string
  // Post-level creative brief — THIS is the primary driver
  postCaption?: string
  // Platform (passed from route for dimension-aware composition)
  platform?: string           // META | INSTAGRAM | TIKTOK | LINKEDIN
}

// ─── Brand category detection ─────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  saas_ai_tech: [
    'saas', 'software', 'ai', 'artificial intelligence', 'machine learning',
    'platform', 'app', 'application', 'digital', 'tech', 'technology',
    'automation', 'crm', 'analytics', 'data', 'cloud', 'b2b', 'dashboard',
    'workflow', 'agent', 'martech', 'operating system', 'startup', 'api',
    'nexus', 'plugin', 'integration', 'devops', 'cybersecurity',
  ],
  real_estate: [
    'real estate', 'property', 'realty', 'housing', 'apartments', 'villas',
    'condos', 'townhouse', 'mortgage', 'residential', 'commercial property',
    'land', 'broker', 'developer', 'rental', 'leasing', 'عقارات', 'عقار',
  ],
  food_beverage: [
    'restaurant', 'café', 'cafe', 'food', 'beverage', 'bakery', 'catering',
    'coffee', 'bar', 'dining', 'cuisine', 'meal', 'menu', 'chef', 'bistro',
    'delivery', 'takeaway', 'grocery', 'snack', 'dessert', 'مطعم', 'مقهى',
  ],
  health_wellness: [
    'clinic', 'medical', 'health', 'wellness', 'fitness', 'gym', 'pharmacy',
    'dental', 'doctor', 'hospital', 'therapy', 'nutrition', 'supplement',
    'spa', 'rehab', 'physiotherapy', 'mental health', 'yoga', 'عيادة', 'صحة',
  ],
  retail_fashion: [
    'retail', 'fashion', 'clothing', 'boutique', 'store', 'e-commerce',
    'apparel', 'accessories', 'jewelry', 'shoes', 'collection', 'wardrobe',
    'style', 'beauty', 'cosmetics', 'skincare', 'ملابس', 'متجر',
  ],
  agency_consultancy: [
    'agency', 'consultancy', 'consulting', 'marketing agency', 'design studio',
    'branding', 'creative agency', 'pr agency', 'advertising', 'digital agency',
    'media agency', 'strategy firm', 'management consulting',
  ],
  education: [
    'school', 'academy', 'courses', 'e-learning', 'tutoring', 'training',
    'university', 'college', 'learning', 'education', 'bootcamp', 'workshop',
    'certification', 'coaching', 'skills', 'teaching', 'تعليم', 'أكاديمية',
  ],
  finance: [
    'finance', 'investment', 'banking', 'insurance', 'fintech', 'trading',
    'wealth', 'fund', 'portfolio', 'accounting', 'tax', 'crypto', 'financial',
    'stock', 'broker', 'venture capital', 'استثمار', 'مالية',
  ],
}

export type BrandCategory =
  | 'saas_ai_tech'
  | 'real_estate'
  | 'food_beverage'
  | 'health_wellness'
  | 'retail_fashion'
  | 'agency_consultancy'
  | 'education'
  | 'finance'
  | 'general'

export interface BrandDetectionContext {
  industry?: string
  brandName?: string
  campaignName?: string
  primaryOffer?: string
  positioning?: string
  differentiation?: string
}

export function detectBrandCategory(ctx: BrandDetectionContext): BrandCategory {
  const text = [
    ctx.industry, ctx.brandName, ctx.campaignName, ctx.primaryOffer,
    ctx.positioning, ctx.differentiation,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      return category as BrandCategory
    }
  }
  return 'general'
}

// ─── Industry visual styles ───────────────────────────────────────────────────

interface IndustryStyle {
  photography: string
  lighting:    string
  mood:        string
  atmosphere:  string
  benchmark:   string
}

const INDUSTRY_STYLES: Record<string, IndustryStyle> = {
  food_beverage: {
    photography: 'cinematic food photography, Michelin-star presentation quality, appetizing hero close-up',
    lighting:    'warm golden-hour ambient light, steam effects, shallow depth-of-field bokeh, rich texture',
    mood:        'indulgent, sensory, warm, authentic, mouth-watering',
    atmosphere:  'restaurant ambiance, culinary artistry, inviting warmth, rich food textures',
    benchmark:   'Nobu, Deliveroo Premium, Four Seasons Restaurant advertising',
  },
  health_wellness: {
    photography: 'clean editorial healthcare and wellness photography with human warmth',
    lighting:    'crisp cool-white clinical light balanced with warm human touches, conveying hope and precision',
    mood:        'trustworthy, healing, professional, compassionate, innovative',
    atmosphere:  'modern medical facility, wellness sanctuary, precision and care, clean open spaces',
    benchmark:   'Mayo Clinic, Apple Health, Headspace, Therabody premium campaigns',
  },
  real_estate: {
    photography: 'architectural and luxury interior / exterior photography',
    lighting:    'golden-hour property photography or bright airy natural-light interiors',
    mood:        'aspirational, premium, lifestyle-defining, investment-grade, exclusive',
    atmosphere:  'luxury finishes, spacious layouts, prestigious locations, lifestyle imagery',
    benchmark:   "Sotheby's International Realty, Emaar Properties, Airbnb Luxe advertising",
  },
  saas_ai_tech: {
    photography: 'clean minimal premium tech brand advertising, abstract soft gradient background — NO complex dashboard UI, NO floating widgets, NO data charts, NO computer screens',
    lighting:    'cinematic soft gradient light with brand color depth, subtle atmospheric glow, generous negative space',
    mood:        'powerful, innovative, empowering, intelligent, premium, elegant',
    atmosphere:  'clean dark gradient background with subtle abstract geometric light shapes, professional open space for text — pure premium brand visual, not a technology screenshot',
    benchmark:   'Stripe, Linear, Notion, Figma, Vercel — clean minimal premium campaign advertising quality',
  },
  retail_fashion: {
    photography: 'editorial fashion photography or luxury product hero shot',
    lighting:    'dramatic studio lighting with rim highlights or moody editorial side light',
    mood:        'confident, aspirational, stylish, luxurious, statement-making',
    atmosphere:  'high-fashion editorial, premium retail aesthetic, aspirational lifestyle',
    benchmark:   'Vogue editorial, Gucci, Balenciaga, Zara premium campaign advertising',
  },
  agency_consultancy: {
    photography: 'clean minimal premium brand advertising with abstract editorial depth — NO stock office photos, NO generic workspace imagery',
    lighting:    'dramatic soft directional light, creative depth, bold contrast with generous negative space',
    mood:        'intelligent, results-driven, creative, confident, premium',
    atmosphere:  'clean minimal abstract background with strategic visual metaphors, premium editorial negative space for bold typography',
    benchmark:   'Wieden+Kennedy, Ogilvy, BBDO, Apple — premium agency campaign advertising',
  },
  education: {
    photography: 'inspiring learning environment or knowledge journey editorial photography',
    lighting:    'bright, clean, hopeful — natural or warm studio light with optimism',
    mood:        'inspiring, empowering, growth-focused, accessible, forward-looking',
    atmosphere:  'motivational learning spaces, knowledge and possibility, clear path to growth',
    benchmark:   'Coursera, MasterClass, Harvard Extension, Duolingo premium campaigns',
  },
  finance: {
    photography: 'premium financial brand photography — abstract wealth, growth, or trust imagery',
    lighting:    'authoritative cool professional tones with warm gold-accent highlights',
    mood:        'trustworthy, authoritative, premium, growth-focused, stable',
    atmosphere:  'wealth management precision, financial confidence, exclusive professional club',
    benchmark:   'Goldman Sachs, American Express Platinum, Bloomberg premium ads',
  },
  general: {
    photography: 'clean premium commercial photography with professional production value and open negative space',
    lighting:    'dramatic soft studio lighting with clear focal point and atmospheric depth',
    mood:        'professional, premium, trustworthy, aspirational',
    atmosphere:  'polished brand environment with clear visual hierarchy, premium feel, and clean negative space for typography',
    benchmark:   'Fortune 500 brand advertising quality',
  },
}

// ─── Color mood parser ────────────────────────────────────────────────────────

function parseColorMood(palette: string): string {
  if (!palette) return 'deep premium dark tones with sophisticated accents'
  const lower = palette.toLowerCase()

  const hex = palette.match(/#([0-9a-fA-F]{6})/)?.[1]
  if (hex) {
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    if (r > 160 && r > g * 1.6 && r > b * 1.6) return 'bold passionate crimson-red atmosphere, deep red accents'
    if (b > 160 && b > r * 1.4 && b > g * 1.2) return 'deep trusted navy-blue atmosphere, cool professional tones'
    if (g > 160 && g > r * 1.3 && g > b * 1.3) return 'fresh natural emerald-green atmosphere, organic growth tones'
    if (r > 140 && g > 100 && b < 90)           return 'warm golden-amber luxury atmosphere, rich organic tones'
    if (r > 110 && b > 110 && g < 90)           return 'premium deep violet-purple atmosphere, creative luminous accents'
    if (r > 200 && g > 160 && b < 80)           return 'luxury gold and warm amber atmosphere, premium metallic tones'
    if (r < 60  && g < 60  && b < 60)           return 'premium deep black and charcoal atmosphere, high contrast'
    if (r > 200 && g > 200 && b > 200)          return 'clean premium white and light atmosphere, airy minimal tones'
  }

  if (lower.match(/purple|violet|indigo/))   return 'premium deep violet-purple atmosphere, creative luminous accents'
  if (lower.match(/blue|navy|cobalt/))        return 'deep trusted navy-blue atmosphere, cool professional tones'
  if (lower.match(/red|crimson|scarlet/))     return 'bold passionate crimson atmosphere, high-energy red tones'
  if (lower.match(/green|emerald|forest/))    return 'fresh natural emerald-green atmosphere, organic growth tones'
  if (lower.match(/gold|amber|orange/))       return 'warm golden-amber luxury atmosphere, rich premium tones'
  if (lower.match(/black|dark|charcoal/))     return 'premium deep black and charcoal atmosphere, high contrast'
  if (lower.match(/white|clean|minimal/))     return 'clean premium white and light atmosphere, airy tones'
  if (lower.match(/pink|rose/))               return 'soft romantic rose-pink atmosphere, feminine premium tones'
  if (lower.match(/teal|cyan|mint/))          return 'fresh modern teal-cyan atmosphere, contemporary tones'

  return `${palette.slice(0, 60)} brand color atmosphere with premium depth`
}

// ─── Platform composition hint ────────────────────────────────────────────────

function getPlatformHint(platform?: string): string {
  const p = (platform || 'META').toUpperCase()
  if (p === 'TIKTOK')    return 'vertical portrait format (9:16), tall composition, focal point in upper-center'
  if (p === 'LINKEDIN')  return 'wide landscape format (16:9), professional horizontal layout, strong visual flow'
  if (p === 'INSTAGRAM') return 'square format (1:1), balanced centered composition, social-media native hierarchy'
  return 'versatile square or near-square composition, balanced centered layout'
}

// ─── English prompt builder ───────────────────────────────────────────────────

function buildEnglishAdPrompt(
  ctx: VisualContext,
  concept: VisualConcept,
  colorMood: string,
  style: IndustryStyle
): string {
  const brandName    = ctx.brandName || 'Brand'
  const platformHint = getPlatformHint(ctx.platform)
  const toneWords    = (ctx.brandToneWords || []).slice(0, 3).join(', ')

  return `Create a world-class professional advertising BACKGROUND VISUAL for ${brandName}.
Text, headlines, and brand copy will be composited as a separate layer — DO NOT include any
text, words, letters, numbers, logos, or typography anywhere in the image.

ADVERTISEMENT QUALITY: ${style.benchmark} level — advertising agency production, not stock photography.

CENTRAL VISUAL SCENE:
${concept.centralElement}

ATMOSPHERE & BACKGROUND:
${colorMood} as the dominant atmospheric color tone.
${style.photography}.
Lighting: ${style.lighting}.
Mood: ${concept.visualMood}.
${style.atmosphere}.

EMOTIONAL TONE: ${concept.emotion}${toneWords ? `. Brand voice: ${toneWords}` : ''}.

VISUAL COMPOSITION:
• ${platformHint}
• Clear visual hierarchy: one dominant hero element, supporting context, atmospheric depth
• Leave clean open negative space (lower 35–45% of the frame) for text overlay
• Soft gradient fade toward the bottom for text legibility
• Cinematic depth of field — foreground richness with atmospheric background
• Premium feel throughout — high-budget campaign aesthetic

CRITICAL: Absolutely NO text, NO words, NO letters, NO numbers, NO watermarks, NO logos,
NO typography of any kind anywhere in the image. The scene must be 100% visual, zero text.
This is background art — all copy will be added programmatically on top.

QUALITY BAR:
This image must look like a high-budget advertising campaign background.
Think: premium full-page magazine photo or top-tier social media visual without any overlaid text.
NOT acceptable: stock photography feel, generic backgrounds, flat composition, amateur layouts.`
}

// ─── Arabic prompt builder ────────────────────────────────────────────────────

/**
 * Arabic ad background generator.
 *
 * Strategy: gpt-image-1 is UNRELIABLE at rendering Arabic text (produces garbled
 * characters). We therefore generate a BACKGROUND-ONLY scene here, then composite
 * perfectly-shaped Arabic text as a separate layer using Satori + Noto Naskh Arabic.
 *
 * This two-step approach guarantees pixel-perfect Arabic typography regardless of
 * which image model is used.
 */
function buildArabicAdPrompt(
  ctx: VisualContext,
  concept: VisualConcept,
  colorMood: string,
  style: IndustryStyle
): string {
  const brandName    = ctx.brandName || 'Brand'
  const platformHint = getPlatformHint(ctx.platform)
  const toneWords    = (ctx.brandToneWords || []).slice(0, 3).join(', ')

  return `Create a world-class professional advertising BACKGROUND VISUAL for ${brandName}.
This image is for an Arabic-language advertisement targeting Arabic-speaking audiences.
Typography and Arabic text will be composited as a separate layer — DO NOT include any text,
words, letters, or typography anywhere in the image.

ADVERTISEMENT QUALITY: ${style.benchmark} standard.

CENTRAL VISUAL SCENE:
${concept.centralElement}

VISUAL STYLE & ATMOSPHERE:
${colorMood} as the dominant atmospheric color.
${style.photography}.
Lighting: ${style.lighting}.
Overall mood: ${concept.visualMood}.
${style.atmosphere}.

COMPOSITION:
• ${platformHint}
• Leave clean open negative space in the lower 35–45% of the image for text overlay
• Upper portion: hero visual scene with atmospheric depth
• Soft gradient fade toward bottom to ensure text legibility

CRITICAL REQUIREMENT:
Absolutely NO text, NO words, NO Arabic calligraphy, NO numbers, NO letters anywhere.
This must be a pure photographic / illustrative background.

EMOTIONAL TONE: ${concept.emotion}${toneWords ? `. Brand voice: ${toneWords}` : ''}.

QUALITY BAR: ${style.benchmark} background visual.
Reference aesthetic: Emaar, Emirates Airlines, Aldar Properties — premium Middle Eastern brand advertising backgrounds.`
}

// ─── Brand-level fallback (no caption) ───────────────────────────────────────

function buildBrandLevelPrompt(
  ctx: VisualContext,
  colorMood: string,
  style: IndustryStyle,
  language: 'ar' | 'en'
): string {
  const brandName    = ctx.brandName || 'Brand'
  const platformHint = getPlatformHint(ctx.platform)
  const offer        = ctx.primaryOffer || ctx.positioning || ctx.keyMessage || ''

  if (language === 'ar') {
    return `Create a premium brand advertising visual for ${brandName}.
${offer ? `Brand promise: ${offer}` : ''}
Style: ${style.photography}. ${style.lighting}.
Atmosphere: ${colorMood}. ${style.atmosphere}.
Quality: ${style.benchmark} advertising level.
Include Arabic brand name "${brandName}" prominently with impactful Arabic headline.
${platformHint}. Premium, aspirational, world-class quality.`
  }

  return `Create a premium brand advertising visual for ${brandName}.
${offer ? `Brand promise: "${offer}"` : ''}
Style: ${style.photography}. ${style.lighting}.
Atmosphere: ${colorMood}. ${style.atmosphere}.
Quality: ${style.benchmark} advertising level.
Include brand name "${brandName}" prominently with bold headline.
${platformHint}. Premium, aspirational, world-class quality.`
}

// ─── Main async prompt builder ────────────────────────────────────────────────

/**
 * Build a professional advertising prompt from Brand Brain + post caption.
 *
 * This is the core function that powers ALL image generation in NEXUS.
 * Returns the prompt string, detected language, AND the extracted visual concept
 * so downstream callers (route.ts) can composite Arabic text correctly.
 *
 * For Arabic posts: returns a background-only prompt — the concept.headline is
 * meant to be rendered as a separate typography layer via Satori (see arabicText.ts).
 */
export async function buildImagePrompt(ctx: VisualContext): Promise<{
  prompt: string
  language: 'ar' | 'en'
  concept?: VisualConcept
}> {
  // 1. Determine caption text to analyze
  const captionText = ctx.postCaption
    || ctx.keyMessage
    || ctx.primaryOffer
    || ctx.campaignName
    || ''

  // 2. Detect language
  const language = detectLanguage(captionText)

  // 3. Get industry style
  const category = detectBrandCategory(ctx)
  const style    = INDUSTRY_STYLES[category] || INDUSTRY_STYLES.general

  // 4. Parse brand color mood
  const rawPalette = Array.isArray(ctx.colorPalette)
    ? (ctx.colorPalette as string[]).join(', ')
    : (ctx.colorPalette || '')
  const colorMood = parseColorMood(rawPalette)

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[imageGen] category=${category} language=${language} platform=${ctx.platform || 'META'}`)
  }

  // 5. No text → use brand-level prompt (no concept extraction needed)
  if (!captionText.trim()) {
    const prompt = buildBrandLevelPrompt(ctx, colorMood, style, language)
    return { prompt, language }
  }

  // 6. Extract visual concept from caption via GPT-4o mini
  const concept = await extractVisualConcept({
    text:      captionText,
    industry:  ctx.industry || category,
    brandName: ctx.brandName || 'Brand',
    language,
  })

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[imageGen] headline="${concept.headline}" | scene="${concept.centralElement.slice(0, 80)}..."`)
  }

  // 7. Build the prompt for the correct language.
  //    Arabic → background-only (text composited separately via Satori)
  //    English → full ad with AI-rendered text
  const prompt = language === 'ar'
    ? buildArabicAdPrompt(ctx, concept, colorMood, style)
    : buildEnglishAdPrompt(ctx, concept, colorMood, style)

  return { prompt, language, concept }
}

// ─── Image generation ─────────────────────────────────────────────────────────

/**
 * Generate image via gpt-image-1 (same model as ChatGPT).
 * Returns a data URI (base64 PNG).
 */
export async function generateWithDallE(
  prompt: string,
  size: '1024x1024' | '1024x1536' | '1536x1024' = '1536x1024'
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  if (process.env.NODE_ENV !== 'production') {
    console.log('[imageGen] gpt-image-1 | size:', size, '| prompt:', prompt.slice(0, 200) + '…')
  }

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model:   'gpt-image-1',
      prompt,
      n:       1,
      size,
      quality: 'high',
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(
      (err as { error?: { message?: string } })?.error?.message
      || `Image generation API error: ${response.status}`
    )
  }

  const data = await response.json()
  const b64  = (data as { data?: Array<{ b64_json?: string }> })?.data?.[0]?.b64_json
  if (!b64) throw new Error('Image generation returned no image data')

  return `data:image/png;base64,${b64}`
}

// ─── Cloudinary upload ────────────────────────────────────────────────────────

/**
 * Upload a data URI or URL to Cloudinary for permanent storage.
 * Falls back gracefully if Cloudinary is not configured.
 */
export async function uploadToCloudinary(imageUrl: string, publicId: string): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey    = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    console.warn('[imageGen] Cloudinary not configured — image will be ephemeral')
    return imageUrl
  }

  const timestamp = Math.round(Date.now() / 1000)
  const folder    = 'nexus/visuals'

  const crypto    = await import('crypto')
  const sigStr    = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}`
  const signature = crypto.createHash('sha1').update(sigStr + apiSecret).digest('hex')

  const formData = new FormData()
  formData.append('file',      imageUrl)
  formData.append('public_id', publicId)
  formData.append('folder',    folder)
  formData.append('timestamp', String(timestamp))
  formData.append('api_key',   apiKey)
  formData.append('signature', signature)

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: formData }
  )

  if (!uploadRes.ok) {
    const cloudErr = await uploadRes.json().catch(() => ({}))
    console.error('[imageGen] Cloudinary upload failed:', cloudErr)
    return imageUrl
  }

  const uploadData = await uploadRes.json()
  return (uploadData as { secure_url?: string }).secure_url || imageUrl
}
