import { describe, expect, it } from 'vitest'
import { assessCinematicProductAdAssets } from '@/lib/videoAdPreflight'

function product(id: string, productName = 'NEXUS Bottle') {
  return {
    id,
    fileName: `${id}.png`,
    type: 'IMAGE',
    width: 1600,
    height: 1200,
    intelligenceStatus: 'READY',
    intelligence: {
      version: 1,
      visibleSummary: 'Isolated product on a neutral background',
      assetKind: 'PRODUCT',
      language: 'NONE',
      products: [productName],
      visibleObjects: ['bottle'],
      visibleActions: [],
      visibleText: [],
      safeThemes: ['product'],
      possibleUseCases: ['product ad'],
      recommendedPlatforms: ['INSTAGRAM'],
      funnelStages: ['AWARENESS'],
      evidenceLimits: ['No performance claim is verified.'],
      qualityScore: 92,
      qualityIssues: [],
      rightsStatus: 'UNCONFIRMED',
      audioStatus: 'NOT_ANALYZED',
      sourceFrames: [],
    },
  }
}

describe('cinematic product-ad preflight', () => {
  it('qualifies two analysed high-resolution angles of the same product', () => {
    expect(assessCinematicProductAdAssets([product('front'), product('side')])).toMatchObject({
      eligible: true,
      route: 'CINEMATIC_PRODUCT_AD',
      qualifiedAssetIds: ['front', 'side'],
    })
  })

  it('routes screens and interface captures away from generative video', () => {
    const screen = product('screen')
    screen.intelligence.assetKind = 'SCREEN'
    screen.intelligence.products = ['NEXUS Dashboard']
    const result = assessCinematicProductAdAssets([screen, product('side', 'NEXUS Dashboard')])
    expect(result).toMatchObject({ eligible: false, route: 'MOTION_DESIGN_REQUIRED' })
    expect(result.issues.some(issue => issue.code === 'PRODUCT_REFERENCE_REQUIRED')).toBe(true)
  })

  it('blocks a paid call before debit when references are insufficient or inconsistent', () => {
    expect(assessCinematicProductAdAssets([product('front')]).issues)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'REFERENCE_COUNT' })]))
    expect(assessCinematicProductAdAssets([product('front', 'Bottle'), product('side', 'Laptop')]).issues)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'PRODUCT_IDENTITY_MISMATCH' })]))
  })
})
