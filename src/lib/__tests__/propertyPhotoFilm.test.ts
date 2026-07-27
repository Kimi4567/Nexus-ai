import { describe, expect, it } from 'vitest'
import {
  assessPropertyPhotoFilmAssets,
  buildPropertyPhotoFilmCopy,
  reviewPropertyPhotoFilmCopy,
} from '@/lib/propertyPhotoFilm'

function property(id: string): any {
  return {
    id,
    fileName: `demo-property-${id}.jpg`,
    type: 'IMAGE',
    url: `https://res.cloudinary.com/demo/image/upload/demo-property-${id}.jpg`,
    width: 1800,
    height: 1200,
    intelligenceStatus: 'READY',
    intelligence: {
      version: 1,
      visibleSummary: 'A modern residential property interior with large windows',
      assetKind: 'PROPERTY',
      language: 'NONE',
      products: [],
      visibleObjects: ['living room', 'windows'],
      visibleActions: [],
      visibleText: [],
      safeThemes: ['residential architecture'],
      possibleUseCases: ['property presentation'],
      recommendedPlatforms: ['INSTAGRAM'],
      funnelStages: ['AWARENESS'],
      evidenceLimits: ['No address, price, size, room count, ownership, or availability is verified.'],
      qualityScore: 91,
      qualityIssues: [],
      rightsStatus: 'UNCONFIRMED',
      audioStatus: 'NOT_ANALYZED',
      sourceFrames: [],
    },
  }
}

describe('source-locked property photo film', () => {
  it('qualifies three analysed durable property photographs', () => {
    expect(assessPropertyPhotoFilmAssets([
      property('exterior'),
      property('living'),
      property('terrace'),
    ])).toMatchObject({
      eligible: true,
      route: 'SOURCE_LOCKED_PROPERTY_PHOTO_FILM',
      qualifiedAssetIds: ['exterior', 'living', 'terrace'],
    })
  })

  it('fails closed for non-property, low-resolution, or watermarked references', () => {
    const nonProperty = property('product')
    nonProperty.intelligence.assetKind = 'PRODUCT'
    nonProperty.intelligence.visibleSummary = 'A coffee bag on a table'
    nonProperty.intelligence.visibleObjects = ['coffee bag']

    const small = property('small')
    small.width = 600
    small.height = 600

    const watermarked = property('watermark')
    watermarked.intelligence.qualityIssues = ['Visible stock watermark in the lower corner']

    const result = assessPropertyPhotoFilmAssets([nonProperty, small, watermarked])
    expect(result.eligible).toBe(false)
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'PROPERTY_REFERENCE_REQUIRED', mediaId: 'product' }),
      expect.objectContaining({ code: 'RESOLUTION_REQUIRED', mediaId: 'small' }),
      expect.objectContaining({ code: 'UNSAFE_SOURCE_GRAPHICS', mediaId: 'watermark' }),
    ]))
  })

  it('blocks unsupported listing facts even when they sound like normal real-estate copy', () => {
    const result = reviewPropertyPhotoFilmCopy({
      caption: 'A 3 bedroom villa in Dubai Marina. Available now for AED 4,500,000.',
      verifiedFacts: [],
    })
    expect(result.ok).toBe(false)
    expect(result.unsupportedClaims).toHaveLength(2)
  })

  it('accepts a high-risk listing claim only when the complete sentence is source-linked proof', () => {
    const claim = 'A 3 bedroom villa in Dubai Marina.'
    expect(reviewPropertyPhotoFilmCopy({
      caption: claim,
      verifiedFacts: [`Source: signed listing brief — ${claim}`],
    })).toEqual({ ok: true, unsupportedClaims: [] })
  })

  it('creates restrained demo copy without inventing a price, location, or amenity', () => {
    expect(buildPropertyPhotoFilmCopy({
      brandName: 'Northline Property Marketing',
      caption: 'See the property, frame by frame. A focused visual tour from selected photography. Demo — not a live listing.',
    })).toEqual({
      brand: 'Northline Property Marketing',
      eyebrow: 'PROPERTY TOUR',
      hook: 'See the property, frame by frame.',
      detail: 'A focused visual tour from selected photography.',
      cta: 'Request verified details',
      disclosure: 'DEMO • NOT A LIVE LISTING',
      language: 'en',
    })
  })
})
