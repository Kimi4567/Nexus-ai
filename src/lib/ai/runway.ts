import { v2 as cloudinary } from 'cloudinary'

const RUNWAY_API_ROOT = 'https://api.dev.runwayml.com/v1'
const RUNWAY_API_VERSION = '2024-11-06'

export type RunwayTaskStatus =
  | 'PENDING'
  | 'THROTTLED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELED'
  | 'CANCELLED'

export interface RunwayTask {
  id: string
  status: RunwayTaskStatus
  output?: string[]
  failure?: string
  failureCode?: string
  progress?: number
  createdAt?: string
}

function runwayKey(): string {
  const key = process.env.RUNWAYML_API_SECRET || process.env.RUNWAY_API_KEY
  if (!key?.trim()) throw new Error('RUNWAY_PROVIDER_UNAVAILABLE')
  return key.trim()
}

function isRunwayTaskStatus(value: unknown): value is RunwayTaskStatus {
  return typeof value === 'string' && [
    'PENDING',
    'THROTTLED',
    'RUNNING',
    'SUCCEEDED',
    'FAILED',
    'CANCELED',
    'CANCELLED',
  ].includes(value)
}

async function runwayRequest(
  path: string,
  init: RequestInit,
  options: { defaultStatus?: RunwayTaskStatus } = {},
): Promise<RunwayTask> {
  const response = await fetch(`${RUNWAY_API_ROOT}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${runwayKey()}`,
      'X-Runway-Version': RUNWAY_API_VERSION,
      'Content-Type': 'application/json',
      ...init.headers,
    },
    signal: AbortSignal.timeout(25_000),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as {
      error?: unknown
      message?: unknown
      details?: unknown
      issues?: unknown
    }
    const primary = typeof payload.message === 'string'
      ? payload.message
      : typeof payload.error === 'string'
        ? payload.error
        : `Video provider request failed: ${response.status}`
    const validation = payload.details ?? payload.issues
    let validationText = ''
    if (typeof validation === 'string') {
      validationText = validation
    } else if (validation) {
      try {
        validationText = JSON.stringify(validation)
      } catch {
        validationText = 'Provider returned non-serializable validation details.'
      }
    }
    throw new Error([primary, validationText].filter(Boolean).join(' — ').slice(0, 1_200))
  }

  const payload = await response.json() as Record<string, unknown>
  if (!payload || typeof payload.id !== 'string' || !payload.id.trim()) {
    throw new Error('Runway returned an invalid task response')
  }

  const status = isRunwayTaskStatus(payload.status)
    ? payload.status
    : options.defaultStatus
  if (!status) throw new Error('Runway returned an invalid task response')

  return {
    ...payload,
    id: payload.id,
    status,
  } as RunwayTask
}

/**
 * Creates one pinned, multi-reference product-ad recipe task. This is the only
 * generative route sold as a cinematic product ad; callers must complete the
 * deterministic asset preflight before invoking it.
 */
export async function createRunwayProductAdTask(input: {
  productImages: string[]
  productInfo: string
  userConcept: string
  ratio: '1280:720' | '720:1280' | '960:960'
  duration: 8
}): Promise<RunwayTask> {
  if (input.productImages.length < 2 || input.productImages.length > 4) {
    throw new Error('PRODUCT_AD_REFERENCE_COUNT_INVALID')
  }
  if (input.productImages.some(uri => !uri.startsWith('https://'))) {
    throw new Error('PRODUCT_AD_REFERENCE_URL_INVALID')
  }

  return runwayRequest('/recipes/product_ad', {
    method: 'POST',
    body: JSON.stringify({
      version: '2026-06',
      productImages: input.productImages.map(uri => ({ uri })),
      productInfo: input.productInfo.slice(0, 2_500),
      userConcept: input.userConcept.slice(0, 3_500),
      ratio: input.ratio,
      duration: input.duration,
      audio: false,
    }),
  }, { defaultStatus: 'PENDING' })
}

export type RunwayMultiShot = {
  prompt: string
  duration: number
}

/**
 * Creates one pinned professional campaign film with an explicit editorial
 * shot list. Unlike source-locked motion design, this route produces real
 * subject/camera motion, scene cuts, and provider-generated sound design.
 */
export async function createRunwayMultiShotVideoTask(input: {
  shots: RunwayMultiShot[]
  ratio: '1280:720' | '720:1280' | '960:960' | '1920:1080' | '1080:1920' | '1440:1440'
  duration: 5 | 10 | 15
  audio?: boolean
}): Promise<RunwayTask> {
  if (input.shots.length < 3 || input.shots.length > 5) {
    throw new Error('MULTI_SHOT_COUNT_INVALID')
  }
  if (input.shots.some(shot => shot.prompt.trim().length < 3 || shot.prompt.length > 512)) {
    throw new Error('MULTI_SHOT_PROMPT_INVALID')
  }
  if (input.shots.reduce((total, shot) => total + shot.duration, 0) !== input.duration) {
    throw new Error('MULTI_SHOT_DURATION_INVALID')
  }

  return runwayRequest('/recipes/multi_shot_video', {
    method: 'POST',
    body: JSON.stringify({
      version: '2026-06',
      mode: 'custom',
      duration: input.duration,
      ratio: input.ratio,
      audio: input.audio !== false,
      shots: input.shots.map(shot => ({
        prompt: shot.prompt.trim(),
        duration: shot.duration,
      })),
    }),
  }, { defaultStatus: 'PENDING' })
}

export async function retrieveRunwayTask(taskId: string): Promise<RunwayTask> {
  if (!/^[A-Za-z0-9_-]{6,200}$/.test(taskId)) throw new Error('Invalid Runway task id')
  return runwayRequest(`/tasks/${encodeURIComponent(taskId)}`, { method: 'GET' })
}

export async function cancelRunwayTask(taskId: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]{6,200}$/.test(taskId)) return
  await fetch(`${RUNWAY_API_ROOT}/tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${runwayKey()}`,
      'X-Runway-Version': RUNWAY_API_VERSION,
    },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined)
}

export interface StoredVideoResult {
  url: string
  publicId: string
  bytes: number
  width: number | null
  height: number | null
  duration: number | null
  format: string
}

/** Persist the provider-temporary output before attaching it to a post. */
export async function uploadRunwayVideoToCloudinary(
  providerUrl: string,
  generationId: string,
): Promise<StoredVideoResult> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) throw new Error('Cloudinary video storage is not configured')
  if (!providerUrl.startsWith('https://')) throw new Error('Runway returned an unsafe video URL')

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret })
  const result = await cloudinary.uploader.upload(providerUrl, {
    resource_type: 'video',
    folder: 'nexus/videos',
    public_id: `video_${generationId}`,
    overwrite: true,
  })

  if (!result.secure_url?.startsWith('https://')) {
    throw new Error('Cloudinary returned no durable HTTPS video URL')
  }

  return {
    url: result.secure_url,
    publicId: result.public_id,
    bytes: Number(result.bytes || 0),
    width: Number.isFinite(result.width) ? result.width : null,
    height: Number.isFinite(result.height) ? result.height : null,
    duration: Number.isFinite(result.duration) ? Math.round(result.duration) : null,
    format: result.format || 'mp4',
  }
}
