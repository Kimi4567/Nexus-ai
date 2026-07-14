import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  workspaceFindFirst: vi.fn(),
  adAccountFindMany: vi.fn(),
  adAccountFindFirst: vi.fn(),
  adAccountUpdate: vi.fn(),
  adAccountUpdateMany: vi.fn(),
  integrationFindUnique: vi.fn(),
  integrationFindFirst: vi.fn(),
  integrationUpdate: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getAuthUser: mocks.getAuthUser }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: { findFirst: mocks.workspaceFindFirst },
    adAccount: {
      findMany: mocks.adAccountFindMany,
      findFirst: mocks.adAccountFindFirst,
      update: mocks.adAccountUpdate,
      updateMany: mocks.adAccountUpdateMany,
    },
    integration: {
      findUnique: mocks.integrationFindUnique,
      findFirst: mocks.integrationFindFirst,
      update: mocks.integrationUpdate,
    },
    $transaction: mocks.transaction,
  },
}))

import { DELETE, GET } from '@/app/api/ad-accounts/route'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.GOOGLE_ADS_ACCESS_TIER = 'EXPLORER'
  mocks.getAuthUser.mockResolvedValue({ id: 'user-1' })
  mocks.workspaceFindFirst.mockResolvedValue({ id: 'workspace-1' })
  mocks.adAccountFindMany.mockResolvedValue([])
  mocks.integrationFindUnique.mockResolvedValue(null)
  mocks.integrationUpdate.mockResolvedValue({})
  mocks.adAccountUpdateMany.mockResolvedValue({ count: 0 })
  mocks.transaction.mockImplementation(async (operations: Promise<unknown>[]) => Promise.all(operations))
})

describe('/api/ad-accounts Google Ads connection', () => {
  it('returns the manager readiness state without exposing stored OAuth tokens or private config', async () => {
    mocks.integrationFindUnique.mockResolvedValue({
      id: 'integration-1',
      status: 'CONNECTED',
      accountId: '3319467856',
      accountName: 'NEXUS AI Marketing OS',
      refreshToken: 'encrypted-refresh-token',
      lastSyncedAt: new Date('2026-07-14T10:00:00.000Z'),
      createdAt: new Date('2026-07-14T09:00:00.000Z'),
      config: {
        connectionRole: 'MANAGER',
        advertiserAccountCount: 0,
        advertiserReadiness: 'NOT_VISIBLE',
        accessTier: 'EXPLORER',
        internalSecret: 'must-not-leak',
        managerAccounts: [{
          customerId: '3319467856',
          descriptiveName: 'NEXUS AI Marketing OS',
          status: 'ENABLED',
          testAccount: false,
          privateValue: 'must-not-leak',
        }],
      },
    })

    const response = await GET(new NextRequest('http://localhost/api/ad-accounts', {
      headers: { Authorization: 'Bearer session' },
    }))
    const body = await response.json()

    expect(body.googleAdsConnection).toMatchObject({
      id: 'integration-1',
      accountId: '3319467856',
      connectionRole: 'MANAGER',
      advertiserAccountCount: 0,
      advertiserReadiness: 'NOT_VISIBLE',
      hasRefreshToken: true,
      managerAccounts: [{
        customerId: '3319467856',
        descriptiveName: 'NEXUS AI Marketing OS',
        status: 'ENABLED',
        testAccount: false,
      }],
    })
    expect(JSON.stringify(body)).not.toContain('encrypted-refresh-token')
    expect(JSON.stringify(body)).not.toContain('must-not-leak')
  })

  it('disconnects the manager integration and every locally stored Google ad account atomically', async () => {
    mocks.integrationFindFirst.mockResolvedValue({ id: 'integration-1' })

    const response = await DELETE(new NextRequest(
      'http://localhost/api/ad-accounts?integrationId=integration-1',
      { method: 'DELETE', headers: { Authorization: 'Bearer session' } },
    ))

    expect(response.status).toBe(200)
    expect(mocks.integrationFindFirst).toHaveBeenCalledWith({
      where: { id: 'integration-1', workspaceId: 'workspace-1', type: 'GOOGLE' },
    })
    expect(mocks.integrationUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'DISCONNECTED',
        accessToken: null,
        refreshToken: null,
      }),
    }))
    expect(mocks.adAccountUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId: 'workspace-1', platform: 'GOOGLE' },
      data: expect.objectContaining({ status: 'DISCONNECTED', hasApiAccess: false }),
    }))
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
  })
})
