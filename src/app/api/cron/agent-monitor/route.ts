/**
 * GET /api/cron/agent-monitor
 *
 * Low-cost continuous execution monitor. Vercel invokes this hourly, while a
 * deterministic 24-way workspace shard means each workspace is evaluated once
 * per UTC day. The dashboard Execution Queue remains real-time on page load.
 *
 * This route never calls an AI model, publishes content, changes budgets, or
 * invents performance metrics. It only creates approval suggestions backed by
 * Execution Truth evidence.
 * The fetch-analytics cron owns that performance-learning path; this monitor
 * only reports its owner as metadata for operational visibility.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { monitorWorkspaceExecution } from '@/lib/executionMonitorService'
import { cronAuthError } from '@/lib/cronAuth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type WorkspaceRow = { id: string }

async function workspacesForRun(req: NextRequest, now: Date): Promise<{
  rows: WorkspaceRow[]
  shard: number | null
  capped: boolean
}> {
  const requestedWorkspaceId = req.nextUrl.searchParams.get('workspaceId')?.trim()
  if (requestedWorkspaceId) {
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: requestedWorkspaceId,
        campaigns: { some: { status: { not: 'ARCHIVED' } } },
      },
      select: { id: true },
    })
    return { rows: workspace ? [workspace] : [], shard: null, capped: false }
  }

  const shard = now.getUTCHours()
  const limit = 100
  const rows = await prisma.$queryRawUnsafe<WorkspaceRow[]>(
    `SELECT w."id"
       FROM "Workspace" w
      WHERE mod(abs(hashtext(w."id")::bigint), 24) = $1
        AND EXISTS (
          SELECT 1
            FROM "Campaign" c
           WHERE c."workspaceId" = w."id"
             AND c."status" <> 'ARCHIVED'
        )
      ORDER BY w."id"
      LIMIT $2`,
    shard,
    limit + 1,
  )

  return { rows: rows.slice(0, limit), shard, capped: rows.length > limit }
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now()
  const authError = cronAuthError(req)
  if (authError) return authError

  const now = new Date()
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'
  const selection = await workspacesForRun(req, now)
  const totals = {
    workspacesSelected: selection.rows.length,
    workspacesChecked: 0,
    campaignsChecked: 0,
    actionsDetected: 0,
    suggestionsCreated: 0,
    suggestionsSuppressed: 0,
    skippedBecauseLocked: 0,
    errors: [] as string[],
  }

  // Small batches protect the Postgres connection pool while avoiding the old
  // one-workspace-at-a-time N+1 latency.
  for (let index = 0; index < selection.rows.length; index += 4) {
    const batch = selection.rows.slice(index, index + 4)
    const settled = await Promise.allSettled(
      batch.map((workspace) => monitorWorkspaceExecution(workspace.id, { now, dryRun })),
    )
    settled.forEach((result, offset) => {
      const workspaceId = batch[offset]?.id ?? 'unknown'
      if (result.status === 'rejected') {
        const message = result.reason instanceof Error ? result.reason.message : 'Unknown monitor error'
        totals.errors.push(`Workspace ${workspaceId}: ${message}`)
        return
      }
      totals.workspacesChecked++
      totals.campaignsChecked += result.value.campaignsChecked
      totals.actionsDetected += result.value.actionsDetected
      totals.suggestionsCreated += result.value.suggestionsCreated
      totals.suggestionsSuppressed += result.value.suggestionsSuppressed
      if (result.value.skippedBecauseLocked) totals.skippedBecauseLocked++
    })
  }

  const durationMs = Date.now() - startedAt
  console.log('[execution-monitor]', JSON.stringify({
    shard: selection.shard,
    dryRun,
    capped: selection.capped,
    durationMs,
    ...totals,
  }))

  return NextResponse.json({
    ok: totals.errors.length === 0,
    monitor: 'execution-truth',
    monitorVersion: 1,
    mode: 'deterministic-no-ai',
    performanceClaims: false,
    autoExecution: false,
    performanceLearningOwner: 'fetch-analytics',
    dryRun,
    shard: selection.shard,
    capped: selection.capped,
    durationMs,
    ...totals,
    ts: now.toISOString(),
  })
}
