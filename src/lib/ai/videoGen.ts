/**
 * NEXUS Video Intelligence — Brand-Aware Video Brief + Replicate Generation
 *
 * Two modes:
 * 1. Video Brief — always works; uses OpenAI to produce a brand-aware
 *    video concept, scene breakdown, script, and Replicate prompt.
 * 2. Video Generation — submits the prompt to Replicate if
 *    REPLICATE_API_TOKEN + REPLICATE_VIDEO_MODEL_VERSION are configured.
 *    Returns a prediction ID for async polling.
 *
 * Brand category detection reused from imageGen.ts.
 * No API keys are ever sent to the client.
 */

import { detectBrandCategory, BrandDetectionContext, BrandCategory } from './imageGen'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VideoScene {
  sceneNumber: number
  timeRange: string       // "0:00 – 0:03"
  visual: string          // what the viewer sees
  cameraMotion: string    // "slow push in", "aerial pull back", etc.
  voiceover?: string      // spoken line or on-screen text
  purpose: string         // what this scene achieves emotionally/strategically
}

export interface VideoBrief {
  concept: string                // 2-3 sentence core idea
  narrative: string              // full narrative arc description
  durationSeconds: number        // 5 or 10
  primaryPlatform: string        // "Instagram Reels", "TikTok", "YouTube"
  scenes: VideoScene[]           // 5–8 scenes
  script: string                 // full voiceover / text script
  visualTreatment: string        // cinematography / motion style description
  musicMood: string              // tempo + genre direction
  callToAction: string           // final CTA
  generationPrompt: string       // ready-to-send prompt for Replicate
}

export interface VideoContext extends BrandDetectionContext {
  // Campaign
  campaignName?: string
  campaignGoal?: string
  campaignTone?: string
  audience?: string
  // Brand Brain
  brandName?: string
  brandToneWords?: string[]
  primaryOffer?: string
  industry?: string
  colorPalette?: string
  uniqueAdvantages?: string
  // Strategy (Sprint M)
  positioning?: string
  visualDirection?: string
  differentiation?: string
  keyMessage?: string
  // Language preference
  language?: string
}

// ─── Replicate prediction types ───────────────────────────────────────────────

export interface ReplicatePrediction {
  id: string
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
  output?: string | string[] | null
  error?: string | null
  urls?: { get: string }
}

// ─── Brand-specific video treatment ────────────────────────────��──────────────

const VIDEO_TREATMENTS: Record<BrandCategory, {
  style: string
  motion: string
  subjects: string
  avoid: string
}> = {
  saas_ai_tech: {
    style: 'sleek product demo, dark UI-centric aesthetic, screen workflow visualization, premium SaaS motion graphics',
    motion: 'smooth push-ins on interface panels, elegant transitions between workflow states, floating UI card reveals',
    subjects: 'animated dashboard cards, data flowing through a pipeline, glowing interface elements, abstract data nodes',
    avoid: 'generic office workers, stock-photo people, handshakes, boardroom scenes',
  },
  real_estate: {
    style: 'cinematic property showcase, golden-hour architecture, aspirational lifestyle photography',
    motion: 'slow aerial pull-backs over property, smooth interior walk-throughs, dramatic exterior reveals',
    subjects: 'luxury property exteriors, premium interior spaces, architectural details, lifestyle moments',
    avoid: 'generic stock people, cheesy graphics, low-quality renders',
  },
  food_beverage: {
    style: 'appetite-inducing close-up product cinematography, warm rich tones, artisan quality',
    motion: 'macro product reveals, slow-motion pour or cut shots, ambient restaurant atmosphere',
    subjects: 'hero food product, preparation process, steam/texture details, ambient dining environment',
    avoid: 'generic stock food images, artificial-looking food',
  },
  health_wellness: {
    style: 'clean trust-inspiring medical or wellness aesthetic, bright open environments, transformation journey',
    motion: 'gentle camera movements, lifestyle transformation cuts, warm confident reveals',
    subjects: 'wellness environment, health products, lifestyle moments, transformation before/after context',
    avoid: 'generic stock doctors, fake testimonials, unrealistic claims',
  },
  retail_fashion: {
    style: 'high-fashion editorial cinematography, bold compositions, aspirational lifestyle',
    motion: 'dynamic product reveals, editorial cuts, lifestyle sequence',
    subjects: 'product hero shots, fashion editorial scenes, lifestyle context',
    avoid: 'generic stock people, cheap product placement',
  },
  agency_consultancy: {
    style: 'premium creative process visualization, results-focused, confident brand presence',
    motion: 'clean transitions between process steps, results reveal, brand confidence',
    subjects: 'creative process, strategy visualization, results/outcomes, team environment',
    avoid: 'generic office stock photos, fake meetings',
  },
  education: {
    style: 'inspiring learning journey, motivational progression, premium educational brand',
    motion: 'transformation sequence, knowledge build-up, achievement reveal',
    subjects: 'learning environment, skill progression, student journey, achievement moments',
    avoid: 'boring lecture footage, generic classroom stock',
  },
  finance: {
    style: 'premium wealth aesthetic, authoritative data visualization, aspirational financial outcomes',
    motion: 'clean data animations, growth visualization, premium environment reveals',
    subjects: 'abstract financial data, wealth environment, professional context, outcome visualization',
    avoid: 'generic money piles, fake charts, cheesy stock',
  },
  general: {
    style: 'professional brand storytelling, premium product or service showcase',
    motion: 'smooth camera movements, clean transitions, brand-aligned aesthetic',
    subjects: 'brand product or service, key value proposition, outcome visualization',
    avoid: 'generic stock footage, unbranded visuals',
  },
}

