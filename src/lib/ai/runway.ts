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

async function runwayRequest(path: string, init: RequestInit): Promise<RunwayTask> {
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

  const task = await response.json() as RunwayTask
  if (!task?.id || !task.status) throw new Error('Runway returned an invalid task response')
  return task
}

export async function createRunwayVideoTask(input: {
  promptText: string
  promptImage?: string | null
  ratio: '1280:720' | '720:1280' | '960:960'
  duration?: 5
}): Promise<RunwayTask> {
  return runwayRequest('/image_to_video', {
    method: 'POST',
    body: JSON.stringify({
      model: 'gen4.5',
      promptText: input.promptText,
      ...(input.promptImage ? { promptImage: input.promptImage } : {}),
      ratio: input.ratio,
      duration: input.duration ?? 5,
    }),
  })
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
