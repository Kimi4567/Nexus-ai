import { describe, expect, it, vi } from 'vitest'
import {
  billingDatabaseUnavailableResponse,
  getBillingDatabaseReadiness,
} from '@/lib/billingDatabaseReadiness'

function client(findFirst: () => Promise<unknown>) {
  return { billingWebhookEvent: { findFirst: vi.fn(findFirst) } }
}

describe('billing database readiness', () => {
  it('reports ready only when the durable Stripe event ledger is queryable', async () => {
    const result = await getBillingDatabaseReadiness(client(async () => null))

    expect(result).toEqual({
      ready: true,
      reachable: true,
      billingWebhookEvents: true,
      state: 'ready',
    })
  })

  it.each(['P2021', 'P2022'])('treats Prisma %s as a required migration, not an outage', async (code) => {
    const result = await getBillingDatabaseReadiness(client(async () => {
      throw Object.assign(new Error('redacted'), { code })
    }))

    expect(result).toMatchObject({
      ready: false,
      reachable: true,
      billingWebhookEvents: false,
      state: 'migration_required',
    })
    expect(billingDatabaseUnavailableResponse(result).code).toBe('BILLING_MIGRATION_REQUIRED')
  })

  it('fails closed without returning raw database errors when the probe is unavailable', async () => {
    const result = await getBillingDatabaseReadiness(client(async () => {
      throw new Error('database host and secret must never escape')
    }))

    expect(result).toMatchObject({
      ready: false,
      reachable: false,
      state: 'database_unavailable',
    })
    expect(billingDatabaseUnavailableResponse(result)).toEqual({
      error: 'Billing database readiness could not be verified.',
      code: 'BILLING_DATABASE_UNAVAILABLE',
    })
  })
})