// ─── Video brief generator ───────────────────────────────────────���────────────

/**
 * Generate a brand-aware video brief using OpenAI.
 * Always works — does not require video provider.
 */
export async function generateVideoBrief(ctx: VideoContext): Promise<VideoBrief> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const category = detectBrandCategory(ctx)
  const treatment = VIDEO_TREATMENTS[category]
  const lang = ctx.language === 'ar' ? 'Arabic' : 'English'
  const brandTone = (ctx.brandToneWords || []).slice(0, 3).join(', ')
  const goal = ctx.campaignGoal || 'AWARENESS'

  const systemPrompt = `You are a senior video director and brand strategist.
Generate a detailed, brand-aware video brief for a ${category.replace('_', ' ')} brand.
Output ONLY valid JSON — no markdown, no prose outside the JSON.
Language for all text content: ${lang}.`

  const userPrompt = `Create a video brief for this campaign:

Brand: ${ctx.brandName || 'Unknown brand'}
Industry: ${ctx.industry || category.replace('_', ' ')}
Campaign: ${ctx.campaignName || 'Brand campaign'}
Goal: ${goal}
Audience: ${ctx.audience || 'Target audience'}
Tone: ${ctx.campaignTone || 'Professional'}
Brand voice: ${brandTone || 'Confident, clear'}
Primary offer: ${ctx.primaryOffer || ''}
Positioning: ${ctx.positioning || ''}
Visual direction: ${ctx.visualDirection || ''}
Key message: ${ctx.keyMessage || ''}
Differentiation: ${ctx.differentiation || ''}

Brand category: ${category}
Visual style: ${treatment.style}
Camera motion direction: ${treatment.motion}
Subjects: ${treatment.subjects}
Avoid: ${treatment.avoid}

Return this exact JSON structure:
{
  "concept": "2-3 sentence core video concept",
  "narrative": "Full narrative arc — beginning, middle, end",
  "durationSeconds": 10,
  "primaryPlatform": "Instagram Reels",
  "scenes": [
    {
      "sceneNumber": 1,
      "timeRange": "0:00 – 0:02",
      "visual": "What the viewer sees — specific and visual",
      "cameraMotion": "camera movement description",
      "voiceover": "Spoken text or on-screen text (optional)",
      "purpose": "Strategic/emotional purpose of this scene"
    }
  ],
  "script": "Full voiceover or text script for the entire video",
  "visualTreatment": "Cinematography, color grading, and motion style description",
  "musicMood": "Tempo and genre direction for background music",
  "callToAction": "Final call to action",
  "generationPrompt": "A single optimized Replicate text-to-video prompt for this video"
}

Rules:
- 5–7 scenes for 10 seconds, 3–4 scenes for 5 seconds
- generationPrompt must be under 500 characters, highly specific, cinematic quality
- No generic content — every field must be specific to this brand
- No fake testimonials, no unrealistic claims
- No text overlays visible in the video (keep it visual)
- ${treatment.avoid}`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as any)?.error?.message || `OpenAI error: ${response.status}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('Video brief generation returned empty response')

  const result = JSON.parse(content) as VideoBrief

  // Ensure required fields have fallbacks
  if (!result.scenes || !Array.isArray(result.scenes)) result.scenes = []
  if (!result.durationSeconds) result.durationSeconds = 10
  if (!result.generationPrompt) result.generationPrompt = result.concept

  return result
}

// ─── Replicate integration ────────────────────────────────────────────────────

/**
 * Check whether Replicate video generation is available.
 * Server-side only — never call from client.
 */
export function isVideoProviderAvailable(): boolean {
  return !!(
    process.env.REPLICATE_API_TOKEN &&
    process.env.REPLICATE_API_TOKEN !== 'r8_dummy' &&
    process.env.REPLICATE_VIDEO_MODEL_VERSION
  )
}

/**
 * Submit a video generation prediction to Replicate.
 * Returns the prediction object (async — poll for completion).
 */
export async function submitReplicatePrediction(
  prompt: string,
  durationSeconds: number = 5,
): Promise<ReplicatePrediction> {
  const token = process.env.REPLICATE_API_TOKEN
  const modelVersion = process.env.REPLICATE_VIDEO_MODEL_VERSION

  if (!token || !modelVersion) {
    throw new Error('REPLICATE_API_TOKEN or REPLICATE_VIDEO_MODEL_VERSION not configured')
  }

  // Clamp duration to values most models support
  const duration = durationSeconds >= 10 ? 10 : 5

  const response = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Token ${token}`,
    },
    body: JSON.stringify({
      version: modelVersion,
      input: {
        prompt,
        aspect_ratio: '16:9',
        duration,
        // Common optional params — ignored if model doesn't support them
        num_frames: duration * 24,
        fps: 24,
      },
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const msg = (err as any)?.detail || (err as any)?.error || `Replicate API error: ${response.status}`
    throw new Error(msg)
  }

  return response.json() as Promise<ReplicatePrediction>
}

