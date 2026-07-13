/**
 * Flux 1.1 Pro Ultra — Premium Image Generation via fal.ai REST API
 *
 * Model: fal-ai/flux-pro/v1.1-ultra
 * Quality: Best-in-class photorealism, 4MP resolution, superior prompt adherence
 * Cost: ~$0.06/image (vs $0.04 for gpt-image-1 high)
 *
 * Requires: FAL_KEY in environment variables
 * Get key at: https://fal.ai
 *
 * Usage: set provider='flux' in visuals/generate request for premium output
 */

export type FluxAspectRatio =
  | '1:1'  // Instagram / Meta feed
  | '9:16' // TikTok / YouTube Shorts
  | '3:2'  // LinkedIn / X landscape

export interface FluxGenerateOptions {
  prompt: string
  aspectRatio?: FluxAspectRatio
  safetyTolerance?: '1' | '2' | '3' | '4' | '5' | '6'  // 1=strict, 6=permissive
  outputFormat?: 'jpeg' | 'png'
}

export interface FluxGenerateResult {
  imageUrl: string
  width: number
  height: number
  seed: number
}

/**
 * Map platform string to the FLUX 1.1 Ultra `aspect_ratio` contract.
 * Platform-native sizing:
 *   TIKTOK/YOUTUBE_SHORTS/YOUTUBE → 9:16 vertical short-form
 *   META/INSTAGRAM → 1:1 feed square
 *   All others     → 3:2 landscape
 */
export function platformToFluxAspectRatio(platform: string): FluxAspectRatio {
  const p = platform.toUpperCase()
  if (p === 'TIKTOK' || p === 'YOUTUBE' || p === 'YOUTUBE_SHORTS') return '9:16'
  if (p === 'META' || p === 'INSTAGRAM') return '1:1'
  return '3:2'
}

/**
 * Map platform string to gpt-image-1 size string.
 * Platform-native sizing:
 *   TIKTOK/YOUTUBE_SHORTS/YOUTUBE → 1024×1536 (portrait)
 *   META/INSTAGRAM → 1024×1024 (square 1:1)
 *   All others  → 1536×1024 (landscape 3:2 — LinkedIn, Facebook, Twitter/X)
 */
export function platformToOpenAISize(platform: string): '1024x1024' | '1024x1536' | '1536x1024' {
  const p = platform.toUpperCase()
  if (p === 'TIKTOK' || p === 'YOUTUBE' || p === 'YOUTUBE_SHORTS') return '1024x1536'       // portrait short-form
  if (p === 'META' || p === 'INSTAGRAM') return '1024x1024' // square Content Hub feed
  return '1536x1024'                            // landscape for LinkedIn/Facebook/X/Twitter/default
}

/**
 * Generate image using Flux 1.1 Pro Ultra via fal.ai REST API
 * Returns a hosted CDN URL (no base64, no Cloudinary needed for temp storage)
 */
export async function generateWithFlux(options: FluxGenerateOptions): Promise<FluxGenerateResult> {
  const falKey = process.env.FAL_KEY
  if (!falKey) throw new Error('FAL_KEY not configured — add it to your environment variables')

  const {
    prompt,
    aspectRatio = '1:1',
    safetyTolerance = '3',
    outputFormat = 'jpeg',
  } = options

  const body = {
    prompt,
    aspect_ratio: aspectRatio,
    num_images: 1,
    safety_tolerance: safetyTolerance,
    output_format: outputFormat,
    enable_safety_checker: true,
    sync_mode: true,  // wait for result synchronously
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('[falGen] Flux Pro Ultra — prompt preview:', prompt.slice(0, 150) + '…')
    console.log('[falGen] aspect ratio:', aspectRatio)
  }

  const res = await fetch('https://fal.run/fal-ai/flux-pro/v1.1-ultra', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(35_000),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      (err as any)?.detail || (err as any)?.message || `Flux API error: ${res.status}`
    )
  }

  const data = await res.json() as {
    images?: Array<{ url: string; width: number; height: number }>
    seed?: number
  }

  const image = data?.images?.[0]
  if (!image?.url) throw new Error('Flux returned no image data')

  return {
    imageUrl: image.url,
    width: image.width,
    height: image.height,
    seed: data.seed ?? 0,
  }
}
