import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHmac } from 'crypto'

const TEST_SECRET = 'threads-app-secret'
process.env.THREADS_APP_SECRET = TEST_SECRET
process.env.NEXT_PUBLIC_APP_URL = 'https://www.nexus-grow.com'

const mocks = vi.hoisted(() => ({
  integrationFindMany: vi.fn(),
  integrationUpdateMany: vi.fn(),
  integrationDeleteMany: vi.fn(),
  learningCreateMany: vi.fn(),
  deletionFindFirst: vi.fn(),
  deletionCreate: vi.fn(),
  deletionUpdate: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    integration: { findMany: mocks.integrationFindMany },
    dataDeletionRequest: { findFirst: mocks.deletionFindFirst },
    $transaction: vi.fn(async callback => callback({
      integration: {
        updateMany: mocks.integrationUpdateMany,
        deleteMany: mocks.integrationDeleteMany,
      },
      marketingLearningEvent: { createMany: mocks.learningCreateMany },
      dataDeletionRequest: {
        create: mocks.deletionCreate,
        update: mocks.deletionUpdate,
      },
    })),
  },
}))

import { POST as uninstall } from '../threads-uninstall/route'
import { POST as deleteData } from '../threads-data-deletion/route'

function base64Url(value: Buffer): string {
  return value
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function signedRequest(
  payload: Record<string, unknown>,
  secret = TEST_SECRET,
): string {
  const encodedPayload = base64Url(Buffer.from(JSON.stringify(payload)))
  const signature = createHmac('sha256', secret).update(encodedPayload).digest()
  return `${base64Url(signature)}.${encodedPayload}`
}

function request(body: Record<string, unknown>) {
  return {
    headers: {
      get: (key: string) => key.toLowerCase() === 'content-type'
        ? 'application/json'
        : null,
    },
    json: async () => body,
  } as any
}

function validRequest(userId = 'threads-user-1') {
  return signedRequest({
    user_id: userId,
    algorithm: 'HMAC-SHA256',
    issued_at: Math.floor(Date.now() / 1000),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.integrationFindMany.mockResolvedValue([])
  mocks.integrationUpdateMany.mockResolvedValue({ count: 0 })
  mocks.integrationDeleteMany.mockResolvedValue({ count: 0 })
  mocks.learningCreateMany.mockResolvedValue({ count: 0 })
  mocks.deletionFindFirst.mockResolvedValue(null)
  mocks.deletionCreate.mockResolvedValue({})
  mocks.deletionUpdate.mockResolvedValue({})
})

describe('Threads uninstall callback', () => {
  it('rejects an invalid Meta signature without changing an integration', async () => {
    const invalid = signedRequest({
      user_id: 'threads-user-1',
      algorithm: 'HMAC-SHA256',
      issued_at: Math.floor(Date.now() / 1000),
    }, 'wrong-secret')

    const response = await uninstall(request({ signed_request: invalid }))

    expect(response.status).toBe(400)
    expect(mocks.integrationFindMany).not.toHaveBeenCalled()
  })

  it('erases credentials only for the signed Threads account', async () => {
    mocks.integrationFindMany.mockResolvedValue([
      { id: 'threads-integration-1', workspaceId: 'workspace-1' },
    ])

    const response = await uninstall(request({ signed_request: validRequest() }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(mocks.integrationFindMany).toHaveBeenCalledWith({
      where: { type: 'THREADS', accountId: 'threads-user-1' },
      select: { id: true, workspaceId: true },
    })
    expect(mocks.integrationUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ['threads-integration-1'] } },
      data: expect.objectContaining({
        status: 'DISCONNECTED',
        accessToken: null,
        refreshToken: null,
      }),
    }))
  })
})

describe('Threads data-deletion callback', () => {
  it('deletes only the signed Threads integration and returns a receipt', async () => {
    mocks.integrationFindMany.mockResolvedValue([
      {
        id: 'threads-integration-1',
        workspace: { ownerId: 'nexus-user-1' },
      },
    ])

    const response = await deleteData(request({ signed_request: validRequest() }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.url).toBe(`https://www.nexus-grow.com/data-deletion?id=${body.confirmation_code}`)
    expect(mocks.integrationDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['threads-integration-1'] } },
    })
    expect(mocks.deletionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fbUserId: 'threads:threads-user-1',
        userId: 'nexus-user-1',
        status: 'completed',
        confirmationCode: body.confirmation_code,
      }),
    })
  })

  it('is idempotent for an already completed request', async () => {
    mocks.deletionFindFirst.mockResolvedValue({
      id: 'deletion-1',
      status: 'completed',
      confirmationCode: 'del_existing',
    })

    const response = await deleteData(request({ signed_request: validRequest() }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      url: 'https://www.nexus-grow.com/data-deletion?id=del_existing',
      confirmation_code: 'del_existing',
    })
    expect(mocks.integrationFindMany).not.toHaveBeenCalled()
    expect(mocks.integrationDeleteMany).not.toHaveBeenCalled()
  })
})
