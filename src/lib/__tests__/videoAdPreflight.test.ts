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

  it('blocks visible creator references before the expensive product-shot provider call', () => {
    const close = product('close')
    close.intelligence.products = []
    close.intelligence.visibleSummary = 'A woman wearing a black abaya with detailed silver embroidery on the sleeves.'
    close.intelligence.visibleObjects = ['black abaya', 'silver embroidery', 'woman']

    const full = product('full')
    full.intelligence.products = []
    full.intelligence.visibleSummary = 'A full view of a black abaya with silver embroidery on its sleeves and front trim.'
    full.intelligence.visibleObjects = ['black abaya', 'silver embroidery', 'woman']

    const result = assessCinematicProductAdAssets([close, full])
    expect(result).toMatchObject({ eligible: false, route: 'BLOCKED' })
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CREATOR_REFERENCE_UNSUPPORTED' }),
    ]))
  })

  it('does not treat a shared generic category as proof of the same product', () => {
    const red = product('red')
    red.intelligence.products = []
    red.intelligence.visibleSummary = 'A red silk abaya with a gold belt.'
    red.intelligence.visibleObjects = ['red abaya', 'gold belt']

    const black = product('black')
    black.intelligence.products = []
    black.intelligence.visibleSummary = 'A black abaya with silver embroidered sleeves.'
    black.intelligence.visibleObjects = ['black abaya', 'silver embroidery']

    const result = assessCinematicProductAdAssets([red, black])
    expect(result.eligible).toBe(false)
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'PRODUCT_IDENTITY_MISMATCH' }),
    ]))
  })
})
