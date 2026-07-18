import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { captureOperationalError } from '@/lib/observability/operationalError'

const ORIGINAL_ENV = { ...process.env }

describe('captureOperationalError', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, SENTRY_ENABLED: 'false' }
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    vi.restoreAllMocks()
  })

  it('keeps a useful local signal without logging the raw provider error', async () => {
    const result = await captureOperationalError(
      Object.assign(new Error('Provider leaked owner@example.com token=private'), { code: 'PROVIDER_502' }),
      {
        operation: 'publishing.provider-submit',
        route: '/api/social/publish',
        component: 'publishing',
        method: 'POST',
        statusCode: 502,
        retryable: true,
      },
    )

    expect(result).toEqual({
      reportedExternally: false,
      errorName: 'Error',
      errorCode: 'PROVIDER_502',
    })
    expect(console.error).toHaveBeenCalledTimes(1)

    const logged = String(vi.mocked(console.error).mock.calls[0]?.[0])
    expect(logged).toContain('publishing.provider-submit')
    expect(logged).toContain('PROVIDER_502')
    expect(logged).not.toContain('owner@example.com')
    expect(logged).not.toContain('private')
  })
})
