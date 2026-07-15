import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getServerUserId: vi.fn(),
  workspaceFindFirst: vi.fn(),
  historyFindMany: vi.fn(),
  campaignFindMany: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.getServerUserId }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: { findFirst: mocks.workspaceFindFirst },
    postStatusHistory: { findMany: mocks.historyFindMany },
    campaign: { findMany: mocks.campaignFindMany },
  },
}))

import { GET } from '@/app/api/approvals/content-ledger/route'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getServerUserId.mockResolvedValue('u1')
  mocks.workspaceFindFirst.mockResolvedValue({ id: 'w1' })
  mocks.historyFindMany.mockResolvedValue([{
    id: 'h1',
    socialPostId: 'p1',
    fromStatus: 'APPROVED',
    toStatus: 'SCHEDULED',
    actor: 'USER',
    note: 'Explicit schedule decision',
    createdAt: new Date('2026-07-14T10:00:00.000Z'),
    socialPost: {
      campaignId: 'c1',
      platform: 'META',
      publishTarget: 'INSTAGRAM',
      caption: 'Reviewed launch post',
      status: 'SCHEDULED',
      approvedAt: new Date('2026-07-14T09:00:00.000Z'),
      approvedSnapshot: { version: 2, scope: 'CONTENT_APPROVAL', payloadHash: 'content-hash' },
      mediaApprovalSnapshot: { version: 3, scope: 'CONTENT_MEDIA_APPROVAL', payloadHash: 'media-hash' },
      scheduledSnapshot: { version: 3, scope: 'SCHEDULE_DECISION', payloadHash: 'schedule-hash' },
    },
  }])
  mocks.campaignFindMany.mockResolvedValue([{ id: 'c1', name: 'Launch' }])
})

describe('GET /api/approvals/content-ledger', () => {
  it('returns an owned, traceable content decision ledger', async () => {
    const response = await GET(new NextRequest('http://localhost/api/approvals/content-ledger'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.historyFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId: 'w1' }),
      take: 50,
    }))
    expect(body.events[0]).toMatchObject({
      campaignName: 'Launch',
      platform: 'INSTAGRAM',
      fromStatus: 'APPROVED',
      toStatus: 'SCHEDULED',
      actor: 'USER',
      approvedAt: '2026-07-14T09:00:00.000Z',
      snapshotVersion: 3,
      snapshotScope: 'SCHEDULE_DECISION',
      snapshotHash: 'schedule-hash',
    })
  })

  it('surfaces final-media approval as its own immutable decision', async () => {
    mocks.historyFindMany.mockResolvedValue([{
      id: 'h-media', socialPostId: 'p1', fromStatus: 'APPROVED', toStatus: 'APPROVED', actor: 'USER',
      note: '[MEDIA_APPROVAL] Final media approved in immutable snapshot media-3',
      createdAt: new Date('2026-07-14T09:30:00.000Z'),
      socialPost: {
        campaignId: 'c1', platform: 'META', publishTarget: 'INSTAGRAM', caption: 'Reviewed launch post',
        status: 'APPROVED', approvedAt: new Date('2026-07-14T09:00:00.000Z'),
        approvedSnapshot: { version: 2, scope: 'CONTENT_APPROVAL', payloadHash: 'content-hash' },
        mediaApprovalSnapshot: { version: 3, scope: 'CONTENT_MEDIA_APPROVAL', payloadHash: 'media-hash' },
        scheduledSnapshot: null,
      },
    }])

    const response = await GET(new NextRequest('http://localhost/api/approvals/content-ledger'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.events[0]).toMatchObject({
      snapshotVersion: 3,
      snapshotScope: 'CONTENT_MEDIA_APPROVAL',
      snapshotHash: 'media-hash',
    })
  })

  it('does not expose a ledger without authentication', async () => {
    mocks.getServerUserId.mockResolvedValue(null)
    const response = await GET(new NextRequest('http://localhost/api/approvals/content-ledger'))
    expect(response.status).toBe(401)
    expect(mocks.historyFindMany).not.toHaveBeenCalled()
  })
})
