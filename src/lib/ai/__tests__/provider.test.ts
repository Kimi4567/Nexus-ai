import { afterEach, describe, expect, it, vi } from 'vitest'
import { getVideoProviderApiKey, isVideoProviderConfigured } from '../provider'

describe('video provider configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('accepts a canonical Runway key', () => {
    vi.stubEnv('RUNWAYML_API_SECRET', '  key_canonical  ')

    expect(getVideoProviderApiKey()).toBe('key_canonical')
    expect(isVideoProviderConfigured()).toBe(true)
  })

  it('accepts the legacy environment variable when the key format is valid', () => {
    vi.stubEnv('RUNWAYML_API_SECRET', '')
    vi.stubEnv('RUNWAY_API_KEY', '')
    vi.stubEnv('RUNWAY_ML_API_KEY', 'key_legacy')

    expect(getVideoProviderApiKey()).toBe('key_legacy')
    expect(isVideoProviderConfigured()).toBe(true)
  })

  it('rejects a non-empty malformed value before any credit reservation', () => {
    vi.stubEnv('RUNWAYML_API_SECRET', '')
    vi.stubEnv('RUNWAY_API_KEY', '')
    vi.stubEnv('RUNWAY_ML_API_KEY', 'not-a-runway-key')

    expect(getVideoProviderApiKey()).toBeNull()
    expect(isVideoProviderConfigured()).toBe(false)
  })
})
