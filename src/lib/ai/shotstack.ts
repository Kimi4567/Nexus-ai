import type { PlatformVideoFormat } from '@/lib/platformVideoFormat'

const SHOTSTACK_API_ROOT = 'https://api.shotstack.io/edit'
export const SHOTSTACK_RENDER_COST_USD_PER_MINUTE = 0.3
export const SHOTSTACK_RENDER_CREDITS_PER_MINUTE = 1
const DEFAULT_RENDER_TIMEOUT_MS = 140_000
const DEFAULT_POLL_INTERVAL_MS = 1_500

export type ShotstackEnvironment = 'stage' | 'v1'
export type ShotstackRenderStatus =
  | 'queued'
  | 'fetching'
  | 'processing'
  | 'rendering'
  | 'saving'
  | 'done'
  | 'failed'

export type ShotstackCampaignFilmEdit = {
  timeline: {
    background: string
    tracks: Array<{ clips: Array<Record<string, unknown>> }>
  }
  output: {
    format: 'mp4'
    size: { width: number; height: number }
    fps: 30
    quality: 'high'
    range: { start: 0; length: number }
  }
}

export type ShotstackPropertyPhotoFilmEdit = ShotstackCampaignFilmEdit

export type ShotstackRenderResult = {
  id: string
  status: 'done'
  url: string
  environment: ShotstackEnvironment
  estimatedCostUsd: number
  estimatedCredits: number
}

export class ShotstackRenderPendingError extends Error {
  readonly renderId: string

  constructor(renderId: string) {
    super('SHOTSTACK_RENDER_PENDING')
    this.name = 'ShotstackRenderPendingError'
    this.renderId = renderId
  }
}

function normalized(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function getShotstackEnvironment(): ShotstackEnvironment {
  return normalized(process.env.SHOTSTACK_ENV).toLowerCase() === 'v1' ? 'v1' : 'stage'
}

function getShotstackApiKey(environment: ShotstackEnvironment): string | null {
  const value = environment === 'v1'
    ? process.env.SHOTSTACK_API_KEY
    : process.env.SHOTSTACK_STAGE_API_KEY
  const key = normalized(value)
  return key || null
}

export function isShotstackConfigured(environment: ShotstackEnvironment = getShotstackEnvironment()): boolean {
  return getShotstackApiKey(environment) !== null
}

/**
 * Watermarked stage renders are previews only and must never replace a final
 * review asset. The production compositor therefore requires an explicit v1
 * environment plus its production key.
 */
export function isShotstackProductionConfigured(): boolean {
  return getShotstackEnvironment() === 'v1' && isShotstackConfigured('v1')
}

export function estimateShotstackRenderCostUsd(
  durationSeconds: number,
  environment: ShotstackEnvironment,
): number {
  if (environment === 'stage') return 0
  const safeDuration = Number.isFinite(durationSeconds) ? Math.max(0, durationSeconds) : 0
  return Number(((safeDuration / 60) * SHOTSTACK_RENDER_COST_USD_PER_MINUTE).toFixed(6))
}

export function estimateShotstackRenderCredits(
  durationSeconds: number,
  environment: ShotstackEnvironment,
): number {
  if (environment === 'stage') return 0
  const safeDuration = Number.isFinite(durationSeconds) ? Math.max(0, durationSeconds) : 0
  return Number(((safeDuration / 60) * SHOTSTACK_RENDER_CREDITS_PER_MINUTE).toFixed(6))
}

function safeHttpsUrl(value: unknown, errorCode: string): string {
  if (typeof value !== 'string') throw new Error(errorCode)
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:') throw new Error(errorCode)
    return parsed.toString()
  } catch {
    throw new Error(errorCode)
  }
}

function shotstackHeaders(environment: ShotstackEnvironment): Record<string, string> {
  const apiKey = getShotstackApiKey(environment)
  if (!apiKey) throw new Error('SHOTSTACK_COMPOSITOR_UNAVAILABLE')
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
  }
}

function isShotstackStatus(value: unknown): value is ShotstackRenderStatus {
  return typeof value === 'string'
    && ['queued', 'fetching', 'processing', 'rendering', 'saving', 'done', 'failed'].includes(value)
}

