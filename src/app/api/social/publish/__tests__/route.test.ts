import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getUserId: vi.fn(),
  workspaceFindFirst: vi.fn(),
  integrationFindFirst: vi.fn(),
  campaignFindFirst: vi.fn(),
  socialPostFindFirst: vi.fn(),
  socialPostCreate: vi.fn(),
  socialPostUpdate: vi.fn(),
  postStatusHistoryCreate: vi.fn(),
  learningEventCreate: vi.fn(),
  decrypt: vi.fn(),
  publish: vi.fn(),
  reviewStrategyGrounding: vi.fn(),
}))
vi.mock('@/lib/ai/marketingQualityGate', () => ({ reviewStrategyGrounding: mocks.reviewStrategyGrounding }))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.getUserId }))
vi.mock('@/lib/tokenCrypto', () => ({ decryptToken: mocks.decrypt }))
vi.mock('@/lib/socialPublishers', () => ({ publishSocialPost: mocks.publish }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: { findFirst: mocks.workspaceFindFirst },
    integration: { findFirst: mocks.integrationFindFirst },
    campaign: { findFirst: mocks.campaignFindFirst },
    socialPost: { findFirst: mocks.socialPostFindFirst, create: mocks.socialPostCreate },
    $transaction: (callback: (tx: unknown) => unknown) => callback({
      socialPost: { update: mocks.socialPostUpdate },
      postStatusHistory: { create: mocks.postStatusHistoryCreate },
      marketingLearningEvent: { create: mocks.learningEventCreate },
    }),
  },
}))

import { POST } from '@/app/api/social/publish/route'

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/social/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer session' },
    body: JSON.stringify(body),
  })
}

const validBody = {
  socialPostId: 'approved-post-1',
  integrationId: 'integration-1',
  pageId: 'page-1',
  pageName: 'Page',
  caption: 'Explicitly approved post',
  platform: 'FACEBOOK',
  campaignId: 'campaign-1',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUserId.mockResolvedValue('user-1')
  mocks.workspaceFindFirst.mockResolvedValue({ id: 'workspace-1' })
  mocks.integrationFindFirst.mockResolvedValue({
    id: 'integration-1',
    type: 'META',
    status: 'CONNECTED',
    accessToken: 'encrypted',
    accountId: 'account-1',
    accountName: 'Account',
    config: {
      scopeEvidence: 'provider_response',
      scopes: ['pages_manage_posts'],
      pages: [{ id: 'page-1', name: 'Page', accessToken: 'page-encrypted' }],
    },
  })
  mocks.campaignFindFirst.mockResolvedValue({
    id: 'campaign-1', aiOutput: { strategy: { positioning: 'Reviewed campaign offer' } },
    goal: 'LEADS', platforms: ['FACEBOOK', 'INSTAGRAM', 'YOUTUBE', 'X', 'PINTEREST', 'THREADS'],
    workspace: {
      brandProfile: {
        brandName: 'Reviewed Brand', industry: 'Services', primaryOffer: 'Reviewed service',
        targetAudience: 'Business buyers',
      },
    },
  })
  mocks.reviewStrategyGrounding.mockReturnValue({
    schemaVersion: 1, status: 'passed', score: 100, blockers: [], warnings: [], checkedAt: '2026-07-14T00:00:00.000Z',
  })
  mocks.decrypt.mockReturnValue('plain-token')
  mocks.publish.mockResolvedValue({ platformPostId: 'page_post_1', platformUrl: 'https://facebook.com/page_post_1' })
  mocks.socialPostFindFirst.mockResolvedValue({
    id: 'approved-post-1',
    campaignId: 'campaign-1',
    platform: 'META',
    status: 'APPROVED',
    caption: 'Saved approved caption',
    imageUrl: 'https://cdn.example.com/approved.jpg',
    uploadedMediaId: null,
    mediaSource: 'GENERATE',
    generationStatus: 'DONE',
    approvedAt: new Date('2026-07-12T10:00:00.000Z'),
  })
  mocks.socialPostUpdate.mockResolvedValue({ id: 'approved-post-1', status: 'PUBLISHED' })
})

