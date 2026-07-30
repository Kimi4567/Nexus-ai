import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getServerUserId: vi.fn(),
  getAutomationJobForOwner: vi.fn(),
  processAutomationJobById: vi.fn(),
  after: vi.fn(),
}))

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: mocks.after }
})
vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.getServerUserId }))
vi.mock('@/lib/automationJobs/repository', () => ({
  getAutomationJobForOwner: mocks.getAutomationJobForOwner,
}))
vi.mock('@/lib/automationJobs/processor', () => ({
  processAutomationJobById: mocks.processAutomationJobById,
}))

import { GET, POST } from '@/app/api/automation/jobs/[id]/route'

const props = { params: Promise.resolve({ id: 'job-1' }) }
const job = {
  id: 'job-1',
  workspaceId: 'workspace-1',
  campaignId: 'campaign-1',
  requestedByUserId: 'user-1',
  kind: 'CAMPAIGN_ENGINE',
  status: 'QUEUED',
  idempotencyKey: 'private-operation-key',
  priority: 0,
  input: { private: 'payload' },
  output: null,
  currentStep: 'queued',
  progress: 10,
  attemptCount: 0,
  maxAttempts: 3,
  nextAttemptAt: new Date(0),
  leaseToken: null,
  leaseExpiresAt: null,
  errorCode: null,
  lastError: null,
  startedAt: null,
  completedAt: null,
  cancelledAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as any

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getServerUserId.mockResolvedValue('user-1')
  mocks.getAutomationJobForOwner.mockResolvedValue(job)
  mocks.after.mockImplementation(() => undefined)
})

describe('/api/automation/jobs/[id]', () => {
  it('requires an authenticated owner', async () => {
    mocks.getServerUserId.mockResolvedValue(null)
    const response = await GET(new NextRequest('http://localhost/api/automation/jobs/job-1'), props)
    expect(response.status).toBe(401)
    expect(mocks.getAutomationJobForOwner).not.toHaveBeenCalled()
  })

  it('returns a sanitized owner-visible job without input or idempotency data', async () => {
    const response = await GET(new NextRequest('http://localhost/api/automation/jobs/job-1'), props)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.job).toMatchObject({ id: 'job-1', status: 'QUEUED', canResume: true })
    expect(body.job.input).toBeUndefined()
    expect(body.job.idempotencyKey).toBeUndefined()
  })

  it('returns a rollout prerequisite instead of an unhandled schema error', async () => {
    mocks.getAutomationJobForOwner.mockRejectedValue(
      Object.assign(new Error('AutomationJob table missing'), { code: 'P2021' }),
    )

    const response = await GET(new NextRequest('http://localhost/api/automation/jobs/job-1'), props)
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.code).toBe('AUTOMATION_MIGRATION_REQUIRED')
  })

  it('accepts a due job for response-tail processing', async () => {
    const response = await POST(new NextRequest('http://localhost/api/automation/jobs/job-1', {
      method: 'POST',
    }), props)
    const body = await response.json()

    expect(response.status).toBe(202)
    expect(body.accepted).toBe(true)
    expect(mocks.after).toHaveBeenCalledTimes(1)
  })
})