export function buildShotstackCampaignFilmEdit(input: {
  sourceUrl: string
  target: PlatformVideoFormat
  durationSeconds: number
  overlays: { hook: string; benefit: string; end: string }
  voiceoverUrl?: string | null
}): ShotstackCampaignFilmEdit {
  const sourceUrl = safeHttpsUrl(input.sourceUrl, 'SHOTSTACK_SOURCE_URL_INVALID')
  const voiceoverUrl = input.voiceoverUrl
    ? safeHttpsUrl(input.voiceoverUrl, 'SHOTSTACK_VOICEOVER_URL_INVALID')
    : null
  const duration = Math.max(1, Math.min(60, input.durationSeconds))
  const width = Math.max(2, Math.min(1_920, Math.round(input.target.width / 2) * 2))
  const height = Math.max(2, Math.min(1_920, Math.round(input.target.height / 2) * 2))

  const tracks: ShotstackCampaignFilmEdit['timeline']['tracks'] = [
    {
      clips: [
        {
          asset: { type: 'svg', src: input.overlays.hook },
          start: 0,
          length: Math.min(2.8, duration),
          width,
          height,
          fit: 'cover',
          transition: { in: 'slideRightFast', out: 'fadeFast' },
        },
        {
          asset: { type: 'svg', src: input.overlays.benefit },
          start: Math.min(3, duration),
          length: Math.max(0.1, Math.min(3.6, duration - Math.min(3, duration))),
          width,
          height,
          fit: 'cover',
          transition: { in: 'slideUpFast', out: 'fadeFast' },
        },
        {
          asset: { type: 'svg', src: input.overlays.end },
          start: Math.min(7.5, duration),
          length: Math.max(0.1, duration - Math.min(7.5, duration)),
          width,
          height,
          fit: 'cover',
          transition: { in: 'fade' },
        },
      ],
    },
  ]

  if (voiceoverUrl) {
    tracks.push({
      clips: [{
        asset: {
          type: 'audio',
          src: voiceoverUrl,
          trim: 0,
          volume: 1,
          speed: 1,
        },
        start: 0,
        length: duration,
      }],
    })
  }

  tracks.push({
    clips: [{
      asset: {
        type: 'video',
        src: sourceUrl,
        transcode: true,
        trim: 0,
        volume: voiceoverUrl ? 0.16 : 1,
        volumeEffect: voiceoverUrl ? 'fadeOut' : 'none',
        speed: 1,
      },
      start: 0,
      length: duration,
      width,
      height,
      fit: 'cover',
    }],
  })

  return {
    timeline: {
      background: '#06101A',
      tracks,
    },
    output: {
      format: 'mp4',
      size: { width, height },
      fps: 30,
      quality: 'high',
      range: { start: 0, length: duration },
    },
  }
}

/**
 * Builds a source-locked property film. Every visual clip points to one of the
 * selected durable photos; Shotstack may crop, transition, and animate the
 * camera framing, but no generative provider creates or changes property pixels.
 */
export function buildShotstackPropertyPhotoFilmEdit(input: {
  sourceImageUrls: string[]
  target: PlatformVideoFormat
  durationSeconds: number
  overlays: { intro: string; detail: string; end: string }
  voiceoverUrl?: string | null
}): ShotstackPropertyPhotoFilmEdit {
  const sourceImageUrls = input.sourceImageUrls.map(url => (
    safeHttpsUrl(url, 'SHOTSTACK_PROPERTY_SOURCE_URL_INVALID')
  ))
  if (sourceImageUrls.length < 3 || sourceImageUrls.length > 6) {
    throw new Error('SHOTSTACK_PROPERTY_SOURCE_COUNT_INVALID')
  }
  const voiceoverUrl = input.voiceoverUrl
    ? safeHttpsUrl(input.voiceoverUrl, 'SHOTSTACK_VOICEOVER_URL_INVALID')
    : null
  const duration = Math.max(3, Math.min(60, input.durationSeconds))
  const width = Math.max(2, Math.min(1_920, Math.round(input.target.width / 2) * 2))
  const height = Math.max(2, Math.min(1_920, Math.round(input.target.height / 2) * 2))
  const clipLength = duration / sourceImageUrls.length

  const tracks: ShotstackPropertyPhotoFilmEdit['timeline']['tracks'] = [
    {
      clips: [
        {
          asset: { type: 'svg', src: input.overlays.intro },
          start: 0,
          length: Math.min(3.2, duration),
          width,
          height,
          fit: 'cover',
          transition: { in: 'fade', out: 'fadeFast' },
        },
        {
          asset: { type: 'svg', src: input.overlays.detail },
          start: Math.min(3.2, duration),
          length: Math.max(0.1, Math.min(3.6, duration - Math.min(3.2, duration))),
          width,
          height,
          fit: 'cover',
          transition: { in: 'slideUpFast', out: 'fadeFast' },
        },
        {
          asset: { type: 'svg', src: input.overlays.end },
          start: Math.min(7, duration),
          length: Math.max(0.1, duration - Math.min(7, duration)),
          width,
          height,
          fit: 'cover',
          transition: { in: 'fade' },
        },
      ],
    },
  ]

  if (voiceoverUrl) {
    tracks.push({
      clips: [{
        asset: {
          type: 'audio',
          src: voiceoverUrl,
          trim: 0,
          volume: 1,
          speed: 1,
        },
        start: 0,
        length: duration,
      }],
    })
  }

  tracks.push({
    clips: sourceImageUrls.map((src, index) => ({
      asset: { type: 'image', src },
      start: Number((index * clipLength).toFixed(3)),
      length: Number(clipLength.toFixed(3)),
      width,
      height,
      fit: 'cover',
      effect: index % 2 === 0 ? 'zoomIn' : 'zoomOut',
      transition: {
        in: index === 0 ? 'none' : 'fade',
        out: index === sourceImageUrls.length - 1 ? 'none' : 'fade',
      },
    })),
  })

  return {
    timeline: {
      background: '#07100F',
      tracks,
    },
    output: {
      format: 'mp4',
      size: { width, height },
      fps: 30,
      quality: 'high',
      range: { start: 0, length: duration },
    },
  }
}

