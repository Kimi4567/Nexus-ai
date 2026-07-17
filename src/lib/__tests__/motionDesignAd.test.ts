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
      qualityScore: 85,
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
      qualityScore: 85,
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

  it('derives bounded exact copy without hashtags, URLs, or unsupported new claims', () => {
    expect(buildMotionDesignCopy({
      brandName: 'NEXUS AI',
      caption: 'Organize content scheduling and execution with a clear view of your publishing plan. #NEXUSAI https://example.com',
    })).toEqual({
      brandLabel: 'NEXUS AI',
      hook: 'Organize content scheduling',
    })
  })

  it('builds a source-locked six-second edit with a three-second end-card hold and no audio', () => {
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
    expect(command).toContain('trim=duration=6')
    expect(command).toContain('-an')
    expect(command).toContain('-c:v libx264')
    expect(command).not.toContain('Review before publishing')
  })
})
