import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildShotstackCampaignFilmEdit,
  buildShotstackPropertyPhotoFilmEdit,
  estimateShotstackRenderCredits,
  estimateShotstackRenderCostUsd,
  getShotstackEnvironment,
  isShotstackProductionConfigured,
  renderShotstackEdit,
  ShotstackRenderPendingError,
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
  vi.restoreAllMocks()
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
      transition: { in: 'fade' },
    })
    expect(result.timeline.tracks[0].clips[2].transition).not.toHaveProperty('out')
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

  it('builds a source-locked multi-photo property edit with moving image clips', () => {
    const result = buildShotstackPropertyPhotoFilmEdit({
      sourceImageUrls: [
        'https://res.cloudinary.com/demo/image/upload/property-1.jpg',
        'https://res.cloudinary.com/demo/image/upload/property-2.jpg',
        'https://res.cloudinary.com/demo/image/upload/property-3.jpg',
        'https://res.cloudinary.com/demo/image/upload/property-4.jpg',
      ],
      target: TARGET,
      durationSeconds: 10,
      overlays: {
        intro: '<svg><path d="M0 0"/></svg>',
        detail: '<svg><path d="M0 0"/></svg>',
        end: '<svg><path d="M0 0"/></svg>',
      },
      voiceoverUrl: 'https://res.cloudinary.com/demo/video/upload/property-voice.mp3',
    })

    expect(result.timeline.tracks).toHaveLength(4)
    const imageClips = result.timeline.tracks[2].clips
    const backdropClips = result.timeline.tracks[3].clips
    expect(imageClips).toHaveLength(4)
    expect(imageClips.map(clip => (clip.asset as { type: string }).type))
      .toEqual(['image', 'image', 'image', 'image'])
    expect(imageClips.map(clip => clip.effect))
      .toEqual(['zoomIn', 'zoomOut', 'zoomIn', 'zoomOut'])
    expect(imageClips.map(clip => (clip.asset as { src: string }).src))
      .toEqual([
        'https://res.cloudinary.com/demo/image/upload/f_jpg,q_auto:good,c_fit,w_1016,h_884/property-1.jpg',
        'https://res.cloudinary.com/demo/image/upload/f_jpg,q_auto:good,c_fit,w_1016,h_884/property-2.jpg',
        'https://res.cloudinary.com/demo/image/upload/f_jpg,q_auto:good,c_fit,w_1016,h_884/property-3.jpg',
        'https://res.cloudinary.com/demo/image/upload/f_jpg,q_auto:good,c_fit,w_1016,h_884/property-4.jpg',
      ])
    expect(imageClips[0]).toMatchObject({
      start: 0,
      length: 2.5,
      width: 1016,
      height: 884,
      fit: 'contain',
      offset: { x: 0, y: 0.12 },
      transition: { in: 'none', out: 'fadeFast' },
    })
    expect(imageClips[3]).toMatchObject({
      start: 7.5,
      length: 2.5,
      transition: { in: 'fadeFast', out: 'none' },
    })
    expect(backdropClips).toHaveLength(4)
    expect(backdropClips[0]).toMatchObject({
      asset: {
        type: 'image',
        src: 'https://res.cloudinary.com/demo/image/upload/f_jpg,q_auto:good,c_fill,g_auto,w_1080,h_1920/property-1.jpg',
      },
      fit: 'crop',
      filter: 'blur',
      opacity: 0.68,
    })
    expect(result.output.range).toEqual({ start: 0, length: 10 })
  })

  it('rejects a property edit without a complete photo set', () => {
    expect(() => buildShotstackPropertyPhotoFilmEdit({
      sourceImageUrls: [
        'https://res.cloudinary.com/demo/image/upload/property-1.jpg',
        'https://res.cloudinary.com/demo/image/upload/property-2.jpg',
      ],
      target: TARGET,
      durationSeconds: 10,
      overlays: { intro: '<svg/>', detail: '<svg/>', end: '<svg/>' },
    })).toThrow('SHOTSTACK_PROPERTY_SOURCE_COUNT_INVALID')
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

  it('persists the queued render id when the synchronous polling window expires', async () => {
    vi.stubEnv('SHOTSTACK_STAGE_API_KEY', 'stage-secret')
    const onQueued = vi.fn()
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      success: true,
      response: { id: '2abd5c11-0f3d-4c6d-ba20-235fc9b8e8b7' },
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(2_001)

    const promise = renderShotstackEdit(edit(), {
      environment: 'stage',
      pollIntervalMs: 0,
      timeoutMs: 1_000,
      onQueued,
    })

    await expect(promise).rejects.toMatchObject({
      name: 'ShotstackRenderPendingError',
      renderId: '2abd5c11-0f3d-4c6d-ba20-235fc9b8e8b7',
    })
    await expect(promise).rejects.toBeInstanceOf(ShotstackRenderPendingError)
    expect(onQueued).toHaveBeenCalledWith('2abd5c11-0f3d-4c6d-ba20-235fc9b8e8b7')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('resumes an existing render without queueing or billing a second render', async () => {
    vi.stubEnv('SHOTSTACK_STAGE_API_KEY', 'stage-secret')
    const renderId = '2abd5c11-0f3d-4c6d-ba20-235fc9b8e8b7'
    const onQueued = vi.fn()
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      success: true,
      response: {
        status: 'done',
        url: 'https://shotstack-output.example/render.mp4',
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await renderShotstackEdit(edit(), {
      environment: 'stage',
      renderId,
      pollIntervalMs: 0,
      timeoutMs: 2_000,
      onQueued,
    })

    expect(result).toMatchObject({ id: renderId, status: 'done' })
    expect(onQueued).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`https://api.shotstack.io/edit/stage/render/${renderId}?data=false`)
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'GET' })
  })

  it('meters a ten-second production render at the configured per-minute rate', () => {
    expect(estimateShotstackRenderCostUsd(10, 'v1')).toBe(0.05)
    expect(estimateShotstackRenderCostUsd(10, 'stage')).toBe(0)
    expect(estimateShotstackRenderCredits(10, 'v1')).toBe(0.166667)
    expect(estimateShotstackRenderCredits(10, 'stage')).toBe(0)
  })
})
