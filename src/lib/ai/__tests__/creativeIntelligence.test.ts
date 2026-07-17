import { describe, expect, it } from 'vitest'
import { getMediaEvidenceFrames } from '../creativeIntelligence'

describe('creative intelligence visual evidence frames', () => {
  it('uses the owned image URL as one visual evidence frame', () => {
    expect(getMediaEvidenceFrames({
      id: 'image-1',
      fileName: 'product.jpg',
      type: 'IMAGE',
      url: 'https://res.cloudinary.com/demo/image/upload/v1/product.jpg',
    })).toEqual(['https://res.cloudinary.com/demo/image/upload/v1/product.jpg'])
  })

  it('derives two bounded still frames from a Cloudinary video', () => {
    expect(getMediaEvidenceFrames({
      id: 'video-1',
      fileName: 'product.mp4',
      type: 'VIDEO',
      duration: 9,
      url: 'https://res.cloudinary.com/demo/video/upload/v1/product.mp4',
    })).toEqual([
      'https://res.cloudinary.com/demo/video/upload/so_0,f_jpg,q_auto/v1/product.mp4',
      'https://res.cloudinary.com/demo/video/upload/so_4,f_jpg,q_auto/v1/product.mp4',
    ])
  })

  it('fails closed for unsupported or insecure video URLs', () => {
    expect(getMediaEvidenceFrames({ id: 'v1', fileName: 'x.mp4', type: 'VIDEO', url: 'http://example.com/x.mp4' })).toEqual([])
    expect(getMediaEvidenceFrames({ id: 'v2', fileName: 'x.mp4', type: 'VIDEO', url: 'https://example.com/x.mp4' })).toEqual([])
  })
})
