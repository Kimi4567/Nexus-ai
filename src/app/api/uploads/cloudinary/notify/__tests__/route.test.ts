import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUserId: vi.fn(),
  findUnique: vi.fn(),
  resource: vi.fn(),
  updateMany: vi.fn(),
  mediaCreate: vi.fn(),
  transaction: vi.fn(),
  log: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.getUserId }))
vi.mock('@/lib/auditLogger', () => ({ logUploadEvent: mocks.log }))
vi.mock('cloudinary', () => ({
  v2: {
    config: vi.fn(),
    api: { resource: mocks.resource },
  },
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    uploadSession: { findUnique: mocks.findUnique },
    $transaction: mocks.transaction,
  },
}))

import { POST } from '@/app/api/uploads/cloudinary/notify/route'

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/uploads/cloudinary/notify', {
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
    projectId: null, campaignId: null, fileName: 'logo.png', resourceType: 'auto',
    status: 'PENDING', expiresAt: new Date(Date.now() + 60_000),
  })
  mocks.resource.mockResolvedValue({
    secure_url: 'https://res.cloudinary.com/cloud/image/upload/nexus/workspace-1/asset.png',
    format: 'png', bytes: 1234, resource_type: 'image',
  })
  mocks.updateMany.mockResolvedValue({ count: 1 })
  mocks.mediaCreate.mockResolvedValue({ id: 'media-1', url: 'verified-url' })
  mocks.transaction.mockImplementation(async (callback: any) => callback({
    uploadSession: { updateMany: mocks.updateMany },
    media: { create: mocks.mediaCreate },
  }))
})

describe('Cloudinary upload registration', () => {
  it('rejects an asset outside the session workspace', async () => {
    const response = await POST(request({
      sessionToken: 'token-1',
      publicId: 'nexus/victim-workspace/asset',
    }))
    expect(response.status).toBe(403)
    expect(mocks.resource).not.toHaveBeenCalled()
  })

  it('uses Cloudinary-verified metadata instead of client claims', async () => {
    mocks.resource.mockResolvedValueOnce({
      secure_url: 'https://res.cloudinary.com/cloud/image/upload/nexus/workspace-1/asset.png',
      format: 'png', bytes: 1234, resource_type: 'image', width: 1200, height: 630,
    })
    const response = await POST(request({
      sessionToken: 'token-1',
      publicId: 'nexus/workspace-1/session-1',
      secureUrl: 'https://attacker.example/forged.png',
      bytes: 1,
      mimeType: 'image/svg+xml',
    }))

    expect(response.status).toBe(200)
    expect(mocks.mediaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'workspace-1',
        url: 'https://res.cloudinary.com/cloud/image/upload/nexus/workspace-1/asset.png',
        cloudinaryId: 'nexus/workspace-1/session-1',
        mimeType: 'image/png',
        size: 1234,
        width: 1200,
        height: 630,
      }),
    })
  })

  it('normalizes verified video duration and dimensions before Prisma storage', async () => {
    mocks.findUnique.mockResolvedValueOnce({
      id: 'session-1', token: 'token-1', userId: 'user-1', workspaceId: 'workspace-1',
      projectId: null, campaignId: null, fileName: 'launch.mp4', resourceType: 'video',
      status: 'PENDING', expiresAt: new Date(Date.now() + 60_000),
    })
    mocks.resource.mockResolvedValueOnce({
      secure_url: 'https://res.cloudinary.com/cloud/video/upload/nexus/workspace-1/launch.mp4',
      format: 'mp4', bytes: 2048, resource_type: 'video', width: 1920, height: 1080,
      duration: 12.04,
    })

    const response = await POST(request({
      sessionToken: 'token-1',
      publicId: 'nexus/workspace-1/session-1',
    }))

    expect(response.status).toBe(200)
    expect(mocks.mediaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'VIDEO',
        mimeType: 'video/mp4',
        width: 1920,
        height: 1080,
        duration: 13,
      }),
    })
  })

  it('rejects videos longer than the enforced five-minute limit', async () => {
    mocks.findUnique.mockResolvedValueOnce({
      id: 'session-1', token: 'token-1', userId: 'user-1', workspaceId: 'workspace-1',
      projectId: null, campaignId: null, fileName: 'long.mp4', resourceType: 'video',
      status: 'PENDING', expiresAt: new Date(Date.now() + 60_000),
    })
    mocks.resource.mockResolvedValueOnce({
      secure_url: 'https://res.cloudinary.com/cloud/video/upload/nexus/workspace-1/long.mp4',
      format: 'mp4', bytes: 2048, resource_type: 'video', width: 1920, height: 1080,
      duration: 300.01,
    })

    const response = await POST(request({
      sessionToken: 'token-1',
      publicId: 'nexus/workspace-1/session-1',
    }))

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ errorCode: 'INVALID_VIDEO_DURATION' })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('atomically rejects replay of a consumed session', async () => {
    mocks.updateMany.mockResolvedValueOnce({ count: 0 })
    const response = await POST(request({
      sessionToken: 'token-1',
      publicId: 'nexus/workspace-1/session-1',
    }))
    expect(response.status).toBe(409)
    expect(mocks.mediaCreate).not.toHaveBeenCalled()
  })
})
