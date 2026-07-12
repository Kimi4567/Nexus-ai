import { describe, expect, it } from 'vitest'
import { validatePaidCreativeMedia } from '@/lib/paidCreativeAttachment'

const safeImage = {
  id: 'media_1',
  type: 'IMAGE',
  mimeType: 'image/jpeg',
  url: 'https://res.cloudinary.com/nexus/image/upload/ad.jpg',
  size: 1_500_000,
  width: 1080,
  height: 1350,
}

describe('validatePaidCreativeMedia', () => {
  it('accepts a public, reviewed feed image and preserves source metadata', () => {
    expect(validatePaidCreativeMedia(safeImage)).toMatchObject({
      ready: true,
      errors: [],
      specs: {
        sourceMediaId: 'media_1',
        width: 1080,
        height: 1350,
        aspectRatio: 0.8,
        attachmentPolicy: 'explicit_reviewed_asset',
      },
    })
  })

  it('rejects non-image, unsupported, private, oversized, or dimensionless media', () => {
    const result = validatePaidCreativeMedia({
      ...safeImage,
      type: 'VIDEO',
      mimeType: 'video/mp4',
      url: 'https://localhost:3000/ad.mp4',
      size: 9 * 1024 * 1024,
      width: null,
      height: null,
    })

    expect(result.ready).toBe(false)
    expect(result.errors).toHaveLength(5)
  })

  it('rejects images outside the feed-safe size and aspect-ratio range', () => {
    const result = validatePaidCreativeMedia({ ...safeImage, width: 500, height: 1200 })

    expect(result.ready).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      'Use an image at least 600 x 600 pixels for this paid draft.',
      'Use a feed-safe aspect ratio between 4:5 and 1.91:1 for this paid draft.',
    ]))
  })
})
