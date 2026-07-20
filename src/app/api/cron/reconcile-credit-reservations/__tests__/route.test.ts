import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ reconcile: vi.fn() }))
vi.mock('@/lib/credits/reconcileReservations', () => ({
  reconcileStaleCreditReservations: mocks.reconcile,
}))

import { GET } from '@/app/api/cron/reconcile-credit-reservations/route'

function request(secret = 'test-secret') {
  return new NextRequest('http://localhost/api/cron/reconcile-credit-reservations', {
    headers: { authorization: `Bearer ${secret}` },
  })
}

describe('GET /api/cron/reconcile-credit-reservations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', 'test-secret')
  })

  it('fails closed without the cron secret', async () => {
    const response = await GET(request('wrong'))
    expect(response.status).toBe(401)
    expect(mocks.reconcile).not.toHaveBeenCalled()
  })

  it('returns the exact reconciliation result', async () => {
    mocks.reconcile.mockResolvedValue({ scanned: 2, refunded: 2, alreadyResolved: 0, failed: 0, failures: [] })
    const response = await GET(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      reconciliation: { scanned: 2, refunded: 2, alreadyResolved: 0, failed: 0, failures: [] },
    })
  })

  it('keeps the cron unhealthy while any refund still needs reconciliation', async () => {
    mocks.reconcile.mockResolvedValue({ scanned: 1, refunded: 0, alreadyResolved: 0, failed: 1, failures: [{ transactionId: 'txn-1', error: 'db' }] })
    const response = await GET(request())
    expect(response.status).toBe(503)
  })
})
