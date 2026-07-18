import { describe, expect, it } from 'vitest'
import {
  assessMotionDesignVideoAsset,
  buildMotionDesignCopy,
  MOTION_DESIGN_DURATION_SECONDS,
} from '@/lib/motionDesignAd'
import { buildMotionDesignFfmpegArgs } from '@/lib/motionDesignAd.server'
import { resolvePlatformVideoFormat } from '@/lib/platformVideoFormat'

function screenVideo(overrides: Record<string, unknown> = {}) {
  return {
    id: 'video-1',
    fileName: 'product-demo.mp4',
    type: 'VIDEO',
    url: 'https://res.cloudinary.com/demo/video/upload/v1/workspace/product-demo.mp4',
    cloudinaryId: 'workspace/product-demo',
    width: 1080,
    height: 1350,
    duration: 6,
    category: 'demo',
    tags: ['product-demo'],
    intelligenceStatus: 'READY',
    intelligence: {
      version: 1,
      visibleSummary: 'Product scheduling interface',
      assetKind: 'DEMO',
      language: 'AR',
      products: ['NEXUS'],
      visibleObjects: ['calendar'],
      visibleActions: ['schedule content'],
      visibleText: ['نظم النشر'],
      safeThemes: ['publishing workflow'],
      possibleUseCases: ['product demo'],
      recommendedPlatforms: ['INSTAGRAM'],
      funnelStages: ['CONSIDERATION'],
      evidenceLimits: ['No performance claim is verified.'],
      qualityScore: 92,
      qualityIssues: [],
      rightsStatus: 'UNCONFIRMED',
      audioStatus: 'NOT_ANALYZED',
      sourceFrames: [],
    },
    ...overrides,
  }
}

describe('source-locked motion design', () => {
  it('qualifies analysed screen/demo video and blocks recursive derivatives', () => {
    expect(assessMotionDesignVideoAsset(screenVideo())).toMatchObject({
      eligible: true,
      route: 'SOURCE_LOCKED_MOTION_DESIGN',
      sourceKind: 'DEMO',
      qualityScore: 92,
    })
    expect(assessMotionDesignVideoAsset(screenVideo({ category: 'source-locked-motion-design-ad' }))).toMatchObject({
      eligible: false,
      issues: expect.arrayContaining([expect.objectContaining({ code: 'DERIVATIVE_SOURCE_BLOCKED' })]),
    })
  })

  it('blocks low-resolution, short, unanalysed, or physical-product sources', () => {
    expect(assessMotionDesignVideoAsset(screenVideo({ width: 640 }))).toMatchObject({ eligible: false })
    expect(assessMotionDesignVideoAsset(screenVideo({ duration: 3 }))).toMatchObject({ eligible: false })
    expect(assessMotionDesignVideoAsset(screenVideo({ intelligenceStatus: 'UNANALYZED' }))).toMatchObject({ eligible: false })
    const physical = screenVideo()
    ;(physical.intelligence as any).assetKind = 'PRODUCT'
    expect(assessMotionDesignVideoAsset(physical)).toMatchObject({
      eligible: false,
      issues: expect.arrayContaining([expect.objectContaining({ code: 'SCREEN_OR_DEMO_REQUIRED' })]),
    })
  })

  it('accepts clean full-HD 85+ masters and blocks weaker or flagged sources before spend', () => {
    const cleanFullHd = screenVideo({ width: 1080, height: 1920 })
    ;(cleanFullHd.intelligence as any).qualityScore = 85
    expect(assessMotionDesignVideoAsset(cleanFullHd, 'نظم حملتك')).toMatchObject({
      eligible: true,
      qualityScore: 85,
    })

    const flagged = screenVideo({ width: 1080, height: 1920 })
    ;(flagged.intelligence as any).qualityScore = 85
    ;(flagged.intelligence as any).qualityIssues = ['Soft small text']
    expect(assessMotionDesignVideoAsset(flagged, 'نظم حملتك')).toMatchObject({
      eligible: false,
      issues: expect.arrayContaining([expect.objectContaining({ code: 'QUALITY_TOO_LOW' })]),
    })

    const belowFloor = screenVideo({ width: 1080, height: 1920 })
    ;(belowFloor.intelligence as any).qualityScore = 84
    expect(assessMotionDesignVideoAsset(belowFloor, 'نظم حملتك')).toMatchObject({
      eligible: false,
      issues: expect.arrayContaining([expect.objectContaining({ code: 'QUALITY_TOO_LOW' })]),
    })

    expect(assessMotionDesignVideoAsset(screenVideo(), 'Organize your publishing plan')).toMatchObject({
      eligible: false,
      issues: expect.arrayContaining([expect.objectContaining({ code: 'LANGUAGE_MISMATCH' })]),
    })
  })

  it('derives bounded exact copy without hashtags, URLs, or unsupported new claims', () => {
    expect(buildMotionDesignCopy({
      brandName: 'NEXUS AI',
      caption: 'Organize content scheduling and execution with a clear view of your publishing plan. #NEXUSAI https://example.com',
    })).toEqual({
      brandLabel: 'NEXUS AI',
      hook: 'Organize content scheduling',
    })
  })

  it('builds a source-locked six-second edit with a kinetic hook, CTA push-in, and no audio', () => {
    const args = buildMotionDesignFfmpegArgs({
      sourcePath: '/tmp/source.mp4',
      outputPath: '/tmp/master.mp4',
      target: resolvePlatformVideoFormat('INSTAGRAM'),
    })
    const command = args.join(' ')
    expect(MOTION_DESIGN_DURATION_SECONDS).toBe(6)
    expect(command).toContain('-ss 0 -t 3 -i /tmp/source.mp4')
    expect(command).toContain('scale=660:920:force_original_aspect_ratio=decrease')
    expect(command).toContain('pad=720:1280')
    expect(command).toContain('tpad=stop_mode=clone:stop_duration=3')
    expect(command).toContain("zoompan=z='if(lt(on,12),1.08-(on/12)*0.08")
    expect(command).toContain(')*0.06)')
    expect(command).toContain('trim=duration=6')
    expect(command).toContain('-an')
    expect(command).toContain('-c:v libx264')
    expect(command).not.toContain('Review before publishing')
  })

  it('preserves a native vertical master edge-to-edge', () => {
    const args = buildMotionDesignFfmpegArgs({
      sourcePath: '/tmp/source.mp4',
      outputPath: '/tmp/master.mp4',
      target: resolvePlatformVideoFormat('YOUTUBE_SHORTS'),
      sourceWidth: 1080,
      sourceHeight: 1920,
    })
    const command = args.join(' ')
    expect(command).toContain('scale=720:1280:force_original_aspect_ratio=decrease')
    expect(command).toContain('pad=720:1280')
    expect(command).not.toContain('scale=660:920')
  })
})
