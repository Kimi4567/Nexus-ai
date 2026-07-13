import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  update: vi.fn(),
  historyCreate: vi.fn(),
  publish: vi.fn(),
  retryable: vi.fn(),
  decrypt: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    socialPost: {
      findMany: mocks.findMany,
      count: mocks.count,
      update: mocks.update,
    },
    postStatusHistory: { create: mocks.historyCreate },
  },
}))
vi.mock('@/lib/socialPublishers', () => ({
  publishSocialPost: mocks.publish,
  isRetryableSocialPublishError: mocks.retryable,
}))
vi.mock('@/lib/tokenCrypto', () => ({ decryptToken: mocks.decrypt }))

import { GET } from '@/app/api/cron/publish/route'

const originalSecret = process.env.CRON_SECRET

function request(token = 'cron-secret') {
  return new NextRequest('http://localhost/api/cron/publish', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

function duePost() {
  return {
    id: 'post-1',
    workspaceId: 'workspace-1',
    platform: 'LINKEDIN',
    caption: 'Approved copy',
    imageUrl: 'https://cdn.example.com/approved.jpg',
    generationStatus: 'DONE',
    mediaSource: 'GENERATE',
    pageId: null,
    status: 'SCHEDULED',
    publishMode: 'AUTO',
    approvedAt: new Date(Date.now() - 60_000),
    scheduledAt: new Date(Date.now() - 1_000),
    integration: {
      accessToken: 'encrypted-token',
      accountId: 'person-1',
      config: { personId: 'person-1' },
    },
    statusHistory: [],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'cron-secret'
  mocks.findMany.mockResolvedValue([duePost()])
  mocks.count.mockResolvedValue(0)
  mocks.update.mockResolvedValue({})
  mocks.historyCreate.mockResolvedValue({})
  mocks.decrypt.mockReturnValue('plain-token')
  mocks.publish.mockResolvedValue({ platformPostId: 'urn:li:share:1' })
  mocks.retryable.mockImplementation((error: Error) => /429|rate limit/i.test(error.message))
})

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = originalSecret
})

describe('GET /api/cron/publish', () => {
  it('fails closed before querying posts', async () => {
    delete process.env.CRON_SECRET
    const response = await GET(request())
    expect(response.status).toBe(500)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it('persists PUBLISHED only after the platform adapter succeeds', async () => {
    const response = await GET(request())
    const body = await response.json()

    expect(body).toMatchObject({ ok: true, processed: 1, succeeded: 1, failed: 0 })
    expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'LINKEDIN',
      caption: 'Approved copy',
      accessToken: 'plain-token',
    }))
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      data: {
        status: 'PUBLISHED',
        publishedAt: expect.any(Date),
        platformPostId: 'urn:li:share:1',
        platformUrl: null,
        errorMessage: null,
      },
    })
  })

  it('does not call the platform adapter when media readiness is incomplete', async () => {
    mocks.findMany.mockResolvedValue([{ ...duePost(), generationStatus: 'PENDING' }])

    const response = await GET(request())
    const body = await response.json()

    expect(body).toMatchObject({ ok: true, processed: 0, succeeded: 0 })
    expect(mocks.publish).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('records provider failure without claiming publication', async () => {
    mocks.publish.mockRejectedValue(new Error('LinkedIn publish failed: permission denied'))
    const response = await GET(request())
    const body = await response.json()

    expect(body).toMatchObject({ ok: true, processed: 1, succeeded: 0, failed: 1 })
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      data: { status: 'FAILED', errorMessage: 'LinkedIn publish failed: permission denied' },
    })
  })

  it('keeps transient provider failures scheduled for a bounded retry', async () => {
    mocks.publish.mockRejectedValue(new Error('LinkedIn publish failed: HTTP 429 rate limit'))
    const response = await GET(request())
    const body = await response.json()

    expect(body).toMatchObject({
      ok: true,
      processed: 1,
      succeeded: 0,
      failed: 0,
      retriesScheduled: 1,
    })
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      data: { errorMessage: 'LinkedIn publish failed: HTTP 429 rate limit' },
    })
    expect(mocks.historyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        socialPostId: 'post-1',
        fromStatus: 'SCHEDULED',
        toStatus: 'SCHEDULED',
        actor: 'CRON',
        note: expect.stringContaining('[PUBLISH_RETRY]'),
      }),
    })
  })
})
