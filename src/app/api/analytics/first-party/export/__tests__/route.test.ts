import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { summarizeFirstPartyMeasurement } from '@/lib/firstPartyMeasurement'

const mocks = vi.hoisted(() => ({
  getServerUserId: vi.fn(),
  workspaceFindFirst: vi.fn(),
  campaignFindFirst: vi.fn(),
  readMeasurement: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.getServerUserId }))
vi.mock('@/lib/firstPartyMeasurementService', () => ({ readFirstPartyMeasurement: mocks.readMeasurement }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: { findFirst: mocks.workspaceFindFirst },
    campaign: { findFirst: mocks.campaignFindFirst },
  },
}))

import { GET } from '@/app/api/analytics/first-party/export/route'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getServerUserId.mockResolvedValue('user-1')
  mocks.workspaceFindFirst.mockResolvedValue({ id: 'workspace-1' })
  mocks.campaignFindFirst.mockResolvedValue({ id: 'campaign-1', name: 'Launch 2026' })
  mocks.readMeasurement.mockResolvedValue(summarizeFirstPartyMeasurement([], []))
})

describe('GET /api/analytics/first-party/export', () => {
  it('requires authentication', async () => {
    mocks.getServerUserId.mockResolvedValue(null)
    const response = await GET(new NextRequest('http://localhost/api/analytics/first-party/export'))
    expect(response.status).toBe(401)
    expect(mocks.workspaceFindFirst).not.toHaveBeenCalled()
  })

  it('rejects a campaign outside the authenticated workspace', async () => {
    mocks.campaignFindFirst.mockResolvedValue(null)
    const response = await GET(new NextRequest('http://localhost/api/analytics/first-party/export?campaignId=foreign'))
    expect(response.status).toBe(404)
    expect(mocks.campaignFindFirst).toHaveBeenCalledWith({
      where: { id: 'foreign', workspaceId: 'workspace-1' },
      select: { id: true, name: true },
    })
    expect(mocks.readMeasurement).not.toHaveBeenCalled()
  })

  it('exports only the selected campaign acquisition cohort', async () => {
    const response = await GET(new NextRequest('http://localhost/api/analytics/first-party/export?campaignId=campaign-1'))
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/csv')
    expect(response.headers.get('content-disposition')).toContain('nexus-first-party-Launch-2026-')
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(mocks.readMeasurement).toHaveBeenCalledWith('workspace-1', 'campaign-1')
    expect(body).toContain('metadata,campaign_id,campaign-1')
    expect(body).toContain('metadata,statistical_proof,false')
  })

  it('keeps a campaign-specific filename when the campaign name has no ASCII characters', async () => {
    mocks.campaignFindFirst.mockResolvedValue({ id: 'cm1234567890abcdef', name: 'حملة صيفية' })

    const response = await GET(new NextRequest('http://localhost/api/analytics/first-party/export?campaignId=cm1234567890abcdef'))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toContain(
      'nexus-first-party-campaign-cm1234567890abcdef-',
    )
    expect(response.headers.get('content-disposition')).not.toContain('nexus-first-party-workspace-')
  })
})
