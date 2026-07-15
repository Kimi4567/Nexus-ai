import { prisma } from '@/lib/prisma'
import {
  EXECUTION_MONITOR_COOLDOWN_HOURS,
  EXECUTION_MONITOR_VERSION,
  planExecutionMonitorSuggestions,
  type ExecutionMonitorSuggestionPlan,
} from '@/lib/executionMonitor'
import { getWorkspaceExecutionTruthByWorkspaceId } from '@/lib/executionTruthService'

export interface ExecutionMonitorResult {
  workspaceId: string
  campaignsChecked: number
  actionsDetected: number
  suggestionsCreated: number
  suggestionsSuppressed: number
  skippedBecauseLocked: boolean
  dryRun: boolean
  signatures: string[]
}

function payloadRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function existingSignature(suggestion: { campaignId: string | null; title: string; payload: unknown }): string {
  const payload = payloadRecord(suggestion.payload)
  return typeof payload.signature === 'string'
    ? payload.signature
    : `legacy:${suggestion.campaignId ?? 'none'}:${suggestion.title}`
}

function resultBase(
  workspaceId: string,
  plans: ExecutionMonitorSuggestionPlan[],
  campaignsChecked: number,
  dryRun: boolean,
): ExecutionMonitorResult {
  return {
    workspaceId,
    campaignsChecked,
    actionsDetected: plans.length,
    suggestionsCreated: 0,
    suggestionsSuppressed: 0,
    skippedBecauseLocked: false,
    dryRun,
    signatures: plans.map((plan) => plan.signature),
  }
}

export async function monitorWorkspaceExecution(
  workspaceId: string,
  options: { now?: Date; dryRun?: boolean } = {},
): Promise<ExecutionMonitorResult> {
  const now = options.now ?? new Date()
  const dryRun = options.dryRun ?? false
  const truth = await getWorkspaceExecutionTruthByWorkspaceId(workspaceId)
  const plans = planExecutionMonitorSuggestions(truth)
  const base = resultBase(workspaceId, plans, truth.campaigns.length, dryRun)

  if (dryRun) return base

  const cooldownStart = new Date(now.getTime() - EXECUTION_MONITOR_COOLDOWN_HOURS * 60 * 60 * 1000)
  const campaignIds = [...new Set(plans.map((plan) => plan.campaignId))]

  return prisma.$transaction(async (tx) => {
    const lockRows = await tx.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_xact_lock(hashtext(${`nexus:execution-monitor:${workspaceId}`})) AS locked
    `
    if (!lockRows[0]?.locked) return { ...base, skippedBecauseLocked: true }

    // One batched query prevents N+1 checks. Active pending suggestions remain
    // suppressed regardless of age; resolved suggestions use a 24-hour cooldown.
    const recent = plans.length > 0
      ? await (tx.agentSuggestion as any).findMany({
          where: {
            workspaceId,
            campaignId: { in: campaignIds },
            OR: [
              {
                status: 'PENDING',
                AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
              },
              { createdAt: { gte: cooldownStart } },
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: 200,
          select: { campaignId: true, title: true, payload: true },
        }) as Array<{ campaignId: string | null; title: string; payload: unknown }>
      : []

    const existing = new Set(recent.map(existingSignature))
    const fresh = plans.filter((plan) => !existing.has(plan.signature))
    const agentRun = await (tx.agentRun as any).create({
      data: {
        workspaceId,
        agent: 'CAMPAIGN_MANAGER',
        status: 'COMPLETED',
        triggeredBy: 'execution-monitor',
        inputData: {
          source: 'execution-truth',
          monitorVersion: EXECUTION_MONITOR_VERSION,
          performanceClaim: false,
        },
        outputData: {
          truthSummary: truth.summary,
          actionsDetected: plans.length,
          suggestionsCreated: fresh.length,
          suggestionsSuppressed: plans.length - fresh.length,
          signatures: fresh.map((plan) => plan.signature),
        },
        completedAt: now,
      },
      select: { id: true },
    })

    if (fresh.length > 0) await (tx.agentSuggestion as any).createMany({
      data: fresh.map((plan) => ({
        workspaceId,
        agentRunId: agentRun.id,
        agent: plan.agent,
        type: plan.type,
        status: 'PENDING',
        priority: plan.priority,
        title: plan.title,
        reasoning: plan.reasoning,
        impact: plan.impact,
        payload: plan.payload,
        campaignId: plan.campaignId,
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      })),
    })

    return {
      ...base,
      suggestionsCreated: fresh.length,
      suggestionsSuppressed: plans.length - fresh.length,
      signatures: fresh.map((plan) => plan.signature),
    }
  }, { timeout: 10_000 })
}
