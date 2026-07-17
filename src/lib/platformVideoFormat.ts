import { normalizeImagePlatform } from '@/lib/platformImageFormat'
import { CINEMATIC_PRODUCT_AD_DURATION_SECONDS } from '@/lib/videoAdPreflight'

export type PlatformVideoFormat = {
  platform: string
  format: string
  aspectRatio: string
  width: number
  height: number
  ratio: '1280:720' | '720:1280' | '960:960'
  durationSeconds: typeof CINEMATIC_PRODUCT_AD_DURATION_SECONDS
}

export type PlatformVideoFormatValidation = {
  passed: boolean
  width: number
  height: number
  expectedWidth: number
  expectedHeight: number
  aspectRatio: string
  contentType: string | null
  durationSeconds: number
  expectedDurationSeconds: number
  durationPassed: boolean
}

export function resolvePlatformVideoFormat(platform?: string | null): PlatformVideoFormat {
  const normalized = normalizeImagePlatform(platform)
  const vertical = (
    normalized === 'META'
    || normalized === 'FACEBOOK'
    || normalized === 'INSTAGRAM'
    || normalized === 'PINTEREST'
    || /TIKTOK|REEL|SHORT|STORY/.test(normalized)
  )

  return vertical
    ? {
        platform: normalized,
        format: 'Vertical short-form video',
        aspectRatio: '9:16',
        width: 720,
        height: 1280,
        ratio: '720:1280',
        durationSeconds: CINEMATIC_PRODUCT_AD_DURATION_SECONDS,
      }
    : {
        platform: normalized,
        format: 'Professional landscape video',
        aspectRatio: '16:9',
        width: 1280,
        height: 720,
        ratio: '1280:720',
        durationSeconds: CINEMATIC_PRODUCT_AD_DURATION_SECONDS,
      }
}

export function validatePlatformVideoFormat(
  actual: {
    width: number | null
    height: number | null
    durationSeconds: number | null
    contentType?: string | null
  },
  target: PlatformVideoFormat,
): PlatformVideoFormatValidation {
  const width = Math.max(0, Math.round(Number(actual.width ?? 0)))
  const height = Math.max(0, Math.round(Number(actual.height ?? 0)))
  const durationSeconds = Math.max(0, Math.round(Number(actual.durationSeconds ?? 0)))
  const durationPassed = durationSeconds === target.durationSeconds

  return {
    passed: width === target.width && height === target.height && durationPassed,
    width,
    height,
    expectedWidth: target.width,
    expectedHeight: target.height,
    aspectRatio: target.aspectRatio,
    contentType: actual.contentType || null,
    durationSeconds,
    expectedDurationSeconds: target.durationSeconds,
    durationPassed,
  }
}
