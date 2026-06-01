/**
 * GET /api/cron/agent-monitor
 * Runs daily at 06:00 UTC.
 * Campaign Manager agent checks all active workspaces
 * and creates AgentSuggestion records for underperforming campaigns.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runCampaignMonitor, runReport } from '@/lib/agents/orchestrator'

export async function GET(req: NextRequest) {
  // Verify cron secret — matches Vercel's Authorization: Bearer <CRON_SECRET> format
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = {
    workspacesChecked: 0,
    campaignsChecked: 0,
    suggestionsCreated: 0,
    reportsCreated: 0,
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

  // Run campaign monitor for each workspace
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

  // Run weekly report on Mondays
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

  return NextResponse.json({
    ok: true,
    ...results,
    ts: new Date().toISOString(),
  })
}
