import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getServerUserId: vi.fn(),
  getLatestCampaignAutomationJob: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.getServerUserId }))
vi.mock('@/lib/automationJobs/repository', () => ({
  getLatestCampaignAutomationJob: mocks.getLatestCampaignAutomationJob,
}))

import { GET } from '@/app/api/automation/jobs/route'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getServerUserId.mockResolvedValue('user-1')
  mocks.getLatestCampaignAutomationJob.mockResolvedValue(null)
})

describe('GET /api/automation/jobs', () => {
  it('returns an empty owner-scoped result when no campaign job exists', async () => {
    const response = await GET(new NextRequest(
      'http://localhost/api/automation/jobs?campaignId=campaign-1&kind=CAMPAIGN_APPROVAL_PACKAGE&active=1',
    ))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ job: null })
    expect(mocks.getLatestCampaignAutomationJob).toHaveBeenCalledWith({
      userId: 'user-1',
      campaignId: 'campaign-1',
      kind: 'CAMPAIGN_APPROVAL_PACKAGE',
      activeOnly: true,
    })
  })

  it('reports a rollout prerequisite instead of throwing when the schema is pending', async () => {
    mocks.getLatestCampaignAutomationJob.mockRejectedValue(
      Object.assign(new Error('AutomationJob table missing'), { code: 'P2021' }),
    )

    const response = await GET(new NextRequest(
      'http://localhost/api/automation/jobs?campaignId=campaign-1',
    ))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toMatchObject({ code: 'AUTOMATION_MIGRATION_REQUIRED' })
  })
})
