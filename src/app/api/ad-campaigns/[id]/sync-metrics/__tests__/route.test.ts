import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  campaignFindFirst: vi.fn(),
  campaignUpdate: vi.fn(),
  snapshotFindFirst: vi.fn(),
  snapshotFindMany: vi.fn(),
  snapshotCreate: vi.fn(),
  snapshotUpdate: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getAuthUser: mocks.getAuthUser }))
vi.mock('@/lib/adPlatforms/metaAdsApi', () => ({ createMetaAdsApi: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    adCampaign: {
      findFirst: mocks.campaignFindFirst,
      update: mocks.campaignUpdate,
    },
    adPerformanceSnapshot: {
      findFirst: mocks.snapshotFindFirst,
      findMany: mocks.snapshotFindMany,
      create: mocks.snapshotCreate,
      update: mocks.snapshotUpdate,
    },
  },
}))

import { POST } from '@/app/api/ad-campaigns/[id]/sync-metrics/route'

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/ad-campaigns/campaign-1/sync-metrics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer session' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getAuthUser.mockResolvedValue({ id: 'user-1' })
  mocks.campaignFindFirst.mockResolvedValue({
    id: 'campaign-1',
    platformCampaignId: null,
    adAccount: null,
  })
  mocks.snapshotFindFirst.mockResolvedValue(null)
  mocks.snapshotCreate.mockResolvedValue({ id: 'snapshot-1' })
  mocks.snapshotFindMany.mockResolvedValue([
    { spend: 12.5, impressions: 100, clicks: 5, conversions: 1, roas: null },
  ])
  mocks.campaignUpdate.mockResolvedValue({ id: 'campaign-1' })
})

describe('manual paid metric evidence', () => {
  it('rejects negative and non-finite metric input', async () => {
    const response = await POST(request({ date: '2000-01-01', spend: -1 }), {
      params: Promise.resolve({ id: 'campaign-1' }),
    } as any)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ mode: 'manual' })
    expect(mocks.snapshotCreate).not.toHaveBeenCalled()
  })

  it('rejects fractional count metrics', async () => {
    const response = await POST(request({ date: '2000-01-01', spend: 10, impressions: 1.5 }), {
      params: Promise.resolve({ id: 'campaign-1' }),
    } as any)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ mode: 'manual' })
    expect(mocks.snapshotCreate).not.toHaveBeenCalled()
  })

  it('stores omitted ROAS as unknown and derives only supported aggregates', async () => {
    const response = await POST(request({
      date: '2000-01-01',
      spend: '12.50',
      impressions: '100',
      clicks: '5',
      conversions: '1',
      roas: '',
    }), {
      params: Promise.resolve({ id: 'campaign-1' }),
    } as any)

    expect(response.status).toBe(200)
    expect(mocks.snapshotCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        spend: 12.5,
        impressions: 100,
        clicks: 5,
        conversions: 1,
        roas: null,
        dataSource: 'manual',
      }),
    })
    expect(mocks.campaignUpdate).toHaveBeenCalledWith({
      where: { id: 'campaign-1' },
      data: expect.objectContaining({ avgCTR: 5, avgCPC: 2.5, avgROAS: null }),
    })
    expect(await response.json()).toMatchObject({
      mode: 'manual',
      measurementCompleteness: 'partial',
      reportedFields: expect.arrayContaining(['spend', 'impressions', 'clicks', 'conversions']),
    })
  })
})