describe('POST /api/social/publish', () => {
  it('rejects free-form publishing that does not reference Content Hub', async () => {
    const response = await POST(request({ ...validBody, socialPostId: undefined }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.code).toBe('CONTENT_HUB_POST_REQUIRED')
    expect(mocks.publish).not.toHaveBeenCalled()
  })

  it('blocks publishing until saved post media is confirmed ready', async () => {
    mocks.socialPostFindFirst.mockResolvedValue({
      id: 'approved-post-1',
      campaignId: 'campaign-1',
      platform: 'META',
      status: 'APPROVED',
      caption: 'Saved approved caption',
      imageUrl: null,
      uploadedMediaId: null,
      mediaSource: 'GENERATE',
      generationStatus: 'PENDING',
      approvedAt: new Date('2026-07-12T10:00:00.000Z'),
    })

    const response = await POST(request(validBody))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('MEDIA_REVIEW_REQUIRED')
    expect(mocks.publish).not.toHaveBeenCalled()
  })

  it('blocks generic legacy copy even when the post was approved previously', async () => {
    mocks.socialPostFindFirst.mockResolvedValue({
      id: 'approved-post-1',
      campaignId: 'campaign-1',
      platform: 'META',
      status: 'APPROVED',
      caption: 'هل تعلم أن التسويق الذكي يمكن أن يغير مسار شركتك؟',
      imagePrompt: 'Abstract marketing image',
      imageUrl: 'https://cdn.example.com/approved.jpg',
      uploadedMediaId: null,
      mediaSource: 'GENERATE',
      generationStatus: 'DONE',
      approvedAt: new Date('2026-07-12T10:00:00.000Z'),
    })

    const response = await POST(request(validBody))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('CONTENT_REVIEW_REQUIRED')
    expect(body.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'generic_hook_formula' }),
    ]))
    expect(mocks.publish).not.toHaveBeenCalled()
  })

  it('scopes integration and campaign lookup to the authenticated workspace', async () => {
    const response = await POST(request(validBody))
    expect(response.status).toBe(200)
    expect(mocks.integrationFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'integration-1',
        workspaceId: 'workspace-1',
        status: 'CONNECTED',
        type: 'META',
      },
    })
    expect(mocks.campaignFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'campaign-1', workspaceId: 'workspace-1' },
      select: expect.objectContaining({ id: true, aiOutput: true, goal: true, platforms: true }),
    }))
  })

  it('blocks provider delivery when the current Brand Brain no longer grounds the strategy', async () => {
    mocks.reviewStrategyGrounding.mockReturnValue({
      schemaVersion: 1,
      status: 'blocked',
      score: 70,
      blockers: [{ code: 'strategy_missing_brand_relevance', severity: 'blocker', path: 'strategy', message: 'Drifted.' }],
      warnings: [],
      checkedAt: '2026-07-14T00:00:00.000Z',
    })

    const response = await POST(request(validBody))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('MARKETING_QUALITY_GATE_FAILED')
    expect(mocks.publish).not.toHaveBeenCalled()
  })

  it('records provider-confirmed publication and its user audit event', async () => {
    await POST(request(validBody))
    expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'FACEBOOK',
      accessToken: 'plain-token',
      pageId: 'page-1',
    }))
    expect(mocks.socialPostUpdate).toHaveBeenCalledWith({
      where: { id: 'approved-post-1' },
      data: expect.objectContaining({
        status: 'PUBLISHED',
        platformPostId: 'page_post_1',
        publishMode: 'AUTO',
      }),
    })
    expect(mocks.postStatusHistoryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ actor: 'USER', toStatus: 'PUBLISHED' }),
    })
  })

  it('records a failed attempt without claiming publication', async () => {
    mocks.publish.mockRejectedValue(new Error('Facebook publish failed: permission denied'))
    mocks.socialPostUpdate.mockResolvedValue({ id: 'approved-post-1', status: 'FAILED' })
    const response = await POST(request(validBody))
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.socialPost.status).toBe('FAILED')
    expect(mocks.socialPostUpdate).toHaveBeenCalledWith({
      where: { id: 'approved-post-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        platformPostId: null,
        publishedAt: null,
      }),
    })
  })

  it('returns a reconciliation contract if the provider succeeds but DB persistence fails', async () => {
    mocks.socialPostUpdate.mockRejectedValue(new Error('database unavailable'))
    const response = await POST(request(validBody))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toMatchObject({
      reconciliationRequired: true,
      platformPostId: 'page_post_1',
    })
  })

  it('publishes the saved approved Content Hub post without creating a duplicate row', async () => {
    mocks.socialPostFindFirst.mockResolvedValue({
      id: 'approved-post-1',
      campaignId: 'campaign-1',
      platform: 'META',
      status: 'APPROVED',
      caption: 'Saved approved caption',
      imageUrl: 'https://cdn.example.com/approved.jpg',
      uploadedMediaId: null,
      mediaSource: 'GENERATE',
      generationStatus: 'DONE',
      approvedAt: new Date('2026-07-12T10:00:00.000Z'),
    })

    const response = await POST(request({
      ...validBody,
      socialPostId: 'approved-post-1',
      caption: 'Browser-tampered caption',
    }))

    expect(response.status).toBe(200)
    expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({
      caption: 'Saved approved caption',
      imageUrl: 'https://cdn.example.com/approved.jpg',
    }))
    expect(mocks.socialPostCreate).not.toHaveBeenCalled()
    expect(mocks.socialPostUpdate).toHaveBeenCalledWith({
      where: { id: 'approved-post-1' },
      data: expect.objectContaining({
        status: 'PUBLISHED',
        platformPostId: 'page_post_1',
      }),
    })
    expect(mocks.learningEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'POST_API_PUBLISHED',
        source: 'CONTENT_HUB',
        actor: 'USER',
      }),
    })
  })

  it('keeps a YouTube upload processing until provider reconciliation succeeds', async () => {
    mocks.integrationFindFirst.mockResolvedValue({
      id: 'youtube-integration',
      type: 'YOUTUBE',
      status: 'CONNECTED',
      accessToken: 'encrypted-youtube-token',
      accountId: 'channel-1',
      accountName: 'NEXUS Channel',
      config: {
        scopeEvidence: 'provider_response',
        scopes: ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'],
      },
    })
    mocks.socialPostFindFirst.mockResolvedValue({
      id: 'youtube-post',
      campaignId: 'campaign-1',
      platform: 'YOUTUBE',
      publishTarget: 'YOUTUBE_SHORTS',
      status: 'APPROVED',
      caption: 'A reviewed walkthrough of the approved product workflow.',
      imageUrl: 'https://res.cloudinary.com/demo/video/upload/short.mp4',
      uploadedMediaId: 'media-1',
      mediaSource: 'UPLOAD',
      generationStatus: 'DONE',
      isVideoPost: true,
      approvedAt: new Date('2026-07-12T10:00:00.000Z'),
    })
    mocks.publish.mockResolvedValue({
      platformPostId: 'youtube-video-1',
      platformUrl: 'https://www.youtube.com/watch?v=youtube-video-1',
      state: 'PROCESSING',
    })
    mocks.socialPostUpdate.mockResolvedValue({ id: 'youtube-post', status: 'PROCESSING' })

    const response = await POST(request({
      socialPostId: 'youtube-post',
      integrationId: 'youtube-integration',
      platform: 'YOUTUBE',
      campaignId: 'campaign-1',
      platformOptions: {
        title: 'Reviewed workflow walkthrough',
        privacyStatus: 'private',
        selfDeclaredMadeForKids: false,
        containsSyntheticMedia: false,
        notifySubscribers: false,
        explicitConsent: true,
      },
    }))

    expect(response.status).toBe(202)
    expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'YOUTUBE',
      imageUrl: 'https://res.cloudinary.com/demo/video/upload/short.mp4',
    }))
    expect(mocks.socialPostUpdate).toHaveBeenCalledWith({
      where: { id: 'youtube-post' },
      data: expect.objectContaining({
        platform: 'YOUTUBE',
        publishTarget: 'YOUTUBE',
        status: 'PROCESSING',
        publishedAt: null,
      }),
    })
  })

  it('publishes a saved X image post only with verified scopes and explicit consent', async () => {
    mocks.integrationFindFirst.mockResolvedValue({
      id: 'x-integration',
      type: 'X',
      status: 'CONNECTED',
      accessToken: 'encrypted-x-token',
      refreshToken: 'encrypted-refresh',
      accountId: 'x-user-1',
      accountName: 'NEXUS on X',
      config: {
        username: 'nexus',
        scopeEvidence: 'provider_response',
        scopes: ['tweet.read', 'tweet.write', 'users.read', 'media.write', 'offline.access'],
      },
    })
    mocks.socialPostFindFirst.mockResolvedValue({
      id: 'x-post',
      campaignId: 'campaign-1',
      platform: 'X',
      publishTarget: 'TWITTER',
      status: 'APPROVED',
      caption: 'A reviewed X post with a specific approved offer.',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/x-post.png',
      imagePrompt: 'Approved product image',
      videoPrompt: null,
      uploadedMediaId: 'media-x',
      mediaSource: 'UPLOAD',
      generationStatus: 'DONE',
      isVideoPost: false,
      approvedAt: new Date('2026-07-12T10:00:00.000Z'),
    })
    mocks.publish.mockResolvedValue({ platformPostId: 'x-provider-post', platformUrl: 'https://x.com/nexus/status/x-provider-post' })
    mocks.socialPostUpdate.mockResolvedValue({ id: 'x-post', status: 'PUBLISHED' })

    const response = await POST(request({
      socialPostId: 'x-post',
      integrationId: 'x-integration',
      platform: 'X',
      campaignId: 'campaign-1',
      platformOptions: { explicitConsent: true },
    }))

    expect(response.status).toBe(200)
    expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'X',
      caption: 'A reviewed X post with a specific approved offer.',
      platformOptions: { explicitConsent: true },
    }))
    expect(mocks.socialPostUpdate).toHaveBeenCalledWith({
      where: { id: 'x-post' },
      data: expect.objectContaining({ platform: 'X', publishTarget: 'X', status: 'PUBLISHED' }),
    })
  })

  it('publishes a reviewed Pinterest Pin only with Standard access and the exact Board', async () => {
    mocks.integrationFindFirst.mockResolvedValue({
      id: 'pinterest-integration',
      type: 'PINTEREST',
      status: 'CONNECTED',
      accessToken: 'encrypted-pinterest-token',
      refreshToken: 'encrypted-refresh',
      accountId: 'pinterest-user-1',
      accountName: 'NEXUS Pinterest',
      config: {
        accessTier: 'STANDARD',
        boards: [{ id: '12345', name: 'Launches' }],
        scopeEvidence: 'provider_response',
        scopes: ['boards:read', 'boards:write', 'pins:read', 'pins:write'],
      },
    })
    mocks.socialPostFindFirst.mockResolvedValue({
      id: 'pinterest-post', campaignId: 'campaign-1', platform: 'PINTEREST', publishTarget: 'PINTEREST',
      status: 'APPROVED', caption: 'A reviewed Pinterest description for the approved campaign offer.',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/pin.jpg', imagePrompt: 'Approved product image',
      videoPrompt: null, uploadedMediaId: 'media-pin', mediaSource: 'UPLOAD', generationStatus: 'DONE',
      isVideoPost: false, approvedAt: new Date('2026-07-12T10:00:00.000Z'),
    })
    mocks.publish.mockResolvedValue({ platformPostId: '998877', platformUrl: 'https://www.pinterest.com/pin/998877/' })
    mocks.socialPostUpdate.mockResolvedValue({ id: 'pinterest-post', status: 'PUBLISHED' })
    const platformOptions = {
      boardId: '12345', title: 'Reviewed campaign Pin', altText: 'The approved campaign product visual.',
      destinationLink: 'https://example.com/offer', aiDisclosureReviewed: true,
      aiDisclosureValues: [], explicitConsent: true,
    }

    const response = await POST(request({
      socialPostId: 'pinterest-post', integrationId: 'pinterest-integration', pageId: '12345',
      pageName: 'Launches', platform: 'PINTEREST', campaignId: 'campaign-1', platformOptions,
    }))

    expect(response.status).toBe(200)
    expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'PINTEREST', pageId: '12345', platformOptions,
    }))
    expect(mocks.socialPostUpdate).toHaveBeenCalledWith({
      where: { id: 'pinterest-post' },
      data: expect.objectContaining({ platform: 'PINTEREST', publishTarget: 'PINTEREST', status: 'PUBLISHED' }),
    })
  })

  it('publishes reviewed Threads copy and image only with Live access and explicit settings', async () => {
    mocks.integrationFindFirst.mockResolvedValue({
      id: 'threads-integration', type: 'THREADS', status: 'CONNECTED',
      accessToken: 'encrypted-threads-token', accountId: 'threads-user-1', accountName: 'NEXUS Threads',
      config: {
        accessTier: 'LIVE', scopeEvidence: 'provider_response',
        scopes: ['threads_basic', 'threads_content_publish', 'threads_manage_insights'],
      },
    })
    mocks.socialPostFindFirst.mockResolvedValue({
      id: 'threads-post', campaignId: 'campaign-1', platform: 'THREADS', publishTarget: 'THREADS',
      status: 'APPROVED', caption: 'A reviewed Threads launch message tied to the approved offer.',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/thread.jpg', imagePrompt: 'Approved product image',
      videoPrompt: null, uploadedMediaId: 'media-thread', mediaSource: 'UPLOAD', generationStatus: 'DONE',
      isVideoPost: false, approvedAt: new Date('2026-07-12T10:00:00.000Z'),
    })
    mocks.publish.mockResolvedValue({ platformPostId: 'thread-provider-1', platformUrl: 'https://www.threads.net/@nexus/post/abc' })
    mocks.socialPostUpdate.mockResolvedValue({ id: 'threads-post', status: 'PUBLISHED' })
    const platformOptions = {
      replyControl: 'everyone', altText: 'The approved campaign product visual.', explicitConsent: true,
    }

    const response = await POST(request({
      socialPostId: 'threads-post', integrationId: 'threads-integration', platform: 'THREADS',
      campaignId: 'campaign-1', platformOptions,
    }))

    expect(response.status).toBe(200)
    expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({ platform: 'THREADS', platformOptions }))
    expect(mocks.socialPostUpdate).toHaveBeenCalledWith({
      where: { id: 'threads-post' },
      data: expect.objectContaining({ platform: 'THREADS', publishTarget: 'THREADS', status: 'PUBLISHED' }),
    })
  })
})
