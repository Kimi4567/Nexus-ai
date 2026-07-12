import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUserId: vi.fn(),
  findUnique: vi.fn(),
  log: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.getUserId }))
vi.mock('@/lib/prisma', () => ({ prisma: { uploadSession: { findUnique: mocks.findUnique } } }))
vi.mock('@/lib/auditLogger', () => ({ logUploadEvent: mocks.log }))

import { POST } from '@/app/api/uploads/cloudinary/signature/route'

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/uploads/cloudinary/signature', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer session' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CLOUDINARY_API_KEY = 'key'
  process.env.CLOUDINARY_API_SECRET = 'secret'
  process.env.CLOUDINARY_CLOUD_NAME = 'cloud'
  mocks.getUserId.mockResolvedValue('user-1')
  mocks.findUnique.mockResolvedValue({
    id: 'session-1', token: 'token-1', userId: 'user-1', workspaceId: 'workspace-1',
    status: 'PENDING', expiresAt: new Date(Date.now() + 60_000), resourceType: 'auto',
  })
})

describe('Cloudinary upload signature', () => {
  it('rejects the former sessionless folder-signing path', async () => {
    const response = await POST(request({ folder: 'nexus/victim-workspace' }))
    expect(response.status).toBe(400)
    expect(mocks.findUnique).not.toHaveBeenCalled()
  })

  it('rejects sessions owned by another user', async () => {
    mocks.findUnique.mockResolvedValueOnce({
      id: 'session-1', userId: 'victim', workspaceId: 'workspace-victim',
      status: 'PENDING', expiresAt: new Date(Date.now() + 60_000), resourceType: 'auto',
    })
    const response = await POST(request({ sessionToken: 'token-1' }))
    expect(response.status).toBe(403)
  })

  it('derives the signed folder only from the owned session', async () => {
    const response = await POST(request({
      sessionToken: 'token-1',
      folder: 'nexus/victim-workspace',
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      folder: 'nexus/workspace-1',
      public_id: 'session-1',
      overwrite: false,
      resource_type: 'auto',
      sessionToken: 'token-1',
      signature: expect.any(String),
    })
  })
})
