import { describe, expect, it } from 'vitest'
import {
  buildCreativeIntelligencePayload,
  deriveCreativeMatch,
  getCreativeCompatibility,
  isCreativeIntelligenceSourceCandidate,
  normalizeMediaIntelligence,
  normalizeProviderMatches,
  rankCreativeMediaForPost,
  type CreativeMediaCandidate,
  type CreativePostCandidate,
} from '../creativeIntelligence'

const analysis = normalizeMediaIntelligence({
  visibleSummary: 'A blue NEXUS product box on a clean desk beside a laptop.',
  assetKind: 'PRODUCT',
  language: 'EN',
  products: ['NEXUS product box'],
  visibleObjects: ['laptop', 'desk'],
  visibleActions: [],
  visibleText: ['NEXUS'],
  safeThemes: ['product presentation', 'organized workspace'],
  possibleUseCases: ['product awareness'],
  recommendedPlatforms: ['INSTAGRAM', 'LINKEDIN'],
  funnelStages: ['AWARENESS'],
  evidenceLimits: ['No customer result is visible.'],
  qualityScore: 86,
  qualityIssues: [],
  rightsStatus: 'CONFIRMED',
  audioStatus: 'TRANSCRIBED',
}, ['https://res.cloudinary.com/demo/image/upload/product.jpg'])

const media: CreativeMediaCandidate = {
  id: 'media-1',
  url: 'https://res.cloudinary.com/demo/image/upload/product.jpg',
  fileName: 'nexus-product.jpg',
  type: 'IMAGE',
  intelligenceStatus: 'READY',
  intelligence: analysis,
}

const imagePost: CreativePostCandidate = {
  id: 'post-1',
  caption: 'See how the NEXUS product keeps your workspace organized.',
  platform: 'INSTAGRAM',
  isVideoPost: false,
  contentPlanIndex: 1,
}

describe('creative intelligence truth and matching', () => {
  it('forces rights and audio limitations instead of trusting provider claims', () => {
    expect(analysis.rightsStatus).toBe('UNCONFIRMED')
    expect(analysis.audioStatus).toBe('NOT_ANALYZED')
    expect(analysis.sourceFrames).toHaveLength(1)
  })

  it('uses an image directly for an image post and only as a reference for a video post', () => {
    expect(getCreativeCompatibility(imagePost, media)).toBe('DIRECT')
    expect(getCreativeCompatibility({ ...imagePost, isVideoPost: true }, media)).toBe('REFERENCE')
    expect(getCreativeCompatibility(imagePost, { ...media, type: 'VIDEO' })).toBe('INCOMPATIBLE')
  })

  it('blends semantic provider matching with deterministic evidence and keeps the result review-only', () => {
    const match = deriveCreativeMatch(imagePost, media, {
      score: 92,
      reasons: ['The visible product and organized desk support the post subject.'],
      gaps: ['No performance result is visible.'],
    })
    expect(match.verdict).toBe('STRONG')
    expect(match.recommendedDecision).toBe('USE_EXISTING')
    expect(match.reasons[0]).toContain('visible product')
    expect(match.gaps[0]).toContain('No performance')
  })

  it('caps unanalyzed assets at weak confidence', () => {
    const match = deriveCreativeMatch(imagePost, {
      ...media,
      intelligenceStatus: 'UNANALYZED',
      intelligence: null,
    }, { score: 100 })
    expect(match.score).toBeLessThanOrEqual(34)
    expect(match.verdict).toBe('WEAK')
    expect(match.reasons[0]).toContain('must be analyzed')
  })

  it('rejects provider pair IDs that are outside the owned campaign inputs', () => {
    const matches = normalizeProviderMatches([
      { postId: 'post-1', mediaId: 'media-1', score: 80, reasons: ['valid'] },
      { postId: 'post-unknown', mediaId: 'media-1', score: 100 },
      { postId: 'post-1', mediaId: 'media-unknown', score: 100 },
    ], [imagePost], [media])
    expect(matches).toHaveLength(1)
    expect(matches[0]).toMatchObject({ postId: 'post-1', mediaId: 'media-1', score: 80 })
  })

  it('ranks an image as a product reference for video generation without pretending it is attachable video', () => {
    const matches = rankCreativeMediaForPost({ ...imagePost, id: 'video-post', isVideoPost: true }, [media], [{
      postId: 'video-post',
      mediaId: 'media-1',
      score: 84,
      reasons: ['The real product can anchor the first frame.'],
      gaps: ['Motion must be generated.'],
    }])
    expect(matches[0]).toMatchObject({
      compatibility: 'REFERENCE',
      recommendedDecision: 'GENERATE_FROM_REFERENCE',
    })
  })

  it('builds one campaign payload without turning matching into approval', () => {
    const payload = buildCreativeIntelligencePayload({ posts: [imagePost], media: [media] })
    expect(payload.summary).toMatchObject({ totalAssets: 1, analyzedAssets: 1, totalPosts: 1 })
    expect(payload.matchesByPostId['post-1']).toHaveLength(1)
    expect(payload.assetsById['media-1'].id).toBe('media-1')
  })

  it('keeps final Video Studio masters out of source analysis and recursive matching', () => {
    expect(isCreativeIntelligenceSourceCandidate(media)).toBe(true)
    expect(isCreativeIntelligenceSourceCandidate({
      ...media,
      category: 'source-locked-motion-design-ad',
    })).toBe(false)
    expect(isCreativeIntelligenceSourceCandidate({
      ...media,
      tags: ['review-required', 'nexus-video-studio'],
    })).toBe(false)
  })
})
