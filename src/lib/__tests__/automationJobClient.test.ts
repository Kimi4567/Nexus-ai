import { describe, expect, it, vi } from 'vitest'
import { waitForAutomationJob } from '@/lib/automationJobClient'

function response(status: string, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({
    job: {
      id: 'job-1',
      status,
      progress: status === 'COMPLETED' ? 100 : 40,
      currentStep: 'campaign_engine',
      attemptCount: 1,
      maxAttempts: 3,
      nextAttemptAt: new Date(0).toISOString(),
      terminal: ['COMPLETED', 'FAILED', 'CANCELLED'].includes(status),
      awaitingApproval: status === 'WAITING_FOR_APPROVAL',
      canResume: status === 'RETRY_SCHEDULED',
      message: null,
      errorCode: null,
      output: status === 'COMPLETED' ? { campaignId: 'campaign-1' } : null,
      ...extra,
    },
  }), { status: 200 })
}

describe('waitForAutomationJob', () => {
  it('polls until the durable job completes', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response('RUNNING'))
      .mockResolvedValueOnce(response('COMPLETED'))

    const result = await waitForAutomationJob('job-1', {
      authorization: 'Bearer test',
      fetchImpl,
      sleep: vi.fn(async () => {}),
      now: (() => {
        let value = 0
        return () => value += 100
      })(),
    })

    expect(result).toMatchObject({
      timedOut: false,
      job: { status: 'COMPLETED', progress: 100 },
    })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('asks the server to resume a due retry without changing job state locally', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response('RETRY_SCHEDULED'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ accepted: true }), { status: 202 }))
      .mockResolvedValueOnce(response('COMPLETED'))

    const result = await waitForAutomationJob('job-1', {
      authorization: 'Bearer test',
      fetchImpl,
      sleep: vi.fn(async () => {}),
      now: (() => {
        let value = 20_000
        return () => value += 100
      })(),
    })

    expect(result.job.status).toBe('COMPLETED')
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      '/api/automation/jobs/job-1',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('stops polling when the package is ready for a human approval decision', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response('WAITING_FOR_APPROVAL', {
      progress: 100,
      currentStep: 'waiting_for_approval',
    }))

    const result = await waitForAutomationJob('job-1', {
      authorization: 'Bearer test',
      fetchImpl,
      sleep: vi.fn(async () => {}),
    })

    expect(result).toMatchObject({
      timedOut: false,
      job: {
        status: 'WAITING_FOR_APPROVAL',
        awaitingApproval: true,
      },
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('returns the latest state when polling times out', async () => {
    let now = 0
    const result = await waitForAutomationJob('job-1', {
      authorization: 'Bearer test',
      fetchImpl: vi.fn().mockResolvedValue(response('RUNNING')),
      sleep: vi.fn(async () => { now += 1_000 }),
      now: () => now,
      timeoutMs: 1_000,
      pollIntervalMs: 250,
    })

    expect(result.timedOut).toBe(true)
    expect(result.job.status).toBe('RUNNING')
  })
})
