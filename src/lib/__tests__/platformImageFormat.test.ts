import { describe, expect, it } from 'vitest'
import {
  buildPlatformReadyImageUrl,
  resolvePlatformImageFormat,
  validatePlatformImageDimensions,
} from '@/lib/platformImageFormat'

describe('platform image delivery contract', () => {
  it.each([
    ['META', 1080, 1350, '4:5'],
    ['INSTAGRAM', 1080, 1350, '4:5'],
    ['FACEBOOK', 1080, 1350, '4:5'],
    ['LINKEDIN', 1200, 628, '1.91:1'],
    ['X', 1200, 628, '1.91:1'],
    ['PINTEREST', 1000, 1500, '2:3'],
    ['TIKTOK', 1080, 1920, '9:16'],
    ['YOUTUBE', 1080, 1920, '9:16'],
  ])('resolves %s to an exact delivery canvas', (platform, width, height, aspectRatio) => {
    expect(resolvePlatformImageFormat(platform)).toMatchObject({ width, height, aspectRatio })
  })

  it('creates a crop-only Cloudinary delivery URL without raster copy or logo overlays', () => {
    expect(buildPlatformReadyImageUrl(
      'https://res.cloudinary.com/demo/image/upload/v1/nexus/raw.jpg',
      resolvePlatformImageFormat('LINKEDIN'),
    )).toBe(
      'https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,w_1200,h_628,q_auto/v1/nexus/raw.jpg',
    )
  })

  it('fails closed for non-durable image URLs', () => {
    expect(() => buildPlatformReadyImageUrl(
      'https://temporary.example/image.png',
      resolvePlatformImageFormat('META'),
    )).toThrow('durable Cloudinary image')
  })

  it('requires exact final dimensions instead of accepting a nearby provider ratio', () => {
    const target = resolvePlatformImageFormat('LINKEDIN')
    expect(validatePlatformImageDimensions({ width: 1536, height: 1024 }, target).passed).toBe(false)
    expect(validatePlatformImageDimensions({ width: 1200, height: 628 }, target).passed).toBe(true)
  })
})
