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

export type ShotstackRenderResult = {
  id: string
  status: 'done'
  url: string
  environment: ShotstackEnvironment
  estimatedCostUsd: number
  estimatedCredits: number
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
    && ['queued', 'fetching', 'rendering', 'saving', 'done', 'failed'].includes(value)
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
          transition: { in: 'fade', out: 'fadeFast' },
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
): Promise<{ status: ShotstackRenderStatus; url?: string }> {
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
    response?: { status?: unknown; url?: unknown }
  } | null
  if (!isShotstackStatus(payload?.response?.status)) throw new Error('SHOTSTACK_RENDER_STATUS_INVALID')
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
  } = {},
): Promise<ShotstackRenderResult> {
  const environment = options.environment ?? getShotstackEnvironment()
  const timeoutMs = Math.max(1_000, options.timeoutMs ?? DEFAULT_RENDER_TIMEOUT_MS)
  const pollIntervalMs = Math.max(0, options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS)
  const id = await queueShotstackRender(edit, environment)
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

  throw new Error('SHOTSTACK_RENDER_TIMEOUT')
}
