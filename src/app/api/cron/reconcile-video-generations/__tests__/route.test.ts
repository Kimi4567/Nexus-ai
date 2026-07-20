import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { generation: { findMany: mocks.findMany } },
}))

import { GET } from '../route'

const secret = 'video-reconciliation-test-secret'
const ownerId = '7cc7a5d7-f51a-40c8-bbca-acde967b97e1'

function request(authorized = true) {
  return new Request('https://nexus.example/api/cron/reconcile-video-generations', {
    headers: authorized ? { authorization: `Bearer ${secret}` } : undefined,
  }) as any
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('CRON_SECRET', secret)
  mocks.findMany.mockResolvedValue([])
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('video generation reconciliation cron', () => {
  it('fails closed without the cron credential', async () => {
    const response = await GET(request(false))
    expect(response.status).toBe(401)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it('returns a clean heartbeat when there are no active video tasks', async () => {
    const response = await GET(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      scanned: 0,
      reconciled: 0,
      stillProcessing: 0,
      workerErrors: 0,
    })
  })

  it('delegates active jobs to the ownership-checked video finalizer', async () => {
    mocks.findMany.mockResolvedValue([{
      id: 'generation-1',
      campaignId: 'campaign-1',
      params: { postId: 'post-1' },
      campaign: { workspace: { ownerId } },
    }])
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 'SUCCEEDED',
      generationId: 'generation-1',
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ scanned: 1, reconciled: 1, workerErrors: 0 })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://nexus.example/api/campaigns/campaign-1/content-plan/post-1/generate-video',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          authorization: `Bearer ${secret}`,
          'x-nexus-internal-user-id': ownerId,
          'x-nexus-worker': 'video-reconciliation',
        }),
        cache: 'no-store',
      }),
    )
  })

  it('reports invalid task context as a retryable worker failure', async () => {
    mocks.findMany.mockResolvedValue([{
      id: 'generation-1',
      campaignId: 'campaign-1',
      params: {},
      campaign: { workspace: { ownerId } },
    }])

    const response = await GET(request())
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ scanned: 1, workerErrors: 1 })
  })
})
