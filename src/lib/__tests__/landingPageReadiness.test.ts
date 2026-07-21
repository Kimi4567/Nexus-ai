import { afterEach, describe, expect, it } from 'vitest'
import {
  getLandingPageDatabaseReadiness,
  hasStrongCroEventHashKey,
  isLandingPagesRequested,
  isLandingPagesRuntimeConfigured,
  landingPagesUnavailableResponse,
} from '@/lib/landingPageReadiness'

const original = { ...process.env }

afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key]
  for (const [key, value] of Object.entries(original)) process.env[key] = value
})

describe('landing page readiness', () => {
  it('requires an explicit flag, CRM, and a strong independent HMAC key', () => {
    delete process.env.LANDING_PAGES_ENABLED
    process.env.LEADS_CRM_ENABLED = 'true'
    process.env.CRO_EVENT_HASH_KEY = 'short'
    expect(isLandingPagesRequested()).toBe(false)
    expect(hasStrongCroEventHashKey()).toBe(false)
    expect(isLandingPagesRuntimeConfigured()).toBe(false)
    expect(landingPagesUnavailableResponse().code).toBe('LANDING_PAGES_DISABLED')
  })

  it('probes pages, revisions, and conversion events before reporting ready', async () => {
    const client = {
      landingPage: { findFirst: async () => null },
      landingPageRevision: { findFirst: async () => null },
      conversionEvent: { findFirst: async () => null },
    }
    await expect(getLandingPageDatabaseReadiness(client)).resolves.toMatchObject({
      ready: true, landingPages: true, seoFoundation: true, revisions: true, conversionEvents: true, state: 'ready',
    })
  })

  it('redacts a missing table while reporting that the migration is required', async () => {
    const client = {
      landingPage: { findFirst: async () => { throw { code: 'P2021', meta: { table: 'LandingPage' } } } },
      landingPageRevision: { findFirst: async () => null },
      conversionEvent: { findFirst: async () => null },
    }
    const readiness = await getLandingPageDatabaseReadiness(client)
    process.env.LANDING_PAGES_ENABLED = 'true'
    process.env.LEADS_CRM_ENABLED = 'true'
    process.env.CRO_EVENT_HASH_KEY = 'a'.repeat(32)
    expect(readiness.state).toBe('migration_required')
    expect(JSON.stringify(landingPagesUnavailableResponse(readiness))).not.toContain('LandingPage')
  })
})
