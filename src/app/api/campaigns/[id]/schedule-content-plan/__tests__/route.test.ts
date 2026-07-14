import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getUserId: vi.fn(),
  campaignFindFirst: vi.fn(),
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
    socialPost: { findMany: mocks.socialPostFindMany, update: mocks.socialPostUpdate },
    integration: { findMany: mocks.integrationFindMany },
    postStatusHistory: { createMany: mocks.historyCreateMany },
    marketingLearningEvent: { createMany: mocks.learningCreateMany },
  },
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
  mocks.campaignFindFirst.mockResolvedValue({ id: 'campaign-1', workspaceId: 'workspace-1', status: 'ACTIVE' })
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
})
