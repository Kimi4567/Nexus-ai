import { v2 as cloudinary } from 'cloudinary'
import type { PlatformVideoFormat } from '@/lib/platformVideoFormat'
import {
  MOTION_DESIGN_DURATION_SECONDS,
  MOTION_DESIGN_SAFE_SOURCE_SECONDS,
  type MotionDesignCopy,
} from '@/lib/motionDesignAd'

export type StoredMotionDesignVideo = {
  url: string
  publicId: string
  bytes: number
  width: number | null
  height: number | null
  duration: number | null
  format: string
}

function safeHex(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().replace(/^#/, '')
  return /^[0-9a-f]{6}$/i.test(normalized) ? `#${normalized.toUpperCase()}` : fallback
}

function textLayer(input: {
  text: string
  size: number
  weight: 'normal' | 'bold'
  color: string
  gravity: 'north_west' | 'south'
  x: number
  y: number
}): Array<Record<string, unknown>> {
  return [
    {
      overlay: {
        font_family: 'Arial',
        font_size: input.size,
        font_weight: input.weight,
        text: input.text,
      },
      color: input.color,
      effect: 'shadow:45',
    },
    {
      gravity: input.gravity,
      x: input.x,
      y: input.y,
      start_offset: 0,
      end_offset: MOTION_DESIGN_DURATION_SECONDS,
      flags: 'layer_apply',
    },
  ]
}

/**
 * One deterministic recipe: use only the opening verified segment, play it
 * forward and backward for coherent motion, and bake exact approved copy into
 * platform-safe bars. The source pixels are never regenerated.
 */
export function buildMotionDesignTransformationUrl(input: {
  sourcePublicId: string
  target: PlatformVideoFormat
  copy: MotionDesignCopy
  brandColor?: string | null
  cloudName?: string | null
}): string {
  const cloudName = input.cloudName
    || process.env.CLOUDINARY_CLOUD_NAME
    || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  if (!cloudName) throw new Error('Cloudinary motion-design delivery is not configured')

  cloudinary.config({ cloud_name: cloudName })
  const vertical = input.target.height > input.target.width
  const sourceWidth = vertical ? input.target.width - 60 : Math.round(input.target.width * 0.78)
  const sourceHeight = vertical ? input.target.height - 360 : input.target.height - 160
  const accent = safeHex(input.brandColor, '#A78BFA')
  const transformations: Array<Record<string, unknown>> = [
    { start_offset: 0, end_offset: MOTION_DESIGN_SAFE_SOURCE_SECONDS },
    { effect: 'boomerang' },
    { effect: 'accelerate:-19' },
    { width: sourceWidth, height: sourceHeight, crop: 'fit' },
    { width: input.target.width, height: input.target.height, crop: 'pad', background: '#090B13', gravity: 'center' },
    ...textLayer({ text: input.copy.brandLabel, size: vertical ? 28 : 22, weight: 'bold', color: accent, gravity: 'north_west', x: vertical ? 42 : 36, y: vertical ? 54 : 28 }),
    ...textLayer({ text: input.copy.hook, size: vertical ? 38 : 30, weight: 'bold', color: '#FFFFFF', gravity: 'south', x: 0, y: vertical ? 110 : 48 }),
    { quality: 'auto:best', fetch_format: 'mp4', video_codec: 'h264', audio_codec: 'none' },
  ]

  return cloudinary.url(input.sourcePublicId, {
    resource_type: 'video',
    format: 'mp4',
    secure: true,
    sign_url: false,
    transformation: transformations,
  })
}

function configureCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) throw new Error('Cloudinary motion-design storage is not configured')
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret })
}

export async function persistMotionDesignAd(input: {
  transformedUrl: string
  generationId: string
}): Promise<StoredMotionDesignVideo> {
  configureCloudinary()
  if (!input.transformedUrl.startsWith('https://res.cloudinary.com/')) throw new Error('Motion design received an unsafe transformation URL')
  const result = await cloudinary.uploader.upload(input.transformedUrl, {
    resource_type: 'video',
    folder: 'nexus/motion-design',
    public_id: `motion_${input.generationId}`,
    overwrite: false,
    unique_filename: false,
  })
  if (!result.secure_url?.startsWith('https://')) throw new Error('Cloudinary returned no durable motion-design video')
  return {
    url: result.secure_url,
    publicId: result.public_id,
    bytes: Number(result.bytes || 0),
    width: Number.isFinite(result.width) ? result.width : null,
    height: Number.isFinite(result.height) ? result.height : null,
    duration: Number.isFinite(result.duration) ? Math.round(result.duration) : null,
    format: result.format || 'mp4',
  }
}

export async function destroyMotionDesignAd(publicId: string): Promise<void> {
  configureCloudinary()
  await cloudinary.uploader.destroy(publicId, { resource_type: 'video', invalidate: true })
}
