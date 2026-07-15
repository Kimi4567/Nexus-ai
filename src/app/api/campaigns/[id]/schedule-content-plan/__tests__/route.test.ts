import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getUserId: vi.fn(),
  campaignFindFirst: vi.fn(),
  brandProfileFindUnique: vi.fn(),
  reviewStrategyGrounding: vi.fn(),
  socialPostFindMany: vi.fn(),
  socialPostUpdate: vi.fn(),
  integrationFindMany: vi.fn(),
  historyCreateMany: vi.fn(),
  learningCreateMany: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.getUserId }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    campaign: { findFirst: mocks.campaignFindFirst },
    brandProfile: { findUnique: mocks.brandProfileFindUnique },
    socialPost: { findMany: mocks.socialPostFindMany, update: mocks.socialPostUpdate },
    integration: { findMany: mocks.integrationFindMany },
    postStatusHistory: { createMany: mocks.historyCreateMany },
    marketingLearningEvent: { createMany: mocks.learningCreateMany },
  },
}))
vi.mock('@/lib/ai/marketingQualityGate', () => ({
  reviewStrategyGrounding: mocks.reviewStrategyGrounding,
}))

import { POST } from '@/app/api/campaigns/[id]/schedule-content-plan/route'

const uploadScope = 'https://www.googleapis.com/auth/youtube.upload'
const readScope = 'https://www.googleapis.com/auth/youtube.readonly'

function request() {
  return new NextRequest('http://localhost/api/campaigns/campaign-1/schedule-content-plan', {
    method: 'POST',
    headers: { Authorization: 'Bearer session', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publishMode: 'AUTO',
      explicitAutoPublishConfirmed: true,
      destinationByTarget: { YOUTUBE: { integrationId: 'youtube-integration' } },
      youtubeOptionsByPostId: {
        'youtube-post': {
          title: 'A specific workflow walkthrough',
          privacyStatus: 'private',
          selfDeclaredMadeForKids: false,
          containsSyntheticMedia: false,
          notifySubscribers: false,
          categoryId: '22',
        },
      },
    }),
  })
}

function xRequest() {
  return new NextRequest('http://localhost/api/campaigns/campaign-1/schedule-content-plan', {
    method: 'POST',
    headers: { Authorization: 'Bearer session', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publishMode: 'AUTO',
      explicitAutoPublishConfirmed: true,
      destinationByTarget: { X: { integrationId: 'x-integration' } },
    }),
  })
}

function pinterestRequest() {
  return new NextRequest('http://localhost/api/campaigns/campaign-1/schedule-content-plan', {
    method: 'POST',
    headers: { Authorization: 'Bearer session', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publishMode: 'AUTO',
      explicitAutoPublishConfirmed: true,
      destinationByTarget: { PINTEREST: { integrationId: 'pinterest-integration' } },
      pinterestOptionsByPostId: {
        'pinterest-post': {
          boardId: '12345',
          title: 'Reviewed campaign Pin',
          altText: 'The approved product shown in the campaign creative.',
          destinationLink: 'https://example.com/offer',
          aiDisclosureReviewed: true,
          aiDisclosureValues: ['AI_MODIFIED'],
        },
      },
    }),
  })
}

function threadsRequest() {
  return new NextRequest('http://localhost/api/campaigns/campaign-1/schedule-content-plan', {
    method: 'POST',
    headers: { Authorization: 'Bearer session', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publishMode: 'AUTO',
      explicitAutoPublishConfirmed: true,
      destinationByTarget: { THREADS: { integrationId: 'threads-integration' } },
      threadsOptionsByPostId: {
        'threads-post': { replyControl: 'everyone', altText: 'The approved campaign product visual.' },
      },
    }),
  })
}

