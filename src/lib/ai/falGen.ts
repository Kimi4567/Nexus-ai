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

export type FluxImageSize =
  | 'square_hd'       // 1024×1024 — Instagram feed (1:1 square)
  | 'portrait_16_9'   // 576×1024 — TikTok vertical (9:16 portrait)
  | 'landscape_4_3'   // 1024×768 — LinkedIn, Facebook, Twitter (landscape)

export interface FluxGenerateOptions {
  prompt: string
  imageSize?: FluxImageSize
  numInferenceSteps?: number  // 28-50, higher = better quality (default 28)
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
 * Map platform string to best Flux image size.
 * Platform-native sizing:
 *   TIKTOK/YOUTUBE_SHORTS/YOUTUBE → portrait_16_9  (9:16 vertical short-form)
 *   INSTAGRAM   → square_hd      (1:1 feed square)
 *   All others  → landscape_4_3  (LinkedIn/Facebook/Twitter landscape)
 */
export function platformToFluxSize(platform: string): FluxImageSize {
  const p = platform.toUpperCase()
  if (p === 'TIKTOK' || p === 'YOUTUBE' || p === 'YOUTUBE_SHORTS') return 'portrait_16_9'      // 9:16 portrait for short-form
  if (p === 'INSTAGRAM') return 'square_hd'        // 1:1 square for Instagram feed
  return 'landscape_4_3'                           // landscape for LinkedIn/META/X/Twitter
}

/**
 * Map platform string to gpt-image-1 size string.
 * Platform-native sizing:
 *   TIKTOK/YOUTUBE_SHORTS/YOUTUBE → 1024×1536 (portrait)
 *   INSTAGRAM   → 1024×1024 (square 1:1)
 *   All others  → 1536×1024 (landscape 3:2 — LinkedIn, Facebook, Twitter/X)
 */
export function platformToOpenAISize(platform: string): '1024x1024' | '1024x1536' | '1536x1024' {
  const p = platform.toUpperCase()
  if (p === 'TIKTOK' || p === 'YOUTUBE' || p === 'YOUTUBE_SHORTS') return '1024x1536'       // portrait short-form
  if (p === 'INSTAGRAM') return '1024x1024'    // square
  return '1536x1024'                            // landscape for LinkedIn/META/X/Twitter/default
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
    imageSize = 'square_hd',
    numInferenceSteps = 35,  // sweet spot: great quality without excessive latency
    safetyTolerance = '3',
    outputFormat = 'jpeg',
  } = options

  const body = {
    prompt,
    image_size: imageSize,
    num_inference_steps: numInferenceSteps,
    num_images: 1,
    safety_tolerance: safetyTolerance,
    output_format: outputFormat,
    enable_safety_checker: true,
    sync_mode: true,  // wait for result synchronously
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('[falGen] Flux Pro Ultra — prompt preview:', prompt.slice(0, 150) + '…')
    console.log('[falGen] size:', imageSize, '| steps:', numInferenceSteps)
  }

  const res = await fetch('https://fal.run/fal-ai/flux-pro/v1.1-ultra', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
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
