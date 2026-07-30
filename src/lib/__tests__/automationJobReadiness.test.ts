import { describe, expect, it } from 'vitest'
import { getAutomationJobDatabaseReadiness } from '@/lib/automationJobReadiness'

describe('automation job database readiness', () => {
  it('requires both durable queue tables', async () => {
    const readiness = await getAutomationJobDatabaseReadiness({
      automationJob: { findFirst: async () => null },
      automationJobStep: { findFirst: async () => null },
    })
    expect(readiness).toEqual({
      ready: true,
      reachable: true,
      jobs: true,
      steps: true,
      state: 'ready',
    })
  })

  it('classifies a missing migration without leaking a table name', async () => {
    const readiness = await getAutomationJobDatabaseReadiness({
      automationJob: {
        findFirst: async () => {
          throw { code: 'P2021', meta: { table: 'AutomationJob' } }
        },
      },
      automationJobStep: { findFirst: async () => null },
    })
    expect(readiness).toEqual({
      ready: false,
      reachable: true,
      jobs: false,
      steps: false,
      state: 'migration_required',
    })
    expect(JSON.stringify(readiness)).not.toContain('AutomationJob')
  })
})
