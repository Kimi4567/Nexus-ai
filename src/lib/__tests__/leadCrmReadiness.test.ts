import { afterEach, describe, expect, it } from 'vitest'
import {
  getLeadCrmDatabaseReadiness,
  isLeadCrmRequested,
  leadCrmUnavailableResponse,
} from '@/lib/leadCrmReadiness'

const originalFlag = process.env.LEADS_CRM_ENABLED

afterEach(() => {
  if (originalFlag === undefined) delete process.env.LEADS_CRM_ENABLED
  else process.env.LEADS_CRM_ENABLED = originalFlag
})

describe('lead CRM readiness', () => {
  it('requires an explicit server-side activation flag', () => {
    delete process.env.LEADS_CRM_ENABLED
    expect(isLeadCrmRequested()).toBe(false)
    expect(leadCrmUnavailableResponse().code).toBe('LEAD_CRM_DISABLED')
  })

  it('probes every CRM operational table before reporting ready', async () => {
    const client = {
      lead: { findFirst: async () => null },
      leadActivity: { findFirst: async () => null },
      leadTask: { findFirst: async () => null },
      leadCaptureForm: { findFirst: async () => null },
    }
    await expect(getLeadCrmDatabaseReadiness(client)).resolves.toMatchObject({
      ready: true, leads: true, activities: true, tasks: true, captureForms: true, outcomeMeasurement: true, state: 'ready',
    })
  })

  it('reports a missing migration without exposing database errors', async () => {
    const client = {
      lead: { findFirst: async () => { throw { code: 'P2021', meta: { table: 'Lead' } } } },
      leadActivity: { findFirst: async () => null },
      leadTask: { findFirst: async () => null },
      leadCaptureForm: { findFirst: async () => null },
    }
    const readiness = await getLeadCrmDatabaseReadiness(client)
    expect(readiness).toEqual({
      ready: false, reachable: true, leads: false, activities: false, tasks: false, captureForms: false, outcomeMeasurement: false, state: 'migration_required',
    })
    process.env.LEADS_CRM_ENABLED = 'true'
    expect(JSON.stringify(leadCrmUnavailableResponse(readiness))).not.toContain('LeadActivity')
  })
})
