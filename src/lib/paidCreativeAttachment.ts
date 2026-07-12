import { normalizePaidCreativeUrl } from '@/lib/paidExecutionReadiness'

export interface PaidCreativeMediaInput {
  id: string
  type: string
  mimeType: string
  url: string
  size: number
  width?: number | null
  height?: number | null
}

const MAX_META_IMAGE_BYTES = 8 * 1024 * 1024
const SUPPORTED_META_IMAGE_TYPES = new Set(['image/jpeg', 'image/png'])

export function validatePaidCreativeMedia(media: PaidCreativeMediaInput) {
  const errors: string[] = []
  const normalizedUrl = normalizePaidCreativeUrl(media.url)

  if (media.type !== 'IMAGE') {
    errors.push('Select an image asset for the current Meta single-image execution path.')
  }
  if (!SUPPORTED_META_IMAGE_TYPES.has(media.mimeType.toLowerCase())) {
    errors.push('Meta paid execution currently accepts reviewed JPEG or PNG assets only.')
  }
  if (!normalizedUrl) {
    errors.push('The creative must use a public HTTPS asset URL that Meta can fetch.')
  }
  if (!Number.isFinite(media.size) || media.size <= 0 || media.size > MAX_META_IMAGE_BYTES) {
    errors.push('The creative image must be no larger than 8 MB.')
  }

  const width = Number(media.width)
  const height = Number(media.height)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    errors.push('Image dimensions are required before paid execution readiness can be confirmed.')
  } else {
    const ratio = width / height
    if (width < 600 || height < 600) {
      errors.push('Use an image at least 600 x 600 pixels for this paid draft.')
    }
    if (ratio < 0.8 || ratio > 1.91) {
      errors.push('Use a feed-safe aspect ratio between 4:5 and 1.91:1 for this paid draft.')
    }
  }

  return {
    ready: errors.length === 0,
    errors,
    normalizedUrl,
    specs: {
      sourceMediaId: media.id,
      mimeType: media.mimeType,
      fileSize: media.size,
      width: Number.isFinite(width) ? width : null,
      height: Number.isFinite(height) ? height : null,
      aspectRatio: Number.isFinite(width) && Number.isFinite(height) && height > 0
        ? Number((width / height).toFixed(4))
        : null,
      attachmentPolicy: 'explicit_reviewed_asset',
    },
  }
}
