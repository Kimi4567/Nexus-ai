import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildShotstackCampaignFilmEdit,
  estimateShotstackRenderCredits,
  estimateShotstackRenderCostUsd,
  getShotstackEnvironment,
  isShotstackProductionConfigured,
  renderShotstackEdit,
} from '../shotstack'

const TARGET = {
  platform: 'TIKTOK',
  width: 1080,
  height: 1920,
  aspectRatio: '9:16',
  ratio: '720:1280',
  format: 'Vertical short-form video',
  durationSeconds: 10,
} as const

function edit(withVoiceover = true) {
  return buildShotstackCampaignFilmEdit({
    sourceUrl: 'https://res.cloudinary.com/demo/video/upload/source.mp4',
    target: TARGET,
    durationSeconds: 10,
    overlays: {
      hook: '<svg><path d="M0 0"/></svg>',
      benefit: '<svg><path d="M0 0"/></svg>',
      end: '<svg><path d="M0 0"/></svg>',
    },
    voiceoverUrl: withVoiceover
      ? 'https://res.cloudinary.com/demo/video/upload/voice.mp3'
      : null,
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('Shotstack campaign-film compositor', () => {
  it('defaults to watermarked stage and never treats it as production', () => {
    vi.stubEnv('SHOTSTACK_STAGE_API_KEY', 'stage-secret')
    expect(getShotstackEnvironment()).toBe('stage')
    expect(isShotstackProductionConfigured()).toBe(false)

    vi.stubEnv('SHOTSTACK_ENV', 'v1')
    expect(isShotstackProductionConfigured()).toBe(false)
    vi.stubEnv('SHOTSTACK_API_KEY', 'production-secret')
    expect(isShotstackProductionConfigured()).toBe(true)
  })

  it('builds separate SVG, voice, and source-video layers', () => {
    const result = edit(true)
    expect(result.timeline.tracks).toHaveLength(3)
    expect(result.timeline.tracks[0].clips).toHaveLength(3)
    expect(result.timeline.tracks[0].clips[0]).toMatchObject({
      asset: { type: 'svg' },
      start: 0,
      transition: { in: 'slideRightFast', out: 'fadeFast' },
    })
    expect(result.timeline.tracks[0].clips[2]).toMatchObject({
      asset: { type: 'svg' },
      transition: { in: 'fade', out: 'fadeFast' },
    })
    expect(result.timeline.tracks[1].clips[0]).toMatchObject({
      asset: { type: 'audio', volume: 1 },
      start: 0,
      length: 10,
    })
    expect(result.timeline.tracks[1].clips[0].asset).not.toHaveProperty('effect')
    expect(result.timeline.tracks[2].clips[0]).toMatchObject({
      asset: { type: 'video', volume: 0.16 },
      fit: 'cover',
    })
    expect(result.output).toMatchObject({
      format: 'mp4',
      size: { width: 1080, height: 1920 },
      fps: 30,
      quality: 'high',
      range: { start: 0, length: 10 },
    })
  })

  it('preserves source audio when no approved voice is configured', () => {
    const result = edit(false)
    expect(result.timeline.tracks).toHaveLength(2)
    expect(result.timeline.tracks[1].clips[0]).toMatchObject({
      asset: { type: 'video', volume: 1, volumeEffect: 'none' },
    })
  })

  it('queues and resolves a sandbox render without assigning a production cost', async () => {
    vi.stubEnv('SHOTSTACK_STAGE_API_KEY', 'stage-secret')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        response: { id: '2abd5c11-0f3d-4c6d-ba20-235fc9b8e8b7' },
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        response: { status: 'queued' },
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        response: { status: 'processing' },
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        response: { status: 'preprocessing-assets' },
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        response: {
          status: 'done',
          url: 'https://shotstack-output.example/render.mp4',
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await renderShotstackEdit(edit(), {
      environment: 'stage',
      pollIntervalMs: 0,
      timeoutMs: 2_000,
    })

    expect(result).toMatchObject({
      status: 'done',
      environment: 'stage',
      estimatedCostUsd: 0,
      estimatedCredits: 0,
    })
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })

  it('meters a ten-second production render at the configured per-minute rate', () => {
    expect(estimateShotstackRenderCostUsd(10, 'v1')).toBe(0.05)
    expect(estimateShotstackRenderCostUsd(10, 'stage')).toBe(0)
    expect(estimateShotstackRenderCredits(10, 'v1')).toBe(0.166667)
    expect(estimateShotstackRenderCredits(10, 'stage')).toBe(0)
  })
})
