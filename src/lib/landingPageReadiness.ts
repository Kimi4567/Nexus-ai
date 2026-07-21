import { prisma } from '@/lib/prisma'

type LandingPageSchemaClient = {
  landingPage: { findFirst(args: { select: { id: true; seoIndexable: true; publishedSeoIndexable: true } }): Promise<unknown> }
  landingPageRevision: { findFirst(args: { select: { id: true } }): Promise<unknown> }
  conversionEvent: { findFirst(args: { select: { id: true } }): Promise<unknown> }
}

export type LandingPageDatabaseReadiness = {
  ready: boolean
  reachable: boolean
  landingPages: boolean
  seoFoundation: boolean
  revisions: boolean
  conversionEvents: boolean
  state: 'ready' | 'migration_required' | 'database_unavailable'
}

function prismaErrorCode(error: unknown): string | null {
  return error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string'
    ? (error as { code: string }).code
    : null
}

export function isLandingPagesRequested(): boolean {
  return process.env.LANDING_PAGES_ENABLED === 'true'
}

export function hasStrongCroEventHashKey(): boolean {
  return (process.env.CRO_EVENT_HASH_KEY?.trim().length ?? 0) >= 32
}

export function isLandingPagesRuntimeConfigured(): boolean {
  return hasStrongCroEventHashKey() && process.env.LEADS_CRM_ENABLED === 'true'
}

export async function getLandingPageDatabaseReadiness(
  client: LandingPageSchemaClient = prisma,
): Promise<LandingPageDatabaseReadiness> {
  try {
    await client.landingPage.findFirst({ select: { id: true, seoIndexable: true, publishedSeoIndexable: true } })
    await client.landingPageRevision.findFirst({ select: { id: true } })
    await client.conversionEvent.findFirst({ select: { id: true } })
    return {
      ready: true,
      reachable: true,
      landingPages: true,
      seoFoundation: true,
      revisions: true,
      conversionEvents: true,
      state: 'ready',
    }
  } catch (error) {
    const migrationMissing = ['P2021', 'P2022'].includes(prismaErrorCode(error) || '')
    return migrationMissing
      ? {
          ready: false,
          reachable: true,
          landingPages: false,
          seoFoundation: false,
          revisions: false,
          conversionEvents: false,
          state: 'migration_required',
        }
      : {
          ready: false,
          reachable: false,
          landingPages: false,
          seoFoundation: false,
          revisions: false,
          conversionEvents: false,
          state: 'database_unavailable',
        }
  }
}

export function landingPagesUnavailableResponse(readiness?: LandingPageDatabaseReadiness) {
  if (!isLandingPagesRequested()) {
    return { error: 'Landing pages are not enabled in this environment.', code: 'LANDING_PAGES_DISABLED' }
  }
  if (!hasStrongCroEventHashKey()) {
    return { error: 'Landing page conversion evidence is not safely configured.', code: 'LANDING_PAGES_HASH_KEY_REQUIRED' }
  }
  if (process.env.LEADS_CRM_ENABLED !== 'true') {
    return { error: 'Landing pages require the Lead CRM capture layer.', code: 'LANDING_PAGES_LEAD_CRM_REQUIRED' }
  }
  return readiness?.state === 'migration_required'
    ? { error: 'Landing page database migration is required before this feature can be enabled.', code: 'LANDING_PAGES_MIGRATION_REQUIRED' }
    : { error: 'Landing page database readiness could not be verified.', code: 'LANDING_PAGES_DATABASE_UNAVAILABLE' }
}
