import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  cronAuthError: vi.fn(),
  processNextAutomationJob: vi.fn(),
}))

vi.mock('@/lib/cronAuth', () => ({ cronAuthError: mocks.cronAuthError }))
vi.mock('@/lib/automationJobs/processor', () => ({
  processNextAutomationJob: mocks.processNextAutomationJob,
}))

import { GET } from '@/app/api/cron/automation-jobs/route'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.cronAuthError.mockReturnValue(null)
  mocks.processNextAutomationJob.mockResolvedValue(null)
})

describe('GET /api/cron/automation-jobs', () => {
  it('rejects unauthenticated scheduler requests', async () => {
    mocks.cronAuthError.mockReturnValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    const response = await GET(new NextRequest('http://localhost/api/cron/automation-jobs'))
    expect(response.status).toBe(401)
    expect(mocks.processNextAutomationJob).not.toHaveBeenCalled()
  })

  it('claims at most two jobs per worker invocation', async () => {
    mocks.processNextAutomationJob
      .mockResolvedValueOnce({ id: 'job-1', kind: 'CAMPAIGN_ENGINE', status: 'COMPLETED', attemptCount: 1 })
      .mockResolvedValueOnce(null)

    const response = await GET(new NextRequest('http://localhost/api/cron/automation-jobs?limit=99'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.processNextAutomationJob).toHaveBeenCalledTimes(2)
    expect(body).toMatchObject({ ok: true, claimed: 1, workerErrors: 0 })
  })
})
