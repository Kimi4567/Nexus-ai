import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  cronAuthError: vi.fn(),
  runtimeConfig: vi.fn(),
  databaseReadiness: vi.fn(),
  aiProviderHealth: vi.fn(),
  automationJobReadiness: vi.fn(),
}))

vi.mock('@/lib/cronAuth', () => ({ cronAuthError: mocks.cronAuthError }))
vi.mock('@/lib/runtimeConfig', () => ({ getRuntimeConfig: mocks.runtimeConfig }))
vi.mock('@/lib/billingDatabaseReadiness', () => ({
  getBillingDatabaseReadiness: mocks.databaseReadiness,
}))
vi.mock('@/lib/ai/providerHealth', () => ({
  checkAiProviderHealth: mocks.aiProviderHealth,
}))
vi.mock('@/lib/automationJobReadiness', () => ({
  getAutomationJobDatabaseReadiness: mocks.automationJobReadiness,
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
  mocks.aiProviderHealth.mockResolvedValue({
    configured: true,
    ready: true,
    reachable: true,
    provider: 'OpenAI',
    model: 'gpt-4o-mini',
    state: 'healthy',
    status: 200,
    latencyMs: 25,
    checkedAt: '2026-07-29T00:00:00.000Z',
  })
  mocks.automationJobReadiness.mockResolvedValue({
    ready: true,
    reachable: true,
    jobs: true,
    steps: true,
    state: 'ready',
  })
})
describe('GET /api/health', () => {
  it('keeps liveness tiny and does not query detailed database readiness', async () => {
    const response = await GET(request(false))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ ok: true, service: 'nexus-ai' })
    expect(mocks.databaseReadiness).not.toHaveBeenCalled()
    expect(mocks.aiProviderHealth).not.toHaveBeenCalled()
    expect(mocks.automationJobReadiness).not.toHaveBeenCalled()
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
    expect(body.aiProvider).toMatchObject({
      ready: true,
      provider: 'OpenAI',
      state: 'healthy',
    })
    expect(body.automationJobsDatabase).toMatchObject({
      ready: true,
      jobs: true,
      steps: true,
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

  it('fails readiness when the configured AI provider cannot serve work', async () => {
    mocks.aiProviderHealth.mockResolvedValue({
      configured: true,
      ready: false,
      reachable: true,
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
      state: 'authentication_failed',
      status: 401,
      latencyMs: 20,
      checkedAt: '2026-07-29T00:00:00.000Z',
    })

    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.ok).toBe(false)
    expect(body.aiProvider).toMatchObject({
      ready: false,
      state: 'authentication_failed',
      status: 401,
    })
  })

  it('fails readiness until the durable automation migration is applied', async () => {
    mocks.automationJobReadiness.mockResolvedValue({
      ready: false,
      reachable: true,
      jobs: false,
      steps: false,
      state: 'migration_required',
    })

    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.ok).toBe(false)
    expect(body.automationJobsDatabase.state).toBe('migration_required')
  })
})
