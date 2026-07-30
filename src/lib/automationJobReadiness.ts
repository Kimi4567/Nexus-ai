import { prisma } from '@/lib/prisma'

type AutomationJobSchemaClient = {
  automationJob: { findFirst(args: { select: { id: true } }): Promise<unknown> }
  automationJobStep: { findFirst(args: { select: { id: true } }): Promise<unknown> }
}

export interface AutomationJobDatabaseReadiness {
  ready: boolean
  reachable: boolean
  jobs: boolean
  steps: boolean
  state: 'ready' | 'migration_required' | 'database_unavailable'
}

function prismaErrorCode(error: unknown): string | null {
  return error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string'
    ? (error as { code: string }).code
    : null
}

export function isAutomationJobMigrationRequiredError(error: unknown): boolean {
  return ['P2021', 'P2022'].includes(prismaErrorCode(error) || '')
}

/** Read-only fail-closed probe for the durable automation queue schema. */
export async function getAutomationJobDatabaseReadiness(
  client: AutomationJobSchemaClient = prisma,
): Promise<AutomationJobDatabaseReadiness> {
  try {
    await client.automationJob.findFirst({ select: { id: true } })
    await client.automationJobStep.findFirst({ select: { id: true } })
    return {
      ready: true,
      reachable: true,
      jobs: true,
      steps: true,
      state: 'ready',
    }
  } catch (error) {
    if (isAutomationJobMigrationRequiredError(error)) {
      return {
        ready: false,
        reachable: true,
        jobs: false,
        steps: false,
        state: 'migration_required',
      }
    }
    return {
      ready: false,
      reachable: false,
      jobs: false,
      steps: false,
      state: 'database_unavailable',
    }
  }
}
