import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getLandingExperimentDatabaseReadiness,
  isLandingPageExperimentsRequested,
  landingExperimentsUnavailableResponse,
} from '@/lib/landingPageExperimentReadiness'

afterEach(() => vi.unstubAllEnvs())

describe('landing-page experiment readiness', () => {
  it('remains disabled unless explicitly requested', () => {
    vi.stubEnv('LANDING_PAGE_EXPERIMENTS_ENABLED', 'false')
    expect(isLandingPageExperimentsRequested()).toBe(false)
    expect(landingExperimentsUnavailableResponse()).toMatchObject({ code: 'LANDING_EXPERIMENTS_DISABLED' })
  })

  it('redacts a missing table as migration_required', async () => {
    const readiness = await getLandingExperimentDatabaseReadiness({
      landingPageExperiment: { findFirst: vi.fn().mockRejectedValue({ code: 'P2021', message: 'sensitive details' }) },
      conversionEvent: { findFirst: vi.fn() },
    })
    expect(readiness).toEqual({ ready: false, reachable: true, experiments: false, assignments: false, state: 'migration_required' })
    expect(JSON.stringify(readiness)).not.toContain('sensitive')
  })
})