function approvedYouTubePost() {
  return {
    id: 'youtube-post',
    platform: 'YOUTUBE',
    publishTarget: 'YOUTUBE_SHORTS',
    integrationId: null,
    scheduledAt: new Date(Date.now() + 60_000),
    caption: 'See how the approved workflow moves from review to a measured publishing decision.',
    imagePrompt: null,
    videoPrompt: 'Show the review screen, the approval decision, and the final verified state.',
    imageUrl: 'https://res.cloudinary.com/demo/video/upload/workflow.mp4',
    uploadedMediaId: 'media-1',
    mediaSource: 'UPLOAD',
    generationStatus: 'DONE',
    isVideoPost: true,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUserId.mockResolvedValue('user-1')
  mocks.campaignFindFirst.mockResolvedValue({
    id: 'campaign-1', workspaceId: 'workspace-1', status: 'ACTIVE',
    aiOutput: {
      strategy: { positioning: 'Reviewed offer for the saved audience' },
      qualityGate: { schemaVersion: 1, status: 'passed', blockers: [] },
      sentinelReview: { status: 'passed' },
    },
    goal: 'LEADS', platforms: ['YOUTUBE_SHORTS'],
  })
  mocks.brandProfileFindUnique.mockResolvedValue({
    workspaceId: 'workspace-1', brandName: 'Reviewed Brand', industry: 'Education',
    primaryOffer: 'A reviewed learning offer', targetAudience: 'Professional learners',
  })
  mocks.reviewStrategyGrounding.mockReturnValue({
    schemaVersion: 1, status: 'passed', score: 100, blockers: [], warnings: [], checkedAt: '2026-07-14T00:00:00.000Z',
  })
  mocks.socialPostFindMany.mockResolvedValue([approvedYouTubePost()])
  mocks.socialPostUpdate.mockResolvedValue({})
  mocks.historyCreateMany.mockResolvedValue({ count: 1 })
  mocks.learningCreateMany.mockResolvedValue({ count: 1 })
  mocks.integrationFindMany.mockResolvedValue([{
    id: 'youtube-integration',
    type: 'YOUTUBE',
    accountId: 'channel-1',
    accountName: 'NEXUS Channel',
    accessToken: 'encrypted-access',
    refreshToken: 'encrypted-refresh',
    config: { scopeEvidence: 'provider_response', scopes: [uploadScope, readScope] },
  }])
})

