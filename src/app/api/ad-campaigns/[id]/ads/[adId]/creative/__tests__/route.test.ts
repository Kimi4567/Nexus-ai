import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetAuthUser, mockPrisma } = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockPrisma: {
    ad: { findFirst: vi.fn(), update: vi.fn() },
    media: { findFirst: vi.fn() },
    generatedVisual: { findFirst: vi.fn() },
  },
}))

vi.mock('@/lib/apiAuth', () => ({ getAuthUser: mockGetAuthUser }))
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

import { PATCH } from '../route'

const params = { params: Promise.resolve({ id: 'campaign_1', adId: 'ad_1' }) }
const makeReq = (body: unknown) => ({ json: async () => body }) as any
const safeMedia = {
  id: 'media_1',
  type: 'IMAGE',
  mimeType: 'image/jpeg',
  url: 'https://res.cloudinary.com/nexus/image/upload/ad.jpg',
  size: 1_000_000,
  width: 1080,
  height: 1080,
  fileName: 'ad.jpg',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetAuthUser.mockResolvedValue({ id: 'user_1' })
  mockPrisma.ad.findFirst.mockResolvedValue({ id: 'ad_1', platformAdId: null, platformCreativeId: null })
  mockPrisma.media.findFirst.mockResolvedValue(safeMedia)
  mockPrisma.ad.update.mockResolvedValue({ id: 'ad_1', imageUrl: safeMedia.url, specsValidated: true })
})

describe('PATCH paid ad creative attachment', () => {
  it('requires both explicit confirmations before any lookup or mutation', async () => {
    const response = await PATCH(makeReq({ mediaId: 'media_1' }), params)

    expect(response.status).toBe(400)
    expect(mockPrisma.ad.findFirst).not.toHaveBeenCalled()
    expect(mockPrisma.ad.update).not.toHaveBeenCalled()
  })

  it('blocks local overwrite after a platform creative exists', async () => {
    mockPrisma.ad.findFirst.mockResolvedValue({ id: 'ad_1', platformAdId: 'platform_ad', platformCreativeId: 'creative_1' })

    const response = await PATCH(makeReq({
      mediaId: 'media_1',
      explicitCreativeAttachConfirmed: true,
      reviewedAssetRightsConfirmed: true,
    }), params)

    expect(response.status).toBe(409)
    expect(mockPrisma.media.findFirst).not.toHaveBeenCalled()
    expect(mockPrisma.ad.update).not.toHaveBeenCalled()
  })

  it('rejects assets that are not owned by the workspace', async () => {
    mockPrisma.media.findFirst.mockResolvedValue(null)

    const response = await PATCH(makeReq({
      mediaId: 'foreign_media',
      explicitCreativeAttachConfirmed: true,
      reviewedAssetRightsConfirmed: true,
    }), params)

    expect(response.status).toBe(404)
    expect(mockPrisma.media.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'foreign_media', workspace: { ownerId: 'user_1' } },
    }))
    expect(mockPrisma.ad.update).not.toHaveBeenCalled()
  })

  it('attaches a validated image to the local draft without platform or credit mutation', async () => {
    const response = await PATCH(makeReq({
      mediaId: 'media_1',
      explicitCreativeAttachConfirmed: true,
      reviewedAssetRightsConfirmed: true,
    }), params)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mockPrisma.ad.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ad_1' },
      data: expect.objectContaining({
        imageUrl: safeMedia.url,
        format: 'SINGLE_IMAGE',
        specsValidated: true,
        specsErrors: [],
        reviewStatus: null,
      }),
    }))
    expect(body).toMatchObject({ attached: true, draftOnly: true, platformMutation: false, creditsUsed: 0 })
  })

  it('accepts a campaign-owned generated visual only after its deterministic quality gate passed', async () => {
    mockPrisma.ad.findFirst.mockResolvedValue({
      id: 'ad_1',
      platformAdId: null,
      platformCreativeId: null,
      adSet: { adCampaign: { workspaceId: 'workspace_1', organicCampaignId: 'organic_1' } },
    })
    mockPrisma.generatedVisual.findFirst.mockResolvedValue({
      id: 'visual_1',
      imageUrl: safeMedia.url,
      campaignName: 'Launch',
      visualType: 'AD_CREATIVE',
      qualityReview: {
        passed: true,
        qualityStatus: 'PASSED',
        reviewedAt: '2026-07-19T00:00:00.000Z',
        semanticAlignmentScore: 94,
        professionalQualityScore: 93,
        technicalIntegrity: true,
        noNewRasterText: true,
        noInventedClaims: true,
        formatValidation: {
          passed: true,
          width: 1080,
          height: 1350,
          contentType: 'image/jpeg',
        },
      },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-length': '1000000' }),
    }))

    const response = await PATCH(makeReq({
      mediaId: 'generated:visual_1',
      explicitCreativeAttachConfirmed: true,
      reviewedAssetRightsConfirmed: true,
    }), params)

    expect(response.status).toBe(200)
    expect(mockPrisma.media.findFirst).not.toHaveBeenCalled()
    expect(mockPrisma.generatedVisual.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'visual_1',
        workspaceId: 'workspace_1',
        qualityStatus: 'PASSED',
      }),
    }))
    expect(mockPrisma.ad.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        imageUrl: safeMedia.url,
        specsValidated: true,
        creativeSpecs: expect.objectContaining({
          sourceType: 'NEXUS_GENERATED_VISUAL',
          sourceGeneratedVisualId: 'visual_1',
          generatedQualityGate: 'PREMIUM_STATIC_AD_PASSED',
        }),
      }),
    }))
    vi.unstubAllGlobals()
  })
})
