import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  ensureUser: vi.fn(),
  getUserId: vi.fn(),
  transaction: vi.fn(),
  lock: vi.fn(),
  userFind: vi.fn(),
  workspaceCount: vi.fn(),
  workspaceFind: vi.fn(),
  workspaceCreate: vi.fn(),
  workspaceFindMany: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({
  ensureDbUser: mocks.ensureUser,
  getServerUserId: mocks.getUserId,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mocks.transaction,
    workspace: { findMany: mocks.workspaceFindMany },
  },
}))

import { POST } from '@/app/api/workspaces/route'

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/workspaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer session' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.ensureUser.mockResolvedValue({ id: 'user-1', email: 'user@example.com' })
  mocks.lock.mockResolvedValue([])
  mocks.userFind.mockResolvedValue({ subscriptionStatus: 'FREE', role: 'USER' })
  mocks.workspaceCount.mockResolvedValue(0)
  mocks.workspaceFind.mockResolvedValue(null)
  mocks.workspaceCreate.mockResolvedValue({ id: 'workspace-1', name: 'Brand', slug: 'brand' })
  mocks.transaction.mockImplementation(async (callback: any) => callback({
    $executeRawUnsafe: mocks.lock,
    user: { findUnique: mocks.userFind },
    workspace: {
      count: mocks.workspaceCount,
      findUnique: mocks.workspaceFind,
      create: mocks.workspaceCreate,
    },
  }))
})

describe('POST /api/workspaces', () => {
  it('enforces the Free one-workspace limit under an advisory lock', async () => {
    mocks.workspaceCount.mockResolvedValueOnce(1)
    const response = await POST(request({ name: 'Second Brand', slug: 'second-brand' }))
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toMatchObject({ code: 'WORKSPACE_LIMIT_REACHED', limit: 1, current: 1 })
    expect(mocks.lock).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      'workspace-limit:user-1',
    )
    expect(mocks.workspaceCreate).not.toHaveBeenCalled()
  })

  it('allows Growth up to three owned workspaces', async () => {
    mocks.userFind.mockResolvedValueOnce({ subscriptionStatus: 'PRO', role: 'USER' })
    mocks.workspaceCount.mockResolvedValueOnce(2)
    const response = await POST(request({ name: 'Third Brand', slug: 'Third Brand!' }))

    expect(response.status).toBe(201)
    expect(mocks.workspaceCreate).toHaveBeenCalledWith({
      data: {
        name: 'Third Brand',
        slug: 'third-brand',
        description: null,
        ownerId: 'user-1',
      },
    })
  })

  it('rejects malformed input before opening a transaction', async () => {
    const response = await POST(request({ name: 'x', slug: '..' }))
    expect(response.status).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})
