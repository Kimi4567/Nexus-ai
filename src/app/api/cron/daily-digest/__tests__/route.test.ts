import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  postFindMany: vi.fn(),
  campaignFindMany: vi.fn(),
  send: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    socialPost: { findMany: mocks.postFindMany },
    campaign: { findMany: mocks.campaignFindMany },
  },
}))
vi.mock('@/lib/email/resend', () => ({ sendDailyDigest: mocks.send }))

import { GET } from '@/app/api/cron/daily-digest/route'

const originalSecret = process.env.CRON_SECRET
const originalResend = process.env.RESEND_API_KEY

function request(token = 'cron-secret') {
  return new NextRequest('http://localhost/api/cron/daily-digest', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'cron-secret'
  process.env.RESEND_API_KEY = 'resend-key'
  mocks.postFindMany.mockResolvedValue([{
    id: 'post-1', workspaceId: 'workspace-1', campaignId: 'campaign-1',
    caption: 'Approved caption', platform: 'META', pageName: 'Page',
    scheduledAt: new Date(), workspace: { owner: { email: 'owner@example.com', name: 'Owner' } },
  }])
  mocks.campaignFindMany.mockResolvedValue([{ id: 'campaign-1', name: 'Campaign' }])
  mocks.send.mockResolvedValue({})
})

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = originalSecret
  if (originalResend === undefined) delete process.env.RESEND_API_KEY
  else process.env.RESEND_API_KEY = originalResend
})

describe('GET /api/cron/daily-digest', () => {
  it('queries only approved, scheduled posts for the current day', async () => {
    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ source: 'approved-scheduled-posts', draftsIncluded: false, sent: 1 })
    expect(mocks.postFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        status: 'SCHEDULED',
        approvedAt: { not: null },
        scheduledAt: { gte: expect.any(Date), lt: expect.any(Date) },
      },
    }))
    expect(mocks.send).toHaveBeenCalledWith('owner@example.com', expect.objectContaining({
      caption: 'Approved caption',
      type: 'Approved scheduled post',
    }))
  })

  it('fails closed before loading posts', async () => {
    delete process.env.CRON_SECRET
    const response = await GET(request())
    expect(response.status).toBe(500)
    expect(mocks.postFindMany).not.toHaveBeenCalled()
  })
})
