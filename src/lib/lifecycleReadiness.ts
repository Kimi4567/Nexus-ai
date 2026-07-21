import { prisma } from '@/lib/prisma'

type LifecycleSchemaClient = {
  contactSuppression: { findFirst(args: { select: { id: true } }): Promise<unknown> }
  lifecycleMessage: { findFirst(args: { select: { id: true } }): Promise<unknown> }
}

export type LifecycleDatabaseReadiness = {
  ready: boolean
  reachable: boolean
  suppressions: boolean
  messages: boolean
  state: 'ready' | 'migration_required' | 'database_unavailable'
}

function prismaErrorCode(error: unknown): string | null {
  return error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string'
    ? (error as { code: string }).code
    : null
}

export function isLifecycleMessagingRequested(): boolean {
  return process.env.LIFECYCLE_MESSAGING_ENABLED === 'true'
}

export function isLifecycleRuntimeConfigured(): boolean {
  return ['CONTACT_SUPPRESSION_HASH_KEY', 'UNSUBSCRIBE_SIGNING_SECRET'].every(name => {
    const value = process.env[name]?.trim()
    return Boolean(value && value.length >= 32)
  })
}

export async function getLifecycleDatabaseReadiness(
  client: LifecycleSchemaClient = prisma,
): Promise<LifecycleDatabaseReadiness> {
  try {
    await client.contactSuppression.findFirst({ select: { id: true } })
    await client.lifecycleMessage.findFirst({ select: { id: true } })
    return { ready: true, reachable: true, suppressions: true, messages: true, state: 'ready' }
  } catch (error) {
    const migrationMissing = ['P2021', 'P2022'].includes(prismaErrorCode(error) || '')
    return migrationMissing
      ? { ready: false, reachable: true, suppressions: false, messages: false, state: 'migration_required' }
      : { ready: false, reachable: false, suppressions: false, messages: false, state: 'database_unavailable' }
  }
}

export function lifecycleUnavailableResponse(readiness?: LifecycleDatabaseReadiness) {
  if (!isLifecycleMessagingRequested()) {
    return {
      error: 'Customer lifecycle messaging is not enabled in this environment.',
      code: 'LIFECYCLE_MESSAGING_DISABLED',
    }
  }
  return readiness?.state === 'migration_required'
    ? {
        error: 'Customer lifecycle database migration is required before this feature can be enabled.',
        code: 'LIFECYCLE_MIGRATION_REQUIRED',
      }
    : {
        error: 'Customer lifecycle database readiness could not be verified.',
        code: 'LIFECYCLE_DATABASE_UNAVAILABLE',
      }
}

export async function lifecycleGate() {
  if (!isLifecycleMessagingRequested()) {
    return { ready: false as const, body: lifecycleUnavailableResponse() }
  }
  if (!isLifecycleRuntimeConfigured()) {
    return {
      ready: false as const,
      body: {
        error: 'Customer lifecycle HMAC keys are not configured.',
        code: 'LIFECYCLE_RUNTIME_INCOMPLETE',
      },
    }
  }
  const database = await getLifecycleDatabaseReadiness()
  return database.ready
    ? { ready: true as const }
    : { ready: false as const, body: lifecycleUnavailableResponse(database) }
}
