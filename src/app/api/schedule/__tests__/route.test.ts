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
    },
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
  mockPrisma.socialPost.findFirst.mockResolvedValue({ id: 'post_1', status: 'SCHEDULED' })
  mockPrisma.socialPost.create.mockResolvedValue({ id: 'post_1', status: 'SCHEDULED' })
  mockPrisma.socialPost.delete.mockResolvedValue({ id: 'post_1' })
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

  it('cancels a scheduled record only after the explicit confirmation', async () => {
    const response = await DELETE(makeDelete('cancel_scheduled_post'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockPrisma.socialPost.delete).toHaveBeenCalledWith({ where: { id: 'post_1' } })
  })
})
