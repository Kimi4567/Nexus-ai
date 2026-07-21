import { describe, expect, it } from 'vitest'
import {
  createSocialDisconnectTombstone,
  isSanitizedSocialDisconnectConfig,
} from '@/lib/socialIntegrationDisconnect'

describe('social integration disconnect tombstone', () => {
  it('replaces provider configuration with a minimal non-secret lifecycle record', () => {
    const tombstone = createSocialDisconnectTombstone(new Date('2026-07-20T10:00:00.000Z'))

    expect(tombstone).toEqual({
      schemaVersion: 1,
      lifecycle: 'disconnected',
      disconnectedAt: '2026-07-20T10:00:00.000Z',
      credentialErasure: 'completed',
      providerRevocation: 'not_confirmed',
    })
    expect(JSON.stringify(tombstone)).not.toMatch(/token|secret|scope|page/i)
    expect(isSanitizedSocialDisconnectConfig(tombstone)).toBe(true)
  })

  it('does not accept a tombstone carrying extra credential-bearing data', () => {
    expect(isSanitizedSocialDisconnectConfig({
      ...createSocialDisconnectTombstone(),
      pages: [{ accessToken: 'must-not-survive' }],
    })).toBe(false)
  })
})
