import { prisma } from '@/lib/prisma'

type BillingSchemaClient = {
  billingWebhookEvent: {
    findFirst(args: { select: { id: true } }): Promise<unknown>
  }
}
export type BillingDatabaseReadiness = {
  ready: boolean
  reachable: boolean
  billingWebhookEvents: boolean
  state: 'ready' | 'migration_required' | 'database_unavailable'
}

function prismaErrorCode(error: unknown): string | null {
  return error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string'
    ? (error as { code: string }).code
    : null
}

/**
 * Read-only fail-closed probe for the durable Stripe event ledger.
 * It returns booleans/status only and never exposes a database URL, table data,
 * or raw provider error to health and billing responses.
 */
export async function getBillingDatabaseReadiness(
  client: BillingSchemaClient = prisma,
): Promise<BillingDatabaseReadiness> {
  try {
    await client.billingWebhookEvent.findFirst({ select: { id: true } })
    return {
      ready: true,
      reachable: true,
      billingWebhookEvents: true,
      state: 'ready',
    }
  } catch (error) {
    const code = prismaErrorCode(error)
    if (code === 'P2021' || code === 'P2022') {
      return {
        ready: false,
        reachable: true,
        billingWebhookEvents: false,
        state: 'migration_required',
      }
    }
    return {
      ready: false,
      reachable: false,
      billingWebhookEvents: false,
      state: 'database_unavailable',
    }
  }
}

export function billingDatabaseUnavailableResponse(readiness: BillingDatabaseReadiness) {
  return readiness.state === 'migration_required'
    ? {
        error: 'Billing database migration is required before checkout can be enabled.',
        code: 'BILLING_MIGRATION_REQUIRED',
      }
    : {
        error: 'Billing database readiness could not be verified.',
        code: 'BILLING_DATABASE_UNAVAILABLE',
      }
}
