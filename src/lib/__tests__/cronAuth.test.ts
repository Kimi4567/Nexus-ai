import { afterEach, describe, expect, it } from 'vitest'
import { cronAuthError } from '@/lib/cronAuth'

const originalSecret = process.env.CRON_SECRET

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = originalSecret
})

describe('cronAuthError', () => {
  it('fails closed when the server secret is missing', async () => {
    delete process.env.CRON_SECRET
    const response = cronAuthError(new Request('http://localhost/cron'))
    expect(response?.status).toBe(500)
  })

  it('rejects missing and invalid bearer credentials', () => {
    process.env.CRON_SECRET = 'secret'
    expect(cronAuthError(new Request('http://localhost/cron'))?.status).toBe(401)
    expect(cronAuthError(new Request('http://localhost/cron', {
      headers: { Authorization: 'Bearer wrong' },
    }))?.status).toBe(401)
  })

  it('accepts only the exact bearer secret', () => {
    process.env.CRON_SECRET = 'secret'
    expect(cronAuthError(new Request('http://localhost/cron', {
      headers: { Authorization: 'Bearer secret' },
    }))).toBeNull()
  })
})
