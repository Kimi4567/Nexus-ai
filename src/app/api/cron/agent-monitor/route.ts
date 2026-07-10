/**
 * GET /api/cron/agent-monitor
 * Runs daily at 06:00 UTC.
 *
 * Two jobs in one pass:
 * 1. Campaign Manager agent — checks all active workspaces, creates AgentSuggestion records
 * 2. Weekly reports — Mondays only
 *
 * Performance learning intentionally does not run here. The fetch-analytics cron owns that
 * path because it can require real platform analytics before proposing or storing a pattern.
 *
 * ⚠️  COST TRACKING NOTE (not user-billed):
 * runCampaignMonitor (orchestrator) may use gpt-4o-mini (campaign-manager.ts, max_tokens: 1500)
 * Estimated per workspace: ~$0.003
 *
 * At 1,000 active workspaces per run: ~$3–5/day = ~$90–150/month uncovered COGS.
 * Search Vercel logs for "[agent-monitor] COST" to monitor daily spend.
 * If daily workspaces > 500, consider rate-limiting to workspaces active in last 7 days.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runCampaignMonitor, runReport } from '@/lib/agents/orchestrator'

export const dynamic = 'force-dynamic'

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Verify cron secret — matches Vercel's Authorization: Bearer <CRON_SECRET> format
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret && process.env.NODE_ENV !== 'development') { return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 }) }
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = {
    workspacesChecked: 0,
    campaignsChecked: 0,
    suggestionsCreated: 0,
    reportsCreated: 0,
    performanceLearningOwner: 'fetch-analytics',
    errors: [] as string[],
  }

  // Get all workspaces that have at least one campaign
  const workspaces = await prisma.workspace.findMany({
    where: {
      campaigns: { some: { status: { in: ['ACTIVE', 'DRAFT'] } } },
    },
    select: { id: true },
  })

  results.workspacesChecked = workspaces.length

  // ── Job 1: Campaign monitor ──────────────────────────────────────────────────
  for (const ws of workspaces) {
    try {
      const monitorResult = await runCampaignMonitor(ws.id)
      results.campaignsChecked += monitorResult.campaignsChecked
      results.suggestionsCreated += monitorResult.suggestionsCreated
      results.errors.push(...monitorResult.errors)
    } catch (err: any) {
      results.errors.push(`Workspace ${ws.id}: ${err?.message}`)
    }
  }

  // ── Job 2: Weekly reports (Mondays only) ─────────────────────────────────────
  const isMonday = new Date().getDay() === 1
  if (isMonday) {
    for (const ws of workspaces) {
      try {
        await runReport(ws.id, 'weekly')
        results.reportsCreated++
      } catch (err: any) {
        results.errors.push(`Report ${ws.id}: ${err?.message}`)
      }
    }
  }

  // ── Cost summary log — search "[agent-monitor] COST" in Vercel to monitor ─────
  const estimatedCostUSD = (
    results.workspacesChecked * 0.003 // campaign monitor per workspace
  ).toFixed(4)
  console.log(
    `[agent-monitor] COST workspaces=${results.workspacesChecked} ` +
    `performanceLearningOwner=fetch-analytics ` +
    `estimatedCostUSD=$${estimatedCostUSD} ts=${new Date().toISOString()}`
  )
  // ─────────────────────────────────────────────────────────────────────────────

  return NextResponse.json({
    ok: true,
    ...results,
    estimatedCostUSD: parseFloat(estimatedCostUSD),
    ts: new Date().toISOString(),
  })
}
