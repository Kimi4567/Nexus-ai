import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetUser, mockPrisma } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockPrisma: {
    workspace: { findFirst: vi.fn() },
    integration: { findFirst: vi.fn() },
    socialPost: {
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      updateMany: vi.fn(),
    },
    postStatusHistory: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/supabaseAuth', () => ({
  adminClient: { auth: { getUser: mockGetUser } },
}))
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

import { DELETE, POST } from '../route'

const authHeaders = { authorization: 'Bearer token' }

const makeDelete = (confirmation?: string) => ({
  headers: new Headers({
    ...authHeaders,
    ...(confirmation ? { 'x-nexus-confirm-operation': confirmation } : {}),
  }),
  url: 'https://nexus.test/api/schedule?id=post_1',
}) as any

const makePost = (scheduledAt: string) => ({
  headers: new Headers(authHeaders),
  json: async () => ({
    integrationId: 'integration_1',
    pageId: 'page_1',
    caption: 'Reviewed content',
    platform: 'FACEBOOK',
    scheduledAt,
  }),
}) as any

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user_1' } } })
  mockPrisma.workspace.findFirst.mockResolvedValue({ id: 'workspace_1' })
  mockPrisma.integration.findFirst.mockResolvedValue({ id: 'integration_1' })
  mockPrisma.socialPost.findFirst.mockResolvedValue({
    id: 'post_1',
    status: 'SCHEDULED',
    workspaceId: 'workspace_1',
    campaignId: 'campaign_1',
    updatedAt: new Date('2026-07-27T12:00:00.000Z'),
  })
  mockPrisma.socialPost.create.mockResolvedValue({ id: 'post_1', status: 'SCHEDULED' })
  mockPrisma.socialPost.delete.mockResolvedValue({ id: 'post_1' })
  mockPrisma.socialPost.updateMany.mockResolvedValue({ count: 1 })
  mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma))
})

describe('schedule mutation safety', () => {
  it('closes legacy free-form scheduling in favor of Content Hub', async () => {
    const response = await POST(makePost('2020-01-01T10:00:00Z'))
    const body = await response.json()

    expect(response.status).toBe(410)
    expect(body.code).toBe('CONTENT_HUB_SCHEDULING_REQUIRED')
    expect(mockPrisma.socialPost.create).not.toHaveBeenCalled()
  })

  it('retains published records as immutable execution history', async () => {
    mockPrisma.socialPost.findFirst.mockResolvedValue({ id: 'post_1', status: 'PUBLISHED' })

    const response = await DELETE(makeDelete('cancel_scheduled_post'))

    expect(response.status).toBe(409)
    expect(mockPrisma.socialPost.delete).not.toHaveBeenCalled()
  })

  it('requires the matching explicit confirmation before cancellation', async () => {
    const response = await DELETE(makeDelete())

    expect(response.status).toBe(400)
    expect(mockPrisma.socialPost.delete).not.toHaveBeenCalled()
  })

  it('returns scheduled campaign content to review and removes old delivery bindings', async () => {
    const response = await DELETE(makeDelete('cancel_scheduled_post'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      success: true,
      reverted: 1,
      status: 'APPROVED',
      mode: 'schedule_cancelled',
    })
    expect(mockPrisma.socialPost.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'post_1',
        workspaceId: 'workspace_1',
        status: 'SCHEDULED',
      }),
      data: expect.objectContaining({
        status: 'APPROVED',
        publishMode: 'MANUAL',
        scheduledSnapshotId: null,
        integrationId: null,
        autoPublishConsentAt: null,
        publishAttemptedAt: null,
      }),
    }))
    expect(mockPrisma.postStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        socialPostId: 'post_1',
        workspaceId: 'workspace_1',
        fromStatus: 'SCHEDULED',
        toStatus: 'APPROVED',
        note: 'cancel_schedule',
      }),
    })
    expect(mockPrisma.socialPost.delete).not.toHaveBeenCalled()
  })

  it('deletes only a failed execution record after its explicit dismissal', async () => {
    mockPrisma.socialPost.findFirst.mockResolvedValue({
      id: 'post_1',
      status: 'FAILED',
      workspaceId: 'workspace_1',
      campaignId: 'campaign_1',
      updatedAt: new Date('2026-07-27T12:00:00.000Z'),
    })

    const response = await DELETE(makeDelete('dismiss_failed_record'))

    expect(response.status).toBe(200)
    expect(mockPrisma.socialPost.delete).toHaveBeenCalledWith({ where: { id: 'post_1' } })
    expect(mockPrisma.socialPost.updateMany).not.toHaveBeenCalled()
  })

  it('does not cancel a scheduled record that changed concurrently', async () => {
    mockPrisma.socialPost.updateMany.mockResolvedValueOnce({ count: 0 })

    const response = await DELETE(makeDelete('cancel_scheduled_post'))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('SCHEDULE_CANCEL_CONCURRENT_CHANGE')
    expect(mockPrisma.socialPost.delete).not.toHaveBeenCalled()
  })
})
