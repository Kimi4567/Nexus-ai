/**
 * NEXUS Visual Intelligence — Image Generation
 * Prompts are strategy-driven, not user-written.
 * Brand category detection routes to the right visual system:
 *   SaaS/tech/AI → UI product visuals, NO generic people
 *   Standard      → photography/render path with people allowed only if lifestyle brand
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

interface VisualContext {
  visualType: VisualType
  visualStyle: VisualStyle
  campaignName?: string
  campaignGoal?: string
  campaignTone?: string
  audience?: string
  brandName?: string
  brandToneWords?: string[]
  primaryOffer?: string
  industry?: string
}

// ─── Brand category detection ─────────────────────────────────────────────────

const SAAS_KEYWORDS = [
  'saas', 'software', 'ai', 'artificial intelligence', 'machine learning',
  'platform', 'app', 'application', 'digital', 'tech', 'technology',
  'marketing tech', 'martech', 'automation', 'crm', 'analytics', 'data',
  'cloud', 'b2b', 'dashboard', 'operating system', 'workflow', 'agent',
  'campaign', 'content', 'strategy', 'nexus', 'startup',
]

const LIFESTYLE_KEYWORDS = [
  'fashion', 'beauty', 'wellness', 'health', 'fitness', 'food', 'lifestyle',
  'travel', 'hospitality', 'photography', 'personal brand', 'coach',
]

type BrandCategory = 'saas' | 'lifestyle' | 'standard'

function detectBrandCategory(ctx: VisualContext): BrandCategory {
  const text = [ctx.industry, ctx.brandName, ctx.campaignName, ctx.primaryOffer]
    .join(' ')
    .toLowerCase()

  if (SAAS_KEYWORDS.some(kw => text.includes(kw))) return 'saas'
  if (LIFESTYLE_KEYWORDS.some(kw => text.includes(kw))) return 'lifestyle'
  return 'standard'
}

// ─── Style language ───────────────────────────────────────────────────────────

const STYLE_LANGUAGE: Record<VisualStyle, string> = {
  Minimal: 'clean white space, sans-serif typography, monochrome palette, refined simplicity, high-end minimalism',
  Luxury: 'deep blacks and golds, premium textures, aspirational imagery, lavish lighting, haute couture aesthetic',
  Corporate: 'professional blue tones, clean grid layout, polished and trustworthy',
  Editorial: 'magazine-style composition, bold typography overlay, editorial aesthetic',
  Cinematic: 'wide aspect ratio feel, dramatic lighting, film grain, moody atmosphere, cinematic color grading',
  Bold: 'high contrast colors, strong graphic elements, oversized typography, energetic composition, punchy visuals',
  'Gen Z': 'vibrant gradients, Y2K elements, playful layouts, raw and authentic feel',
  Premium: 'subtle gradients, refined color palette, sophisticated layout, premium brand feel, understated luxury',
  Futuristic: 'neon accents, dark backgrounds, geometric shapes, tech-forward aesthetic, sci-fi inspired',
  Elegant: 'soft neutrals, flowing compositions, graceful typography, refined details, timeless sophistication',
}

// SaaS-specific style overrides — replace corporate/photo language with UI/render language
const SAAS_STYLE_LANGUAGE: Record<VisualStyle, string> = {
  Minimal: 'dark background with clean floating UI cards, minimal glassmorphism, monochrome with single accent color, refined spacing',
  Luxury: 'deep black background, gold-to-violet gradient accents, premium dark UI panels, high-end SaaS aesthetic',
  Corporate: 'dark navy background, structured grid of dashboard cards, professional data visualization, clean UI layout',
  Editorial: 'bold typographic UI mockup, editorial-style product screenshot with dramatic lighting, dark composition',
  Cinematic: 'dark cinematic background, product UI card with dramatic side lighting, film-grade color treatment',
  Bold: 'high contrast dark background, bold glowing UI elements, strong accent colors, punchy product showcase',
  'Gen Z': 'vibrant gradient dark background, energetic floating UI cards, Y2K-inspired neon accents, playful SaaS aesthetic',
  Premium: 'deep navy/black background, violet-blue (#6366F1) glow borders on floating dashboard cards, orange (#F97316) accent lines, premium glassmorphism UI',
  Futuristic: 'deep black background with neon violet and cyan glows, floating holographic UI panels, sci-fi SaaS aesthetic, geometric data nodes',
  Elegant: 'dark background with soft violet ambient light, elegant floating UI cards, refined spacing, timeless premium SaaS look',
}

// ─── Type compositions ────────────────────────────────────────────────────────

// Standard (product/lifestyle brands)
const TYPE_COMPOSITION: Record<VisualType, string> = {
  HERO: 'wide hero banner composition, 16:9 landscape orientation, designed for website or campaign header',
  SOCIAL_PREVIEW: 'square social media format, 1:1 ratio, optimized for Instagram or Facebook feed',
  AD_CREATIVE: 'ad banner composition, bold CTA space at bottom, attention-grabbing foreground element',
  THUMBNAIL: 'thumbnail format, bold focal point, readable at small sizes',
  ALTERNATE: 'alternative creative approach, different visual angle for the same brand',
}

// SaaS / tech / AI brands — product UI compositions
const SAAS_TYPE_COMPOSITION: Record<VisualType, string> = {
  HERO: 'Wide 16:9 hero banner. Deep navy-black background. Multiple floating rounded dashboard cards arranged in a connected pipeline showing Brand Brain → Strategy → Content Calendar → Campaign → Execution. Each card has violet-blue (#6366F1) glow borders and subtle glassmorphism. Orange (#F97316) accent lines connecting cards. Ambient violet light bloom. Premium 3D UI render.',
  SOCIAL_PREVIEW: 'Square 1:1 social visual. Single premium dark UI card — rounded corners, glassmorphism panel, glowing violet accent border. Abstract analytics data visualization or campaign workflow in background. Clean dark SaaS aesthetic.',
  AD_CREATIVE: 'Ad creative banner. Dark background split: left side shows floating dashboard UI panel with glowing cards, right side has strong headline text zone. Orange accent bar. Violet gradient glow. Product-led visual.',
  THUMBNAIL: 'Dark thumbnail. Single bold floating UI card or dashboard element as focal point — clear at small sizes. Violet glow, high contrast. Clean SaaS product visual.',
  ALTERNATE: 'Abstract dark brand visual. Flowing violet-to-orange gradient data streams on deep black background. Geometric nodes and connection lines representing AI intelligence flow. No UI elements — pure abstract branded tech expression.',
}

// ─── Goal → mood ──────────────────────────────────────────────────────────────

const GOAL_MOOD: Record<string, string> = {
  SALES: 'conversion-focused, product prominently featured, desire-inducing',
  AWARENESS: 'brand storytelling, aspirational, emotionally resonant',
  LEADS: 'professional credibility, trust-building, solution-oriented',
  TRAFFIC: 'curiosity-inducing, click-worthy, visually disruptive',
  ENGAGEMENT: 'relatable, shareable, community-feeling',
  BRAND_BUILDING: 'brand identity-forward, iconic, memorable',
}

// ─── Universal guardrail ──────────────────────────────────────────────────────
// Applied to ALL prompts — prevents generic stock photo people unless lifestyle brand
const NO_PEOPLE_RULE =
  'STRICT: No generic people, no businessmen, no stock portraits, no office scenes, no handshakes, no corporate headshots, no boardroom photos.'

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildSaaSPrompt(ctx: VisualContext): string {
  const typeComp = SAAS_TYPE_COMPOSITION[ctx.visualType] || SAAS_TYPE_COMPOSITION.HERO
  const styleDesc = SAAS_STYLE_LANGUAGE[ctx.visualStyle] || SAAS_STYLE_LANGUAGE.Premium
  const goalMood = GOAL_MOOD[ctx.campaignGoal || 'AWARENESS'] || ''
  const brandTone = (ctx.brandToneWords || []).slice(0, 3).join(', ')

  const parts = [
    typeComp,
    `Style: ${ctx.visualStyle} — ${styleDesc}`,
    goalMood ? `Mood: ${goalMood}` : '',
    ctx.brandName ? `Brand: ${ctx.brandName}` : '',
    ctx.primaryOffer ? `Product: ${ctx.primaryOffer}` : '',
    ctx.campaignName ? `Campaign: ${ctx.campaignName}` : '',
    brandTone ? `Brand voice: ${brandTone}` : '',
    NO_PEOPLE_RULE,
    'Ultra high quality 3D render or premium UI illustration. No text overlays, no watermarks, no logos.',
    'Suitable for premium SaaS marketing campaign.',
  ].filter(Boolean)

  return parts.join('. ')
}

function buildStandardPrompt(ctx: VisualContext): string {
  const styleDesc = STYLE_LANGUAGE[ctx.visualStyle] || STYLE_LANGUAGE.Premium
  const typeComp = TYPE_COMPOSITION[ctx.visualType] || TYPE_COMPOSITION.HERO
  const goalMood = GOAL_MOOD[ctx.campaignGoal || 'AWARENESS'] || ''
  const brandTone = (ctx.brandToneWords || []).slice(0, 3).join(', ')

  const parts = [
    typeComp,
    `${ctx.visualStyle} aesthetic: ${styleDesc}`,
    goalMood ? `Visual mood: ${goalMood}` : '',
    ctx.brandName ? `Brand: ${ctx.brandName}` : '',
    brandTone ? `Brand personality: ${brandTone}` : '',
    ctx.industry ? `Industry: ${ctx.industry}` : '',
    // Still include guardrail — avoid accidental businessman images for non-lifestyle brands
    'No generic corporate stock photos, no generic businessmen unless a human-led lifestyle photo is explicitly appropriate.',
    'No text overlays, no watermarks, no logos.',
    'Ultra high quality, 8K resolution feel. Suitable for premium marketing campaign.',
  ].filter(Boolean)

  return parts.join('. ')
}

/**
 * Build a strategy-driven image prompt from campaign context.
 * Routes to SaaS or standard path based on brand category detection.
 * Users never write prompts — they choose style, the system builds the prompt.
 */
