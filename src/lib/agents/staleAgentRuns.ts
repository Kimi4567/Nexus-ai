import { prisma } from '@/lib/prisma'

export const STALE_AGENT_RUN_TIMEOUT_MINUTES = 15
export const STALE_AGENT_RUN_ERROR =
  'STALE_RUN_RECONCILED: Agent run exceeded the 15-minute execution lease and was closed as failed.'

export interface StaleAgentRunReconciliation {
  cutoff: Date
  found: number
  reconciled: number
  dryRun: boolean
}

/**
 * Agent runs are request-bound today; no durable worker can legitimately keep
 * one RUNNING beyond this lease. Closing stale rows as FAILED preserves honest
 * operational history and prevents dashboards from presenting dead work as live.
 */
export async function reconcileStaleAgentRuns(
  options: { now?: Date; dryRun?: boolean } = {},
): Promise<StaleAgentRunReconciliation> {
  const now = options.now ?? new Date()
  const dryRun = options.dryRun ?? false
  const cutoff = new Date(now.getTime() - STALE_AGENT_RUN_TIMEOUT_MINUTES * 60_000)
  const where = {
    status: 'RUNNING' as const,
    createdAt: { lte: cutoff },
  }

  if (dryRun) {
    const found = await prisma.agentRun.count({ where })
    return { cutoff, found, reconciled: 0, dryRun: true }
  }

  const result = await prisma.agentRun.updateMany({
    where,
    data: {
      status: 'FAILED',
      completedAt: now,
      error: STALE_AGENT_RUN_ERROR,
    },
  })

  return {
    cutoff,
    found: result.count,
    reconciled: result.count,
    dryRun: false,
  }
}
