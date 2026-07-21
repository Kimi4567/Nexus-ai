import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  cronAuthError: vi.fn(),
  runtimeConfig: vi.fn(),
  databaseReadiness: vi.fn(),
}))

vi.mock('@/lib/cronAuth', () => ({ cronAuthError: mocks.cronAuthError }))
vi.mock('@/lib/runtimeConfig', () => ({ getRuntimeConfig: mocks.runtimeConfig }))
vi.mock('@/lib/billingDatabaseReadiness', () => ({
  getBillingDatabaseReadiness: mocks.databaseReadiness,
}))

import { GET } from '@/app/api/health/route'

function request(detail = true) {
  return new NextRequest(`http://localhost/api/health${detail ? '?detail=1' : ''}`)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.cronAuthError.mockReturnValue(null)
  mocks.runtimeConfig.mockReturnValue({
    ready: true,
    billing: { requested: false },
    wallet: { requested: false },
  })
  mocks.databaseReadiness.mockResolvedValue({
    ready: false,
    reachable: true,
    billingWebhookEvents: false,
    state: 'migration_required',
  })
})
describe('GET /api/health', () => {
  it('keeps liveness tiny and does not query detailed database readiness', async () => {
    const response = await GET(request(false))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ ok: true, service: 'nexus-ai' })
    expect(mocks.databaseReadiness).not.toHaveBeenCalled()
  })

  it('reports a pending billing migration without failing readiness while billing is disabled', async () => {
    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.database).toMatchObject({
      billingSchemaRequired: false,
      billingWebhookEvents: false,
      state: 'migration_required',
    })
  })

  it('fails readiness if an operator requests billing before applying the migration', async () => {
    mocks.runtimeConfig.mockReturnValue({
      ready: true,
      billing: { requested: true },
      wallet: { requested: false },
    })

    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.ok).toBe(false)
    expect(body.database).toMatchObject({
      billingSchemaRequired: true,
      state: 'migration_required',
    })
  })
})
