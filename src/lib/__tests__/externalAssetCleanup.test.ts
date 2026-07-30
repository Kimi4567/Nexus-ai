import { describe, expect, it } from 'vitest'
import { cloudinaryReferenceFromUrl } from '@/lib/externalAssetCleanup.server'

describe('cloudinaryReferenceFromUrl', () => {
  it('extracts the original public id behind a transformed generated-image URL', () => {
    expect(cloudinaryReferenceFromUrl(
      'https://res.cloudinary.com/example/image/upload/c_fill,g_auto,w_1200,h_628,q_auto/v1785401694/nexus/visuals/visual_raw_audit.jpg',
    )).toEqual({
      publicId: 'nexus/visuals/visual_raw_audit',
      resourceType: 'image',
    })
  })

  it('rejects non-Cloudinary, non-HTTPS, and unversioned URLs', () => {
    expect(cloudinaryReferenceFromUrl('https://example.com/image.jpg')).toBeNull()
    expect(cloudinaryReferenceFromUrl('http://res.cloudinary.com/demo/image/upload/v1/a.jpg')).toBeNull()
    expect(cloudinaryReferenceFromUrl('https://res.cloudinary.com/demo/image/upload/a.jpg')).toBeNull()
  })
})
