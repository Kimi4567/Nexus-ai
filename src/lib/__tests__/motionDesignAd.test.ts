import { describe, expect, it } from 'vitest'
import {
  assessMotionDesignVideoAsset,
  buildMotionDesignCopy,
  MOTION_DESIGN_DURATION_SECONDS,
} from '@/lib/motionDesignAd'
import {
  buildMotionDesignFfmpegArgs,
  motionDesignOverlaySvgs,
  splitMotionDesignHookMetric,
} from '@/lib/motionDesignAd.server'
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

  it('blocks low-resolution, short, unanalysed, or unsupported sources', () => {
    expect(assessMotionDesignVideoAsset(screenVideo({ width: 640 }))).toMatchObject({ eligible: false })
    expect(assessMotionDesignVideoAsset(screenVideo({ duration: 3 }))).toMatchObject({ eligible: false })
    expect(assessMotionDesignVideoAsset(screenVideo({ intelligenceStatus: 'UNANALYZED' }))).toMatchObject({ eligible: false })
    const physical = screenVideo()
    ;(physical.intelligence as any).assetKind = 'PRODUCT'
    expect(assessMotionDesignVideoAsset(physical)).toMatchObject({
      eligible: true,
      sourceKind: 'PRODUCT',
    })
    const unsupported = screenVideo()
    ;(unsupported.intelligence as any).assetKind = 'OTHER'
    expect(assessMotionDesignVideoAsset(unsupported)).toMatchObject({
      eligible: false,
      issues: expect.arrayContaining([expect.objectContaining({ code: 'SUPPORTED_SOURCE_REQUIRED' })]),
    })
  })

  it('accepts clean full-HD 70+ masters and blocks weaker or flagged sources before spend', () => {
    const cleanFullHd = screenVideo({ width: 1080, height: 1920 })
    ;(cleanFullHd.intelligence as any).qualityScore = 70
    ;(cleanFullHd.intelligence as any).qualityIssues = ['Limited visual engagement, primarily text-based']
    expect(assessMotionDesignVideoAsset(cleanFullHd, 'نظم حملتك')).toMatchObject({
      eligible: true,
      qualityScore: 70,
    })

    const flagged = screenVideo({ width: 1080, height: 1920 })
    ;(flagged.intelligence as any).qualityScore = 70
    ;(flagged.intelligence as any).qualityIssues = ['Soft small text']
    expect(assessMotionDesignVideoAsset(flagged, 'نظم حملتك')).toMatchObject({
      eligible: false,
      issues: expect.arrayContaining([expect.objectContaining({ code: 'QUALITY_TOO_LOW' })]),
    })

    const belowFloor = screenVideo({ width: 1080, height: 1920 })
    ;(belowFloor.intelligence as any).qualityScore = 69
    expect(assessMotionDesignVideoAsset(belowFloor, 'نظم حملتك')).toMatchObject({
      eligible: false,
      issues: expect.arrayContaining([expect.objectContaining({ code: 'QUALITY_TOO_LOW' })]),
    })

    expect(assessMotionDesignVideoAsset(screenVideo(), 'Organize your publishing plan')).toMatchObject({
      eligible: false,
      issues: expect.arrayContaining([expect.objectContaining({ code: 'LANGUAGE_MISMATCH' })]),
    })
  })

  it('does not mistake a short Latin product identity for conflicting ad copy', () => {
    const productHero = screenVideo({ width: 1080, height: 1920 })
    ;(productHero.intelligence as any).assetKind = 'PRODUCT'
    ;(productHero.intelligence as any).language = 'EN'
    ;(productHero.intelligence as any).visibleSummary = "Animated product hero for a coffee bag labelled 'Luma Roast Lab'."
    ;(productHero.intelligence as any).products = ["coffee bag labelled 'Luma Roast Lab'"]
    ;(productHero.intelligence as any).visibleText = ['Luma Roast Lab']
    ;(productHero.intelligence as any).qualityScore = 75
    ;(productHero.intelligence as any).qualityIssues = ['Lacks detailed information about the subscription or delivery.']

    expect(assessMotionDesignVideoAsset(productHero, 'راجع عنوان التوصيل قبل الطلب')).toMatchObject({
      eligible: true,
      route: 'SOURCE_LOCKED_MOTION_DESIGN',
      qualityScore: 75,
      issues: [],
    })
  })

  it('derives bounded exact copy without hashtags, URLs, or unsupported new claims', () => {
    expect(buildMotionDesignCopy({
      brandName: 'NEXUS AI',
      caption: 'Organize content scheduling and execution with a clear view of your publishing plan. #NEXUSAI https://example.com',
    })).toEqual({
      brandLabel: 'NEXUS AI',
      hook: 'Organize content scheduling',
      cta: 'View details',
      language: 'en',
    })
  })

  it('uses the approved answer instead of leaving a self-answered question unresolved', () => {
    expect(buildMotionDesignCopy({
      brandName: 'Luma Roast Lab',
      caption: 'ما نطاق ومدة التوصيل؟ التوصيل متاح داخل دبي فقط خلال 48 ساعة. راجع عنوان التوصيل قبل الطلب.',
    })).toEqual({
      brandLabel: 'Luma Roast Lab',
      hook: 'داخل دبي فقط خلال 48 ساعة',
      cta: 'عرض التفاصيل',
      language: 'ar',
    })
  })

  it('prioritizes an exact approved price-and-quantity fact over generic setup copy', () => {
    expect(buildMotionDesignCopy({
      brandName: 'Luma Roast Lab',
      caption: 'هل يساعدك الاشتراك الشهري على تنظيم روتين القهوة؟ ابدأ بتقدير استهلاكك، ثم قارن ذلك بكيلوغرام واحد شهريًا مقابل 149 درهمًا. التوصيل داخل دبي فقط خلال 48 ساعة.',
    })).toEqual({
      brandLabel: 'Luma Roast Lab',
      hook: 'بكيلوغرام واحد شهريًا مقابل 149 درهمًا',
      cta: 'عرض التفاصيل',
      language: 'ar',
    })
  })

  it('renders Arabic hook and CTA as deterministic vector paths', async () => {
    const overlays = await motionDesignOverlaySvgs({
      brandLabel: 'Luma Roast Lab',
      hook: 'راجع تفاصيل الاشتراك الشهري',
      cta: 'عرض التفاصيل',
      language: 'ar',
    })

    expect(overlays.intro).toContain('<path')
    expect(overlays.hook).toContain('<path')
    expect(overlays.end).toContain('<path')
    expect(overlays.intro).not.toContain('<text')
    expect(overlays.hook).not.toContain('<text')
    expect(overlays.end).not.toContain('<text')
    expect(overlays.hook).not.toContain('راجع')
    expect(overlays.end).not.toContain('التفاصيل')
  })

  it('recognizes a shaped Arabic unit as the hook metric instead of overflowing body copy', () => {
    expect(splitMotionDesignHookMetric('بكيلوغرام واحد شهريًا مقابل 149 درهمًا')).toEqual({
      lead: 'بكيلوغرام واحد شهريًا مقابل',
      metric: '149 درهمًا',
    })
    expect(splitMotionDesignHookMetric('داخل دبي فقط خلال 48 ساعة')).toEqual({
      lead: 'داخل دبي فقط خلال',
      metric: '48 ساعة',
    })
  })

  it('keeps the approved commercial lead visible with the metric in the opening frame', async () => {
    const shared = {
      brandLabel: 'Luma Roast Lab',
      cta: 'عرض التفاصيل',
      language: 'ar' as const,
    }
    const priceOffer = await motionDesignOverlaySvgs({
      ...shared,
      hook: 'كيلوغرام واحد شهريًا، والسعر 149 درهمًا',
    })
    const priceOnly = await motionDesignOverlaySvgs({
      ...shared,
      hook: '149 درهمًا',
    })
    const deliveryOffer = await motionDesignOverlaySvgs({
      ...shared,
      hook: 'داخل دبي فقط خلال 48 ساعة',
    })
    const durationOnly = await motionDesignOverlaySvgs({
      ...shared,
      hook: '48 ساعة',
    })

    expect(priceOffer.intro).not.toBe(priceOnly.intro)
    expect(deliveryOffer.intro).not.toBe(durationOnly.intro)
    expect(priceOffer.intro.match(/<path/g)?.length ?? 0)
      .toBeGreaterThan(priceOnly.intro.match(/<path/g)?.length ?? 0)
    expect(deliveryOffer.intro.match(/<path/g)?.length ?? 0)
      .toBeGreaterThan(durationOnly.intro.match(/<path/g)?.length ?? 0)
    expect(priceOffer.intro).not.toContain('<text')
    expect(deliveryOffer.intro).not.toContain('<text')
  })

  it('builds a layered six-second edit with three source scenes, transitions, and original sound design', () => {
    const args = buildMotionDesignFfmpegArgs({
      sourcePath: '/tmp/source.mp4',
      introOverlayPath: '/tmp/intro.png',
      hookOverlayPath: '/tmp/hook.png',
      endOverlayPath: '/tmp/end.png',
      outputPath: '/tmp/master.mp4',
      target: resolvePlatformVideoFormat('INSTAGRAM'),
    })
    const command = args.join(' ')
    expect(MOTION_DESIGN_DURATION_SECONDS).toBe(6)
    expect(command).toContain('-ss 0 -t 3 -i /tmp/source.mp4')
    expect(command).toContain('-i /tmp/intro.png')
    expect(command).toContain('-i /tmp/hook.png')
    expect(command).toContain('-i /tmp/end.png')
    expect(command).toContain('scale=720:1280:force_original_aspect_ratio=increase')
    expect(command).toContain('gblur=sigma=32')
    expect(command).toContain('trim=start=0:duration=2')
    expect(command).toContain('trim=start=0.5:duration=2.5')
    expect(command).toContain('trim=start=0.8:duration=2.2')
    expect(command).toContain('xfade=transition=smoothleft:duration=0.35:offset=1.65')
    expect(command).toContain('xfade=transition=fade:duration=0.35:offset=3.8')
    expect(command).toContain('[1:v]format=rgba,fade=t=out:st=1.52:d=0.18:alpha=1[intro]')
    expect(command).toContain("[base][intro]overlay=x=0:y=0:enable='between(t,0,1.72)'")
    expect(command).not.toContain('[1:v]format=rgba,fade=t=in')
    expect(command).toContain('anoisesrc=color=pink')
    expect(command).toContain('sine=frequency=92')
    expect(command).toContain('loudnorm=I=-18:TP=-2:LRA=7')
    expect(command).toContain('-map [outa]')
    expect(command).toContain('-c:a aac')
    expect(command).toContain('-c:v libx264')
    expect(command).not.toContain('Review before publishing')
  })

  it('preserves a native vertical master edge-to-edge', () => {
    const args = buildMotionDesignFfmpegArgs({
      sourcePath: '/tmp/source.mp4',
      introOverlayPath: '/tmp/intro.png',
      hookOverlayPath: '/tmp/hook.png',
      endOverlayPath: '/tmp/end.png',
      outputPath: '/tmp/master.mp4',
      target: resolvePlatformVideoFormat('YOUTUBE_SHORTS'),
      sourceWidth: 1080,
      sourceHeight: 1920,
    })
    const command = args.join(' ')
    expect(command).toContain('scale=720:1280:force_original_aspect_ratio=increase')
    expect(command).toContain('crop=720:1280')
    expect(command).not.toContain('gblur=sigma=32')
  })
})
