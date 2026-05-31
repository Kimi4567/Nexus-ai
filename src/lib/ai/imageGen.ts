/**
 * NEXUS Visual Intelligence — DALL-E 3 Image Generation
 * Prompts are strategy-driven, not user-written.
 * Creative direction comes from campaign + brand context.
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

// Style → visual language mapping
const STYLE_LANGUAGE: Record<VisualStyle, string> = {
  Minimal: 'clean white space, sans-serif typography, monochrome palette, refined simplicity, high-end minimalism',
  Luxury: 'deep blacks and golds, premium textures, aspirational imagery, lavish lighting, haute couture aesthetic',
  Corporate: 'professional blue tones, clean grid layout, business-appropriate imagery, polished and trustworthy',
  Editorial: 'magazine-style composition, bold typography overlay, artistic photography, editorial fashion aesthetic',
  Cinematic: 'wide aspect ratio feel, dramatic lighting, film grain, moody atmosphere, cinematic color grading',
  Bold: 'high contrast colors, strong graphic elements, oversized typography, energetic composition, punchy visuals',
  'Gen Z': 'vibrant gradients, Y2K elements, playful layouts, meme-culture aesthetic, raw and authentic feel',
  Premium: 'subtle gradients, refined color palette, sophisticated layout, premium brand feel, understated luxury',
  Futuristic: 'neon accents, dark backgrounds, geometric shapes, tech-forward aesthetic, sci-fi inspired',
  Elegant: 'soft neutrals, flowing compositions, graceful typography, refined details, timeless sophistication',
}

// Visual type → composition guidance
const TYPE_COMPOSITION: Record<VisualType, string> = {
  HERO: 'wide hero banner composition, 16:9 landscape orientation, designed for website or campaign header',
  SOCIAL_PREVIEW: 'square social media format, 1:1 ratio, optimized for Instagram or Facebook feed',
  AD_CREATIVE: 'ad banner composition, bold CTA space at bottom, attention-grabbing foreground element',
  THUMBNAIL: 'thumbnail format, bold focal point, readable at small sizes, YouTube or video thumbnail style',
  ALTERNATE: 'alternative creative approach, same brand but different visual angle',
}

// Goal → visual mood mapping
const GOAL_MOOD: Record<string, string> = {
  SALES: 'conversion-focused, product prominently featured, desire-inducing',
  AWARENESS: 'brand storytelling, aspirational, emotionally resonant',
  LEADS: 'professional credibility, trust-building, solution-oriented',
  TRAFFIC: 'curiosity-inducing, click-worthy, visually disruptive',
  ENGAGEMENT: 'relatable, shareable, community-feeling',
  BRAND_BUILDING: 'brand identity-forward, iconic, memorable',
}

/**
 * Build a strategy-driven image prompt from campaign context.
 * Users never write prompts — they choose a style, the system does the rest.
 */
export function buildImagePrompt(ctx: VisualContext): string {
  const styleLanguage = STYLE_LANGUAGE[ctx.visualStyle] || STYLE_LANGUAGE.Premium
  const typeComposition = TYPE_COMPOSITION[ctx.visualType] || TYPE_COMPOSITION.HERO
  const goalMood = GOAL_MOOD[ctx.campaignGoal || 'AWARENESS'] || ''
  const brandTone = (ctx.brandToneWords || []).slice(0, 3).join(', ')

  const parts = [
    // Core visual type and composition
    typeComposition,

    // Style direction
    `${ctx.visualStyle} aesthetic: ${styleLanguage}`,

    // Brand/campaign mood
    goalMood ? `Visual mood: ${goalMood}` : '',

    // Brand context
    ctx.brandName ? `Brand: ${ctx.brandName}` : '',
    brandTone ? `Brand personality: ${brandTone}` : '',
    ctx.industry ? `Industry context: ${ctx.industry}` : '',

    // Quality markers
    'photorealistic marketing visual, professional photography or 3D render',
    'no text overlays, no watermarks, no logos',
    'ultra high quality, 8K resolution feel',
    'suitable for premium marketing campaign',
  ].filter(Boolean)

  return parts.join('. ')
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

  // Build signature
  const crypto = await import('crypto')
  const sigStr = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}&upload_preset=ml_default`
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