export function buildImagePrompt(ctx: VisualContext): string {
  const category = detectBrandCategory(ctx)
  return category === 'saas' ? buildSaaSPrompt(ctx) : buildStandardPrompt(ctx)
}

/**
 * Generate image via gpt-image-1 (replaces dall-e-3 which was deprecated).
 * Returns a data URI (base64 PNG) — gpt-image-1 no longer returns hosted URLs.
 * Caller should upload the data URI to Cloudinary for permanent storage.
 */
export async function generateWithDallE(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

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
      size: '1536x1024',  // wide landscape — gpt-image-1 supported: 1024x1024, 1024x1536, 1536x1024
      quality: 'medium',  // low | medium | high | auto
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

  // Return as data URI — uploadToCloudinary accepts data URIs as the file parameter
  return `data:image/png;base64,${b64}`
}

/**
 * Upload a URL-based image to Cloudinary for permanent storage.
 * DALL-E URLs expire after 1 hour — always re-upload.
 */
export async function uploadToCloudinary(imageUrl: string, publicId: string): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    // Cloudinary not configured — if it's a data URI we can't store it long-term
    // but for local dev this allows the feature to work without Cloudinary
    console.warn('[imageGen] Cloudinary not configured — image will be ephemeral')
    return imageUrl
  }

  const timestamp = Math.round(Date.now() / 1000)
  const folder = 'nexus/visuals'

  // Build signature — only include params that are actually sent in formData
  // upload_preset must NOT be in the signature for signed uploads
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
    // Fall back to data URI — client can still render it, but it won't persist permanently
    return imageUrl
  }

  const uploadData = await uploadRes.json()
  return uploadData.secure_url || imageUrl
}