describe('POST schedule-content-plan — YouTube', () => {
  it('blocks scheduling when the current Brand Brain no longer grounds the strategy', async () => {
    mocks.reviewStrategyGrounding.mockReturnValue({
      schemaVersion: 1,
      status: 'blocked',
      score: 70,
      blockers: [{ code: 'strategy_missing_brand_relevance', severity: 'blocker', path: 'strategy', message: 'Drifted.' }],
      warnings: [],
      checkedAt: '2026-07-14T00:00:00.000Z',
    })

    const response = await POST(request(), { params: Promise.resolve({ id: 'campaign-1' }) })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('MARKETING_QUALITY_GATE_FAILED')
    expect(mocks.socialPostUpdate).not.toHaveBeenCalled()
  })

  it('normalizes YouTube Shorts and persists reviewed per-video settings', async () => {
    const response = await POST(request(), { params: Promise.resolve({ id: 'campaign-1' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ success: true, scheduled: 1, linked: 1, publishMode: 'AUTO' })
    expect(mocks.socialPostUpdate).toHaveBeenCalledWith({
      where: { id: 'youtube-post' },
      data: expect.objectContaining({
        status: 'SCHEDULED',
        publishMode: 'AUTO',
        integrationId: 'youtube-integration',
        publishTarget: 'YOUTUBE',
        platformOptions: {
          title: 'A specific workflow walkthrough',
          privacyStatus: 'private',
          selfDeclaredMadeForKids: false,
          containsSyntheticMedia: false,
          notifySubscribers: false,
          categoryId: '22',
          explicitConsent: true,
        },
      }),
    })
  })

  it('fails closed when YouTube status readback permission is not provider-verified', async () => {
    mocks.integrationFindMany.mockResolvedValue([{
      id: 'youtube-integration',
      type: 'YOUTUBE',
      accountId: 'channel-1',
      accessToken: 'encrypted-access',
      refreshToken: 'encrypted-refresh',
      config: { scopeEvidence: 'provider_response', scopes: [uploadScope] },
    }])

    const response = await POST(request(), { params: Promise.resolve({ id: 'campaign-1' }) })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('AUTO_PUBLISH_READINESS_REQUIRED')
    expect(body.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'PLATFORM_SCOPE_REQUIRED', target: 'YOUTUBE' }),
    ]))
    expect(mocks.socialPostUpdate).not.toHaveBeenCalled()
  })

  it('normalizes legacy Twitter posts and schedules X only with complete verified permissions', async () => {
    mocks.socialPostFindMany.mockResolvedValue([{
      id: 'x-post',
      platform: 'X',
      publishTarget: 'TWITTER',
      integrationId: null,
      scheduledAt: new Date(Date.now() + 60_000),
      caption: 'A reviewed X post announcing the approved July product workflow.',
      imagePrompt: 'Approved product workflow image',
      videoPrompt: null,
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/x-post.png',
      uploadedMediaId: 'media-x',
      mediaSource: 'UPLOAD',
      generationStatus: 'DONE',
      isVideoPost: false,
    }])
    mocks.integrationFindMany.mockResolvedValue([{
      id: 'x-integration',
      type: 'X',
      accountId: 'x-user-1',
      accountName: 'NEXUS on X',
      accessToken: 'encrypted-access',
      refreshToken: 'encrypted-refresh',
      config: {
        scopeEvidence: 'provider_response',
        scopes: ['tweet.read', 'tweet.write', 'users.read', 'media.write', 'offline.access'],
      },
    }])

    const response = await POST(xRequest(), { params: Promise.resolve({ id: 'campaign-1' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ success: true, scheduled: 1, linked: 1, publishMode: 'AUTO' })
    expect(mocks.socialPostUpdate).toHaveBeenCalledWith({
      where: { id: 'x-post' },
      data: expect.objectContaining({
        status: 'SCHEDULED',
        publishMode: 'AUTO',
        integrationId: 'x-integration',
        publishTarget: 'X',
        platformOptions: { explicitConsent: true },
      }),
    })
  })

  it('schedules Pinterest only with Standard access, an exact Board, review, and continuous refresh', async () => {
    mocks.socialPostFindMany.mockResolvedValue([{
      id: 'pinterest-post',
      platform: 'PINTEREST',
      publishTarget: 'PINTEREST',
      integrationId: null,
      scheduledAt: new Date(Date.now() + 60_000),
      caption: 'A reviewed Pinterest description tied to the approved campaign offer.',
      imagePrompt: 'Approved product image',
      videoPrompt: null,
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/pin.jpg',
      uploadedMediaId: 'media-pin',
      mediaSource: 'UPLOAD',
      generationStatus: 'DONE',
      isVideoPost: false,
    }])
    mocks.integrationFindMany.mockResolvedValue([{
      id: 'pinterest-integration',
      type: 'PINTEREST',
      accountId: 'pinterest-user-1',
      accountName: 'NEXUS Pinterest',
      accessToken: 'encrypted-access',
      refreshToken: 'encrypted-refresh',
      config: {
        accessTier: 'STANDARD',
        boards: [{ id: '12345', name: 'Launches' }],
        scopeEvidence: 'provider_response',
        scopes: ['boards:read', 'boards:write', 'pins:read', 'pins:write'],
      },
    }])

    const response = await POST(pinterestRequest(), { params: Promise.resolve({ id: 'campaign-1' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ success: true, scheduled: 1, linked: 1, publishMode: 'AUTO' })
    expect(mocks.socialPostUpdate).toHaveBeenCalledWith({
      where: { id: 'pinterest-post' },
      data: expect.objectContaining({
        integrationId: 'pinterest-integration',
        pageId: '12345',
        pageName: 'Launches',
        publishTarget: 'PINTEREST',
        platformOptions: {
          boardId: '12345',
          title: 'Reviewed campaign Pin',
          altText: 'The approved product shown in the campaign creative.',
          destinationLink: 'https://example.com/offer',
          aiDisclosureReviewed: true,
          aiDisclosureValues: ['AI_MODIFIED'],
          explicitConsent: true,
        },
      }),
    })
  })

  it('blocks Pinterest Trial from claiming public scheduled publishing readiness', async () => {
    mocks.socialPostFindMany.mockResolvedValue([{
      id: 'pinterest-post', platform: 'PINTEREST', publishTarget: 'PINTEREST', integrationId: null,
      scheduledAt: new Date(Date.now() + 60_000), caption: 'A reviewed Pinterest campaign description.',
      imagePrompt: 'Approved image', videoPrompt: null,
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/pin.jpg', uploadedMediaId: 'media-pin',
      mediaSource: 'UPLOAD', generationStatus: 'DONE', isVideoPost: false,
    }])
    mocks.integrationFindMany.mockResolvedValue([{
      id: 'pinterest-integration', type: 'PINTEREST', accountId: 'user-1', accessToken: 'encrypted', refreshToken: 'refresh',
      config: { accessTier: 'TRIAL', boards: [{ id: '12345', name: 'Launches' }], scopeEvidence: 'provider_response', scopes: ['boards:read', 'boards:write', 'pins:read', 'pins:write'] },
    }])

    const response = await POST(pinterestRequest(), { params: Promise.resolve({ id: 'campaign-1' }) })
    const body = await response.json()
    expect(response.status).toBe(409)
    expect(body.blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'PINTEREST_STANDARD_ACCESS_REQUIRED' })]))
  })

  it('schedules Threads only with Live access, verified operational scopes, and reviewed settings', async () => {
    mocks.socialPostFindMany.mockResolvedValue([{
      id: 'threads-post', platform: 'THREADS', publishTarget: 'THREADS', integrationId: null,
      scheduledAt: new Date(Date.now() + 60_000), caption: 'A reviewed Threads launch message tied to the approved offer.',
      imagePrompt: 'Approved product image', videoPrompt: null,
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/thread.jpg', uploadedMediaId: 'media-thread',
      mediaSource: 'UPLOAD', generationStatus: 'DONE', isVideoPost: false,
    }])
    mocks.integrationFindMany.mockResolvedValue([{
      id: 'threads-integration', type: 'THREADS', accountId: 'threads-user-1', accountName: 'NEXUS Threads',
      accessToken: 'encrypted-access', refreshToken: null,
      config: {
        accessTier: 'LIVE', scopeEvidence: 'provider_response',
        scopes: ['threads_basic', 'threads_content_publish', 'threads_manage_insights'],
      },
    }])

    const response = await POST(threadsRequest(), { params: Promise.resolve({ id: 'campaign-1' }) })
    expect(response.status).toBe(200)
    expect(mocks.socialPostUpdate).toHaveBeenCalledWith({
      where: { id: 'threads-post' },
      data: expect.objectContaining({
        integrationId: 'threads-integration', publishTarget: 'THREADS', pageId: null,
        platformOptions: {
          replyControl: 'everyone', altText: 'The approved campaign product visual.', explicitConsent: true,
        },
      }),
    })
  })

  it('blocks Threads Development mode from claiming public scheduled readiness', async () => {
    mocks.socialPostFindMany.mockResolvedValue([{
      id: 'threads-post', platform: 'THREADS', publishTarget: 'THREADS', integrationId: null,
      scheduledAt: new Date(Date.now() + 60_000), caption: 'A reviewed Threads campaign message.',
      imagePrompt: 'Approved image', videoPrompt: null,
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/thread.jpg', uploadedMediaId: 'media-thread',
      mediaSource: 'UPLOAD', generationStatus: 'DONE', isVideoPost: false,
    }])
    mocks.integrationFindMany.mockResolvedValue([{
      id: 'threads-integration', type: 'THREADS', accountId: 'threads-user-1', accessToken: 'encrypted', refreshToken: null,
      config: { accessTier: 'DEVELOPMENT', scopeEvidence: 'provider_response', scopes: ['threads_basic', 'threads_content_publish', 'threads_manage_insights'] },
    }])

    const response = await POST(threadsRequest(), { params: Promise.resolve({ id: 'campaign-1' }) })
    const body = await response.json()
    expect(response.status).toBe(409)
    expect(body.blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'THREADS_LIVE_ACCESS_REQUIRED' })]))
  })
})
