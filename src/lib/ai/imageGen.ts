/**
 * NEXUS Visual Intelligence — Brand-Aware Image Generation
 *
 * Strategy-driven prompt builder. Brand category is detected from Brand Brain
 * + Strategy fields. Each category has its own style map and composition map.
 *
 * Categories:
 *   saas_ai_tech | real_estate | food_beverage | health_wellness |
 *   retail_fashion | agency_consultancy | education | finance | general
 *
 * Users never write prompts — they choose style/type, the system builds the prompt
 * from brand context.
 */

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

// ─── Extended VisualContext — Brand Brain + Strategy fields ───────────────────

export interface VisualContext {
  // User-selected layout choices
  visualType: VisualType
  visualStyle: VisualStyle
  // Campaign fields
  campaignName?: string
  campaignGoal?: string
  campaignTone?: string
  audience?: string
  // Brand Brain
  brandName?: string
  brandToneWords?: string[]
  primaryOffer?: string
  industry?: string
  colorPalette?: string       // e.g. "deep blue, gold, white"
  visualStylePref?: string    // Brand Brain visualStyle field
  uniqueAdvantages?: string   // e.g. "AI-powered, real-time, no code"
  // Strategy fields (Sprint M)
  positioning?: string
  visualDirection?: string
  differentiation?: string
  keyMessage?: string
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

// ─── Style maps — one per category ───────────────────────────────────────────

type StyleMap = Record<VisualStyle, string>

const STYLE_MAPS: Record<BrandCategory, StyleMap> = {
  saas_ai_tech: {
    Minimal:    'dark background, clean floating UI cards, minimal glassmorphism, monochrome with single accent color, refined spacing',
    Luxury:     'deep black background, gold-to-violet gradient accents, premium dark UI panels, high-end SaaS aesthetic',
    Corporate:  'dark navy background, structured grid of dashboard cards, professional data visualization, clean UI layout',
    Editorial:  'bold typographic UI mockup, editorial-style product screenshot, dramatic dark lighting',
    Cinematic:  'dark cinematic background, product UI card with dramatic side lighting, film-grade color treatment',
    Bold:       'high contrast dark background, bold glowing UI elements, strong accent colors, punchy product showcase',
    'Gen Z':    'vibrant gradient dark background, energetic floating UI cards, Y2K-inspired neon accents',
    Premium:    'deep navy/black background, violet-blue glow borders on floating dashboard cards, orange accent lines, premium glassmorphism',
    Futuristic: 'deep black with neon violet and cyan glows, floating holographic UI panels, sci-fi SaaS, geometric data nodes',
    Elegant:    'dark background with soft violet ambient light, elegant floating UI cards, refined spacing, timeless premium SaaS look',
  },
  real_estate: {
    Minimal:    'clean white architectural photography, neutral palette, open space, natural light, minimalist interior design',
    Luxury:     'high-end villa or penthouse photography, marble interiors, gold fixtures, twilight exterior shot, aspirational luxury property',
    Corporate:  'professional architectural render, clean modern building exterior, structured composition, trustworthy real estate brand',
    Editorial:  'magazine-style interior photography, dramatic architectural composition, lifestyle staging',
    Cinematic:  'dramatic wide-angle architectural shot, golden-hour property photography, cinematic real estate visual',
    Bold:       'strong architectural silhouette, high contrast property exterior, bold modern design language',
    'Gen Z':    'vibrant modern apartment photography, colorful interior accents, fresh contemporary living space',
    Premium:    'premium coastal or urban luxury property, soft warm lighting, refined interior staging, aspirational lifestyle',
    Futuristic: 'ultra-modern architectural design, smart home aesthetic, futuristic building visualization',
    Elegant:    'elegant interior photography, soft neutral tones, refined furniture, timeless residential atmosphere',
  },
  food_beverage: {
    Minimal:    'minimalist food photography, single hero product on clean white surface, studio lighting, refined plating',
    Luxury:     'fine dining close-up, candlelight ambiance, premium tableware, dark luxurious restaurant atmosphere',
    Corporate:  'professional food product photography, clean branded packaging, consistent studio composition',
    Editorial:  'magazine-style food editorial, dramatic overhead shot, artistic food composition with props',
    Cinematic:  'moody cinematic food photography, dramatic side lighting, rich textures, film-like color grading',
    Bold:       'vibrant food photography, bold saturated colors, energetic composition, appetite-inducing close-up',
    'Gen Z':    'trendy food photography, bright colors, social-media-native style, street food energy',
    Premium:    'premium ingredient close-up, soft warm studio lighting, artisanal quality, elevated food presentation',
    Futuristic: 'modern food tech visual, sleek packaging design, contemporary food innovation aesthetic',
    Elegant:    'elegant food styling, soft natural diffused light, refined plating, timeless culinary photography',
  },
  health_wellness: {
    Minimal:    'clean clinical environment, minimal medical aesthetic, white and soft blue palette, precision and sterility',
    Luxury:     'premium wellness spa, soft warm lighting, luxury treatment room, aspirational health lifestyle photography',
    Corporate:  'professional healthcare setting, clean medical facility, trustworthy health brand imagery',
    Editorial:  'lifestyle wellness photography, health journey editorial, aspirational fitness aesthetic',
    Cinematic:  'dramatic wellness journey, cinematic fitness or health transformation visual',
    Bold:       'energetic fitness photography, bold health brand colors, motivational composition',
    'Gen Z':    'vibrant wellness aesthetic, colorful supplement or fitness visual, fresh health brand, relatable tone',
    Premium:    'premium wellness aesthetic, soft clean light, refined health product or environment',
    Futuristic: 'health tech aesthetic, digital health innovation, clean futuristic medical visual',
    Elegant:    'elegant spa or clinic environment, soft warm tones, refined wellness atmosphere, graceful imagery',
  },
  retail_fashion: {
    Minimal:    'minimalist product photography, single item on clean neutral background, refined fashion aesthetic',
    Luxury:     'high fashion photography, dark dramatic lighting, aspirational luxury fashion editorial',
    Corporate:  'clean retail product photography, professional brand imagery, consistent visual identity',
    Editorial:  'high fashion editorial, magazine-style composition, dramatic product or lifestyle photography',
    Cinematic:  'cinematic fashion photography, dramatic lighting, film-grade color treatment',
    Bold:       'bold fashion photography, high contrast colors, strong graphic composition, statement pieces',
    'Gen Z':    'street style photography, vibrant colors, raw authentic fashion, social-native aesthetic',
    Premium:    'premium fashion product photography, soft natural light, aspirational lifestyle, refined brand image',
    Futuristic: 'futuristic fashion editorial, neon-lit product shot, avant-garde aesthetic',
    Elegant:    'elegant fashion photography, soft diffused light, timeless style, sophisticated composition',
  },
  agency_consultancy: {
    Minimal:    'clean creative workspace, minimal design studio aesthetic, refined professional environment',
    Luxury:     'premium agency environment, high-end creative studio photography, aspirational professional setting',
    Corporate:  'professional business environment, strategy and process visualization, clean office aesthetic',
    Editorial:  'creative agency editorial, bold typography zone, design process visualization',
    Cinematic:  'dramatic creative process visual, cinematic agency aesthetic, powerful process imagery',
    Bold:       'bold creative agency visual, strong graphic elements, energetic design process composition',
    'Gen Z':    'vibrant creative studio, colorful agency environment, playful design aesthetic',
    Premium:    'premium creative agency aesthetic, refined workspace, sophisticated process visualization',
    Futuristic: 'digital agency visual, tech-forward creative environment, digital transformation aesthetic',
    Elegant:    'elegant consulting or creative environment, soft professional tones, refined studio aesthetic',
  },
  education: {
    Minimal:    'clean learning environment, minimal classroom aesthetic, bright open study space',
    Luxury:     'premium educational institution, prestigious campus photography, aspirational learning environment',
    Corporate:  'professional training environment, clean corporate learning aesthetic',
    Editorial:  'education editorial photography, inspiring learning journey visual',
    Cinematic:  'cinematic educational journey, dramatic learning transformation visual',
    Bold:       'energetic educational visual, bold colors, motivational learning imagery',
    'Gen Z':    'vibrant modern learning environment, digital education aesthetic, relatable student energy',
    Premium:    'premium education brand, refined academic environment, aspirational learning pathway',
    Futuristic: 'edtech aesthetic, digital learning platform visual, futuristic education environment',
    Elegant:    'elegant educational setting, soft academic tones, timeless learning atmosphere',
  },
  finance: {
    Minimal:    'clean financial aesthetic, minimal data visualization, precision and clarity, neutral professional tones',
    Luxury:     'premium wealth management visual, dark luxury financial aesthetic, gold accents, exclusive atmosphere',
    Corporate:  'professional financial institution imagery, clean banking aesthetic, trustworthy visual identity',
    Editorial:  'financial editorial photography, bold business imagery, magazine-style finance visual',
    Cinematic:  'dramatic financial visual, cinematic wealth or market imagery, powerful business composition',
    Bold:       'bold financial brand visual, strong data visualization, high contrast business imagery',
    'Gen Z':    'modern fintech aesthetic, vibrant financial app visual, fresh money management brand',
    Premium:    'premium wealth or investment aesthetic, refined financial brand, sophisticated visual identity',
    Futuristic: 'fintech innovation visual, digital finance aesthetic, futuristic wealth management platform',
    Elegant:    'elegant financial brand, soft professional tones, refined wealth management aesthetic',
  },
  general: {
    Minimal:    'clean white space, minimalist composition, neutral palette, refined simplicity',
    Luxury:     'deep blacks and golds, premium textures, aspirational imagery, lavish lighting',
    Corporate:  'professional tone, clean grid layout, polished and trustworthy',
    Editorial:  'magazine-style composition, bold visual overlay, editorial aesthetic',
    Cinematic:  'dramatic lighting, film grain, moody atmosphere, cinematic color grading',
    Bold:       'high contrast colors, strong graphic elements, energetic composition',
    'Gen Z':    'vibrant gradients, Y2K elements, playful layouts, raw and authentic feel',
    Premium:    'subtle gradients, refined color palette, sophisticated layout, understated luxury',
    Futuristic: 'neon accents, dark backgrounds, geometric shapes, tech-forward aesthetic',
    Elegant:    'soft neutrals, flowing compositions, graceful composition, timeless sophistication',
  },
}

// ─── Composition maps — one per category ─────────────────────────────────────

type CompositionMap = Record<VisualType, string>

const COMPOSITION_MAPS: Record<BrandCategory, CompositionMap> = {
  saas_ai_tech: {
    HERO:           'Wide 16:9 hero. Deep navy-black background. Multiple floating rounded dashboard cards in a connected pipeline. Violet-blue glow borders, subtle glassmorphism. Orange accent connection lines. Ambient violet light bloom. Premium 3D UI render.',
    SOCIAL_PREVIEW: 'Square 1:1. Single premium dark UI card — rounded corners, glassmorphism panel, glowing accent border. Abstract analytics or workflow visualization in background.',
    AD_CREATIVE:    'Ad banner. Dark split: left side shows floating dashboard UI panel with glowing cards, right side strong headline text zone. Accent bar. Gradient glow.',
    THUMBNAIL:      'Dark thumbnail. Single bold floating UI card as focal point — clear at small sizes. Glowing accent border, high contrast.',
    ALTERNATE:      'Abstract brand visual. Flowing gradient data streams on deep black background. Geometric AI intelligence nodes and connection lines. No UI elements.',
  },
  real_estate: {
    HERO:           'Wide 16:9 hero. Premium property photography or architectural render. Exterior facade or interior hero shot with dramatic golden-hour or natural lighting.',
    SOCIAL_PREVIEW: 'Square 1:1. Property highlight — exterior facade or interior lifestyle shot. Clean premium composition, warm lighting.',
    AD_CREATIVE:    'Ad banner. Property visual on left, headline zone on right. Premium brand color bar. Trust-inducing real estate composition.',
    THUMBNAIL:      'Property thumbnail. Clear architectural focal point. Premium lighting. Readable at small sizes.',
    ALTERNATE:      'Abstract luxury real estate brand visual. Architectural detail close-up, premium material texture, or aerial city view.',
  },
  food_beverage: {
    HERO:           'Wide 16:9 hero. Hero food or beverage product shot. Dramatic styling, rich textures, appetite-inducing lighting and color.',
    SOCIAL_PREVIEW: 'Square 1:1. Single hero product — overhead or 45° angle. Styled on premium surface with complementary props.',
    AD_CREATIVE:    'Ad banner. Product hero centered or on left. Bold appetite-inducing composition. Brand color elements.',
    THUMBNAIL:      'Food thumbnail. Single clear product hero. Bold focal point. Appetite-inducing. Readable at small sizes.',
    ALTERNATE:      'Brand mood visual. Ingredient flat lay, texture close-up, or atmospheric restaurant/café shot.',
  },
  health_wellness: {
    HERO:           'Wide 16:9 hero. Premium clinic, wellness facility, or health lifestyle photography. Clean, trust-inspiring, professional environment.',
    SOCIAL_PREVIEW: 'Square 1:1. Wellness or health product/service highlight. Clean, soft, trust-inducing composition.',
    AD_CREATIVE:    'Ad banner. Service or product visual. Trust-building composition. Clean medical or wellness aesthetic.',
    THUMBNAIL:      'Health/wellness thumbnail. Clear focal point. Clean and professional. Readable at small sizes.',
    ALTERNATE:      'Abstract wellness brand visual. Organic shapes, soft light, health journey metaphor.',
  },
  retail_fashion: {
    HERO:           'Wide 16:9 hero. Fashion editorial or product hero shot. Bold composition, strong lighting, aspirational brand feel.',
    SOCIAL_PREVIEW: 'Square 1:1. Product or lifestyle editorial. Social-native composition. Brand-aligned aesthetic.',
    AD_CREATIVE:    'Ad banner. Product or lifestyle hero. Bold fashion composition. Strong CTA zone on one side.',
    THUMBNAIL:      'Fashion thumbnail. Clear product or editorial focal point. Strong visual identity. Readable at small sizes.',
    ALTERNATE:      'Brand mood visual. Fashion lifestyle, texture close-up, or brand atmosphere shot.',
  },
  agency_consultancy: {
    HERO:           'Wide 16:9 hero. Creative agency or consulting visual. Process, strategy, or creative work visualization. Premium professional feel.',
    SOCIAL_PREVIEW: 'Square 1:1. Agency work highlight — creative process, strategy visual, or premium result.',
    AD_CREATIVE:    'Ad banner. Agency capability visual on one side, headline zone on other. Professional creative aesthetic.',
    THUMBNAIL:      'Agency thumbnail. Clear professional focal point. Strong brand identity. Readable at small sizes.',
    ALTERNATE:      'Abstract agency brand visual. Creative process, data flow, or strategy visualization.',
  },
  education: {
    HERO:           'Wide 16:9 hero. Inspiring learning environment or knowledge journey visual. Motivational, premium educational brand feel.',
    SOCIAL_PREVIEW: 'Square 1:1. Learning milestone or educational highlight. Inspiring, motivational composition.',
    AD_CREATIVE:    'Ad banner. Education visual. Motivational composition. Clear benefit zone.',
    THUMBNAIL:      'Education thumbnail. Clear inspiring focal point. Motivational visual. Readable at small sizes.',
    ALTERNATE:      'Abstract education brand visual. Knowledge journey, growth metaphor, or learning pathway visualization.',
  },
  finance: {
    HERO:           'Wide 16:9 hero. Premium financial brand visual. Abstract data visualization, architectural wealth metaphor, or trust-inspiring financial environment.',
    SOCIAL_PREVIEW: 'Square 1:1. Financial brand highlight. Clean, authoritative composition. Premium data or wealth visual.',
    AD_CREATIVE:    'Ad banner. Financial visual. Trust-building composition. Clean authoritative aesthetic.',
    THUMBNAIL:      'Finance thumbnail. Clear premium focal point. Authoritative. Readable at small sizes.',
    ALTERNATE:      'Abstract financial brand visual. Data visualization, wealth metaphor, or digital finance aesthetic.',
  },
  general: {
    HERO:           'Wide 16:9 hero banner, campaign header visual, brand-aligned foreground element, professional composition.',
    SOCIAL_PREVIEW: 'Square 1:1 social media format, optimized for Instagram or Facebook feed, clear focal point.',
    AD_CREATIVE:    'Ad banner composition, attention-grabbing foreground element, bold CTA zone on one side.',
    THUMBNAIL:      'Thumbnail format, bold clear focal point, readable at small sizes.',
    ALTERNATE:      'Alternative creative approach — different visual angle for the same brand.',
  },
}

// ─── Goal → mood ──────────────────────────────────────────────────────────────

const GOAL_MOOD: Record<string, string> = {
  SALES:          'conversion-focused, desire-inducing, product prominently featured',
  AWARENESS:      'brand storytelling, aspirational, emotionally resonant',
  LEADS:          'professional credibility, trust-building, solution-oriented',
  TRAFFIC:        'curiosity-inducing, click-worthy, visually disruptive',
  ENGAGEMENT:     'relatable, shareable, community-feeling',
  BRAND_BUILDING: 'brand identity-forward, iconic, memorable',
}

// ─── Universal guardrails ─────────────────────────────────────────────────────

// Prevents AI from rendering misspelled Arabic/English text inside the image
const NO_TEXT_RULE =
  'CRITICAL: No readable text, no Arabic script, no English words, no numbers, no labels, no UI copy rendered inside the image. Pure visual only.'

// People guardrail — applied to non-lifestyle categories
const NO_GENERIC_PEOPLE =
  'No generic stock-photo people, no businessmen, no office handshakes, no boardroom photos, no corporate headshots.'

// Categories where contextual human presence is appropriate
const LIFESTYLE_CATEGORIES: BrandCategory[] = ['food_beverage', 'retail_fashion', 'health_wellness', 'education']

// ─── Prompt builder ───────────────────────────────────────────────────────────

/**
 * Build a strategy-driven image prompt from campaign + brand context.
 * Routes to the correct category system based on brand detection.
 * Users never write prompts.
 */
export function buildImagePrompt(ctx: VisualContext): string {
  const category = detectBrandCategory(ctx)

  const styleDesc = STYLE_MAPS[category][ctx.visualStyle] || STYLE_MAPS[category].Premium
  const composition = COMPOSITION_MAPS[category][ctx.visualType] || COMPOSITION_MAPS[category].HERO
  const goalMood = GOAL_MOOD[ctx.campaignGoal || 'AWARENESS'] || ''
  const brandTone = (ctx.brandToneWords || []).slice(0, 3).join(', ')

  // Brand color palette injection
  const colorHint = ctx.colorPalette
    ? `Brand color palette: ${ctx.colorPalette}.`
    : ''

  // Strategy visual direction (most specific signal — use when available)
  const strategyVisual = ctx.visualDirection
    ? `Visual direction from strategy: ${ctx.visualDirection}.`
    : ''

  // Brand differentiator signal
  const differentiator = ctx.differentiation
    ? `Brand differentiation: ${ctx.differentiation}.`
    : ctx.uniqueAdvantages
    ? `Unique advantages: ${ctx.uniqueAdvantages}.`
    : ''

  // People rule — lifestyle categories can have contextual human presence
  const peopleRule = LIFESTYLE_CATEGORIES.includes(category) ? '' : NO_GENERIC_PEOPLE

  // Debug log in non-production only
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[imageGen] category=${category} style=${ctx.visualStyle} type=${ctx.visualType}`)
  }

  const parts = [
    composition,
    `Style: ${ctx.visualStyle} — ${styleDesc}`,
    goalMood ? `Mood: ${goalMood}` : '',
    strategyVisual,
    colorHint,
    ctx.brandName    ? `Brand: ${ctx.brandName}`                  : '',
    ctx.primaryOffer ? `Product/service: ${ctx.primaryOffer}`     : '',
    brandTone        ? `Brand voice: ${brandTone}`                : '',
    differentiator,
    peopleRule,
    NO_TEXT_RULE,
    'Shot on Phase One XF IQ4, 100MP medium format. Ultra-sharp, studio-grade lighting, 8K resolution, deep color depth, zero compression artifacts. Photorealistic or premium 3D render — indistinguishable from a professional commercial shoot. No watermarks, no logos, no artifacts.',
  ].filter(Boolean)

  return parts.join(' ')
}

/**
 * Generate image via gpt-image-1 (replaces deprecated dall-e-3).
 * Returns a data URI (base64 PNG) — gpt-image-1 does not return hosted URLs.
 * Caller should upload the data URI to Cloudinary for permanent storage.
 */
export async function generateWithDallE(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  if (process.env.NODE_ENV !== 'production') {
    console.log('[imageGen] prompt preview:', prompt.slice(0, 200) + (prompt.length > 200 ? '…' : ''))
  }

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1536x1024',  // gpt-image-1 supported: 1024x1024 | 1024x1536 | 1536x1024
      quality: 'high',    // low | medium | high | auto — always use high for production
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Image generation API error: ${response.status}`)
  }

  const data = await response.json()

  // gpt-image-1 returns b64_json, not a URL
  const b64 = data?.data?.[0]?.b64_json
  if (!b64) throw new Error('Image generation returned no image data')

  return `data:image/png;base64,${b64}`
}

/**
 * Upload a data URI or URL to Cloudinary for permanent storage.
 * Falls back gracefully if Cloudinary is not configured (local dev).
 */
export async function uploadToCloudinary(imageUrl: string, publicId: string): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey   = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    console.warn('[imageGen] Cloudinary not configured — image will be ephemeral')
    return imageUrl
  }

  const timestamp = Math.round(Date.now() / 1000)
  const folder = 'nexus/visuals'

  // Signature: only include params that are actually sent in formData
  const crypto = await import('crypto')
  const sigStr = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}`
  const signature = crypto
    .createHash('sha1')
    .update(sigStr + apiSecret)
    .digest('hex')

  const formData = new FormData()
  formData.append('file', imageUrl)
  formData.append('public_id', publicId)
  formData.append('folder', folder)
  formData.append('timestamp', String(timestamp))
  formData.append('api_key', apiKey)
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
  return uploadData.secure_url || imageUrl
}