/**
 * Poll a Replicate prediction by its ID.
 * Returns the latest prediction status and output.
 */
export async function pollReplicatePrediction(predictionId: string): Promise<ReplicatePrediction> {
  const token = process.env.REPLICATE_API_TOKEN
  if (!token) throw new Error('REPLICATE_API_TOKEN not configured')

  const response = await fetch(
    `https://api.replicate.com/v1/predictions/${predictionId}`,
    {
      headers: { Authorization: `Token ${token}` },
    }
  )

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as any)?.detail || `Replicate poll error: ${response.status}`)
  }

  return response.json() as Promise<ReplicatePrediction>
}

/**
 * Extract a video URL from a Replicate prediction output.
 * Output can be a string or array of strings.
 */
export function extractVideoUrl(prediction: ReplicatePrediction): string | null {
  if (!prediction.output) return null
  if (typeof prediction.output === 'string') return prediction.output
  if (Array.isArray(prediction.output) && prediction.output.length > 0) {
    return prediction.output[0]
  }
  return null
}

/**
 * Map Replicate status to our GenerationStatus enum.
 */
export function mapReplicateStatus(
  replicateStatus: ReplicatePrediction['status']
): 'PENDING' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' {
  switch (replicateStatus) {
    case 'starting':   return 'QUEUED'
    case 'processing': return 'PROCESSING'
    case 'succeeded':  return 'COMPLETED'
    case 'failed':     return 'FAILED'
    case 'canceled':   return 'CANCELLED'
    default:           return 'PENDING'
  }
}
