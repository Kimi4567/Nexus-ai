export type PlatformImageFormat = {
  platform: string
  format: string
  aspectRatio: string
  width: number
  height: number
}

export type PlatformImageFormatValidation = {
  passed: boolean
  width: number
  height: number
  expectedWidth: number
  expectedHeight: number
  aspectRatio: string
  contentType: string | null
}

const FORMAT_PRESETS = {
  portraitFeed: {
    format: 'Portrait social feed image',
    aspectRatio: '4:5',
    width: 1080,
    height: 1350,
  },
  landscapeFeed: {
    format: 'Professional landscape feed image',
    aspectRatio: '1.91:1',
    width: 1200,
    height: 628,
  },
  verticalShort: {
    format: 'Vertical short-form cover',
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
  },
  pinterestPin: {
    format: 'Pinterest standard image Pin',
    aspectRatio: '2:3',
    width: 1000,
    height: 1500,
  },
  squareFeed: {
    format: 'Square feed image',
    aspectRatio: '1:1',
    width: 1080,
    height: 1080,
  },
} as const

export function normalizeImagePlatform(platform?: string | null): string {
  const normalized = (platform || '').trim().toUpperCase()
  if (!normalized) return 'GENERAL'
  if (normalized.includes('LINKEDIN')) return 'LINKEDIN'
  if (normalized === 'X' || normalized.includes('TWITTER')) return 'X'
  if (normalized.includes('PINTEREST') || normalized === 'PIN') return 'PINTEREST'
  if (normalized.includes('INSTAGRAM')) return 'INSTAGRAM'
  if (normalized.includes('FACEBOOK')) return 'FACEBOOK'
  if (normalized.includes('META')) return 'META'
  if (
    normalized.includes('TIKTOK')
    || normalized.includes('REEL')
    || normalized.includes('SHORT')
    || normalized.includes('STORY')
    || normalized === 'YOUTUBE'
  ) return normalized === 'YOUTUBE' ? 'YOUTUBE_SHORTS' : normalized
  if (normalized.includes('GOOGLE')) return 'GOOGLE'
  return normalized
}

/**
 * The one server-owned image delivery contract used by planning, generation,
 * QA, and attachment. Client-supplied aspect ratios never override it.
 */
export function resolvePlatformImageFormat(platform?: string | null): PlatformImageFormat {
  const normalized = normalizeImagePlatform(platform)
  const preset = normalized === 'LINKEDIN' || normalized === 'X' || normalized === 'GOOGLE'
    ? FORMAT_PRESETS.landscapeFeed
    : normalized === 'PINTEREST'
      ? FORMAT_PRESETS.pinterestPin
      : normalized === 'META' || normalized === 'FACEBOOK' || normalized === 'INSTAGRAM'
        ? FORMAT_PRESETS.portraitFeed
        : /TIKTOK|REEL|SHORT|STORY/.test(normalized)
          ? FORMAT_PRESETS.verticalShort
          : FORMAT_PRESETS.squareFeed

  return { platform: normalized, ...preset }
}

export function buildPlatformReadyImageUrl(
  durableCloudinaryUrl: string,
  target: PlatformImageFormat,
): string {
  if (
    !durableCloudinaryUrl.startsWith('https://res.cloudinary.com/')
    || !durableCloudinaryUrl.includes('/image/upload/')
  ) {
    throw new Error('NEXUS platform formatting requires a durable Cloudinary image')
  }

  const transformation = `c_fill,g_auto,w_${target.width},h_${target.height},q_auto`
  return durableCloudinaryUrl.replace('/image/upload/', `/image/upload/${transformation}/`)
}

export function validatePlatformImageDimensions(
  actual: { width: number; height: number; contentType?: string | null },
  target: PlatformImageFormat,
): PlatformImageFormatValidation {
  const width = Math.max(0, Math.round(Number(actual.width)))
  const height = Math.max(0, Math.round(Number(actual.height)))
  return {
    passed: width === target.width && height === target.height,
    width,
    height,
    expectedWidth: target.width,
    expectedHeight: target.height,
    aspectRatio: target.aspectRatio,
    contentType: actual.contentType || null,
  }
}
