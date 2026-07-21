import { prisma } from '@/lib/prisma'

type ExperimentSchemaClient = {
  landingPageExperiment: { findFirst(args: { select: { id: true } }): Promise<unknown> }
  conversionEvent: { findFirst(args: { select: { experimentId: true; experimentVariant: true } }): Promise<unknown> }
}

export type LandingExperimentDatabaseReadiness = {
  ready: boolean
  reachable: boolean
  experiments: boolean
  assignments: boolean
  state: 'ready' | 'migration_required' | 'database_unavailable'
}

function prismaErrorCode(error: unknown): string | null {
  return error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string'
    ? (error as { code: string }).code
    : null
}

export function isLandingPageExperimentsRequested(): boolean {
  return process.env.LANDING_PAGE_EXPERIMENTS_ENABLED === 'true'
}

export async function getLandingExperimentDatabaseReadiness(
  client: ExperimentSchemaClient = prisma,
): Promise<LandingExperimentDatabaseReadiness> {
  try {
    await client.landingPageExperiment.findFirst({ select: { id: true } })
    await client.conversionEvent.findFirst({ select: { experimentId: true, experimentVariant: true } })
    return { ready: true, reachable: true, experiments: true, assignments: true, state: 'ready' }
  } catch (error) {
    const migrationMissing = ['P2021', 'P2022'].includes(prismaErrorCode(error) || '')
    return migrationMissing
      ? { ready: false, reachable: true, experiments: false, assignments: false, state: 'migration_required' }
      : { ready: false, reachable: false, experiments: false, assignments: false, state: 'database_unavailable' }
  }
}

export function landingExperimentsUnavailableResponse(readiness?: LandingExperimentDatabaseReadiness) {
  if (!isLandingPageExperimentsRequested()) {
    return { error: 'Landing page experiments are not enabled in this environment.', code: 'LANDING_EXPERIMENTS_DISABLED' }
  }
  return readiness?.state === 'migration_required'
    ? { error: 'Landing page experiment migration is required before this feature can be enabled.', code: 'LANDING_EXPERIMENTS_MIGRATION_REQUIRED' }
    : { error: 'Landing page experiment readiness could not be verified.', code: 'LANDING_EXPERIMENTS_DATABASE_UNAVAILABLE' }
}
