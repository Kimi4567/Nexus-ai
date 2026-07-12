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
}))

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
    config: { pages: [{ id: 'page-1', name: 'Page', accessToken: 'page-encrypted' }] },
  })
  mocks.campaignFindFirst.mockResolvedValue({ id: 'campaign-1' })
  mocks.decrypt.mockReturnValue('plain-token')
  mocks.publish.mockResolvedValue({ platformPostId: 'page_post_1', platformUrl: 'https://facebook.com/page_post_1' })
  mocks.socialPostCreate.mockResolvedValue({ id: 'post-1', status: 'PUBLISHED' })
  mocks.socialPostUpdate.mockResolvedValue({ id: 'approved-post-1', status: 'PUBLISHED' })
})

describe('POST /api/social/publish', () => {
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
    expect(mocks.campaignFindFirst).toHaveBeenCalledWith({
      where: { id: 'campaign-1', workspaceId: 'workspace-1' },
      select: { id: true },
    })
  })

  it('records provider-confirmed publication and its user audit event', async () => {
    await POST(request(validBody))
    expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'FACEBOOK',
      accessToken: 'plain-token',
      pageId: 'page-1',
    }))
    expect(mocks.socialPostCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'workspace-1',
        status: 'PUBLISHED',
        platformPostId: 'page_post_1',
        publishMode: 'MANUAL',
        statusHistory: {
          create: expect.objectContaining({
            actor: 'USER',
            toStatus: 'PUBLISHED',
          }),
        },
      }),
    })
  })

  it('records a failed attempt without claiming publication', async () => {
    mocks.publish.mockRejectedValue(new Error('Facebook publish failed: permission denied'))
    mocks.socialPostCreate.mockResolvedValue({ id: 'post-failed', status: 'FAILED' })
    const response = await POST(request(validBody))
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.socialPost.status).toBe('FAILED')
    expect(mocks.socialPostCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'FAILED',
        platformPostId: null,
        publishedAt: null,
      }),
    })
  })

  it('returns a reconciliation contract if the provider succeeds but DB persistence fails', async () => {
    mocks.socialPostCreate.mockRejectedValue(new Error('database unavailable'))
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
})
