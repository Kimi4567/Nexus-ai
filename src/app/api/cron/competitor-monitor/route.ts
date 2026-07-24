/**
 * Hourly worker for due public competitor sources.
 *
 * Each source keeps its own cadence (24h by default). The hourly worker only
 * claims due rows, so it does not imply hourly scraping. It creates a baseline
 * on the first successful read and reviewable evidence only on later changes.
 * It never mutates Brand Brain and never calls an AI model.
 */

import { NextRequest, NextResponse } from 'next/server'
import { cronAuthError } from '@/lib/cronAuth'
import { claimDueCompetitorSources, scanCompetitorSource } from '@/lib/competitorMonitoring'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const db = prisma as any

export async function GET(req: NextRequest) {
  const authError = cronAuthError(req)
  if (authError) return authError

  const claimed = await claimDueCompetitorSources(4)
  const byWorkspace = new Map<string, string[]>()
  for (const source of claimed) {
    byWorkspace.set(source.workspaceId, [...(byWorkspace.get(source.workspaceId) ?? []), source.id])
  }

  const summary = {
    workspaces: byWorkspace.size,
    sourcesClaimed: claimed.length,
    sourcesChecked: 0,
    changesDetected: 0,
    signalsCreated: 0,
    errors: [] as string[],
  }

  for (const [workspaceId, sourceIds] of byWorkspace) {
    const run = await db.competitorResearchRun.create({
      data: {
        workspaceId,
        trigger: 'CRON',
        sourcesSelected: sourceIds.length,
      },
    })
    const results = await Promise.all(sourceIds.map(sourceId => scanCompetitorSource(sourceId, 'CRON')))
    const errors = results.flatMap(result => result.error ? [`${result.sourceId}: ${result.error}`] : [])
    const checked = results.filter(result => result.checked).length
    const changes = results.filter(result => result.changed).length
    const signals = results.filter(result => result.signalCreated).length
    summary.sourcesChecked += checked
    summary.changesDetected += changes
    summary.signalsCreated += signals
    summary.errors.push(...errors)

    await db.competitorResearchRun.update({
      where: { id: run.id },
      data: {
        status: errors.length === 0 ? 'COMPLETED' : checked > 0 ? 'PARTIAL' : 'FAILED',
        sourcesChecked: checked,
        changesDetected: changes,
        signalsCreated: signals,
        errors,
        completedAt: new Date(),
      },
    })
  }

  const allFailed = claimed.length > 0 && summary.sourcesChecked === 0
  return NextResponse.json({
    ok: summary.errors.length === 0,
    mode: 'user-confirmed-public-baseline-diff',
    aiUsed: false,
    creditsCharged: 0,
    autoLearningApplied: false,
    performanceClaim: false,
    ...summary,
    ts: new Date().toISOString(),
  }, { status: allFailed ? 502 : 200 })
}
