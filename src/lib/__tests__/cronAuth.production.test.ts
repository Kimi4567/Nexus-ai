import { afterEach, describe, expect, it, vi } from 'vitest'
import { cronAuthError } from '@/lib/cronAuth'

const originalNodeEnv = process.env.NODE_ENV
const originalSecret = process.env.CRON_SECRET

afterEach(() => {
  vi.unstubAllEnvs()
  if (originalNodeEnv === undefined) delete (process.env as Record<string, string | undefined>).NODE_ENV
  else vi.stubEnv('NODE_ENV', originalNodeEnv)
  if (originalSecret === undefined) delete (process.env as Record<string, string | undefined>).CRON_SECRET
  else process.env.CRON_SECRET = originalSecret
})

describe('cronAuthError production hardening', () => {
  it('rejects weak production cron secrets before comparing the request', () => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.CRON_SECRET = 'short-secret'
    const response = cronAuthError(new Request('http://localhost/api/cron', {
      headers: { authorization: 'Bearer short-secret' },
    }))
    expect(response?.status).toBe(500)
  })

  it('accepts a strong production secret with the matching bearer header', () => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.CRON_SECRET = 's'.repeat(40)
    const response = cronAuthError(new Request('http://localhost/api/cron', {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    }))
    expect(response).toBeNull()
  })
})
