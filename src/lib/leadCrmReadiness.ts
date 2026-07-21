import { prisma } from '@/lib/prisma'

type LeadSchemaClient = {
  lead: { findFirst(args: { select: {
    id: true
    convertedAt: true
    conversionValue: true
    conversionCurrency: true
    conversionValueSource: true
  } }): Promise<unknown> }
  leadActivity: { findFirst(args: { select: { id: true } }): Promise<unknown> }
  leadTask: { findFirst(args: { select: { id: true } }): Promise<unknown> }
  leadCaptureForm: { findFirst(args: { select: { id: true } }): Promise<unknown> }
}

export type LeadCrmDatabaseReadiness = {
  ready: boolean
  reachable: boolean
  leads: boolean
  activities: boolean
  tasks: boolean
  captureForms: boolean
  outcomeMeasurement: boolean
  state: 'ready' | 'migration_required' | 'database_unavailable'
}

function prismaErrorCode(error: unknown): string | null {
  return error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string'
    ? (error as { code: string }).code
    : null
}

export function isLeadCrmRequested(): boolean {
  return process.env.LEADS_CRM_ENABLED === 'true'
}

export async function getLeadCrmDatabaseReadiness(
  client: LeadSchemaClient = prisma,
): Promise<LeadCrmDatabaseReadiness> {
  try {
    await client.lead.findFirst({ select: {
      id: true,
      convertedAt: true,
      conversionValue: true,
      conversionCurrency: true,
      conversionValueSource: true,
    } })
    await client.leadActivity.findFirst({ select: { id: true } })
    await client.leadTask.findFirst({ select: { id: true } })
    await client.leadCaptureForm.findFirst({ select: { id: true } })
    return {
      ready: true,
      reachable: true,
      leads: true,
      activities: true,
      tasks: true,
      captureForms: true,
      outcomeMeasurement: true,
      state: 'ready',
    }
  } catch (error) {
    const migrationMissing = ['P2021', 'P2022'].includes(prismaErrorCode(error) || '')
    return migrationMissing
      ? {
          ready: false,
          reachable: true,
          leads: false,
          activities: false,
          tasks: false,
          captureForms: false,
          outcomeMeasurement: false,
          state: 'migration_required',
        }
      : {
          ready: false,
          reachable: false,
          leads: false,
          activities: false,
          tasks: false,
          captureForms: false,
          outcomeMeasurement: false,
          state: 'database_unavailable',
        }
  }
}

export function leadCrmUnavailableResponse(readiness?: LeadCrmDatabaseReadiness) {
  if (!isLeadCrmRequested()) {
    return {
      error: 'Lead CRM is not enabled in this environment.',
      code: 'LEAD_CRM_DISABLED',
    }
  }
  return readiness?.state === 'migration_required'
    ? {
        error: 'Lead CRM database migration is required before this feature can be enabled.',
        code: 'LEAD_CRM_MIGRATION_REQUIRED',
      }
    : {
        error: 'Lead CRM database readiness could not be verified.',
        code: 'LEAD_CRM_DATABASE_UNAVAILABLE',
      }
}
