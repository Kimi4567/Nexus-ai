import { afterEach, describe, expect, it } from 'vitest'
import {
  getLifecycleDatabaseReadiness,
  isLifecycleMessagingRequested,
  isLifecycleRuntimeConfigured,
  lifecycleUnavailableResponse,
} from '@/lib/lifecycleReadiness'

const original = { ...process.env }

afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key]
  for (const [key, value] of Object.entries(original)) process.env[key] = value
})
describe('lifecycle control-plane readiness', () => {
  it('requires the explicit flag and independent server-only keys', () => {
    delete process.env.LIFECYCLE_MESSAGING_ENABLED
    delete process.env.CONTACT_SUPPRESSION_HASH_KEY
    delete process.env.UNSUBSCRIBE_SIGNING_SECRET
    expect(isLifecycleMessagingRequested()).toBe(false)
    expect(isLifecycleRuntimeConfigured()).toBe(false)
    expect(lifecycleUnavailableResponse().code).toBe('LIFECYCLE_MESSAGING_DISABLED')
  })

  it('probes both lifecycle tables before reporting ready', async () => {
    const client = {
      contactSuppression: { findFirst: async () => null },
      lifecycleMessage: { findFirst: async () => null },
    }
    await expect(getLifecycleDatabaseReadiness(client)).resolves.toEqual({
      ready: true, reachable: true, suppressions: true, messages: true, state: 'ready',
    })
  })

  it('reports missing schema without exposing raw database details', async () => {
    const client = {
      contactSuppression: { findFirst: async () => { throw { code: 'P2021', meta: { table: 'ContactSuppression' } } } },
      lifecycleMessage: { findFirst: async () => null },
    }
    const readiness = await getLifecycleDatabaseReadiness(client)
    expect(readiness.state).toBe('migration_required')
    expect(JSON.stringify(lifecycleUnavailableResponse(readiness))).not.toContain('ContactSuppression')
  })
})