async function queueShotstackRender(
  edit: ShotstackCampaignFilmEdit,
  environment: ShotstackEnvironment,
): Promise<string> {
  const response = await fetch(`${SHOTSTACK_API_ROOT}/${environment}/render`, {
    method: 'POST',
    headers: shotstackHeaders(environment),
    body: JSON.stringify(edit),
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`SHOTSTACK_RENDER_QUEUE_FAILED_${response.status}`)

  const payload = await response.json().catch(() => null) as {
    response?: { id?: unknown }
  } | null
  const id = normalized(payload?.response?.id)
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('SHOTSTACK_RENDER_ID_INVALID')
  return id
}

async function getShotstackRender(
  id: string,
  environment: ShotstackEnvironment,
): Promise<{ status: ShotstackRenderStatus | 'pending'; url?: string }> {
  const response = await fetch(
    `${SHOTSTACK_API_ROOT}/${environment}/render/${encodeURIComponent(id)}?data=false`,
    {
      method: 'GET',
      headers: shotstackHeaders(environment),
      signal: AbortSignal.timeout(20_000),
    },
  )
  if (!response.ok) throw new Error(`SHOTSTACK_RENDER_STATUS_FAILED_${response.status}`)
  const payload = await response.json().catch(() => null) as {
    success?: unknown
    response?: { status?: unknown; url?: unknown }
  } | null
  if (!payload || payload.success !== true || !payload.response || typeof payload.response !== 'object') {
    throw new Error('SHOTSTACK_RENDER_STATUS_INVALID')
  }
  if (!isShotstackStatus(payload.response.status)) {
    // Shotstack can briefly return an undocumented transitional status while
    // preprocessing input assets. Treat it only as "still pending": completion
    // still requires an explicit `done` plus a valid HTTPS output URL, and the
    // existing timeout remains the fail-closed boundary.
    return { status: 'pending' }
  }
  return {
    status: payload.response.status,
    url: typeof payload.response.url === 'string' ? payload.response.url : undefined,
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

export async function renderShotstackEdit(
  edit: ShotstackCampaignFilmEdit,
  options: {
    environment?: ShotstackEnvironment
    timeoutMs?: number
    pollIntervalMs?: number
    renderId?: string
    onQueued?: (renderId: string) => void | Promise<void>
  } = {},
): Promise<ShotstackRenderResult> {
  const environment = options.environment ?? getShotstackEnvironment()
  const timeoutMs = Math.max(1_000, options.timeoutMs ?? DEFAULT_RENDER_TIMEOUT_MS)
  const pollIntervalMs = Math.max(0, options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS)
  const resumeId = normalized(options.renderId)
  if (resumeId && !/^[0-9a-f-]{36}$/i.test(resumeId)) throw new Error('SHOTSTACK_RENDER_ID_INVALID')
  const id = resumeId || await queueShotstackRender(edit, environment)
  if (!resumeId) await options.onQueued?.(id)
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const render = await getShotstackRender(id, environment)
    if (render.status === 'failed') throw new Error('SHOTSTACK_RENDER_FAILED')
    if (render.status === 'done') {
      return {
        id,
        status: 'done',
        url: safeHttpsUrl(render.url, 'SHOTSTACK_RENDER_URL_INVALID'),
        environment,
        estimatedCostUsd: estimateShotstackRenderCostUsd(edit.output.range.length, environment),
        estimatedCredits: estimateShotstackRenderCredits(edit.output.range.length, environment),
      }
    }
    await wait(pollIntervalMs)
  }

  throw new ShotstackRenderPendingError(id)
}
