import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { findPrimaryLeadWorkspace } from '@/lib/leadCrmAccess'
import { getLeadCrmDatabaseReadiness, isLeadCrmRequested, leadCrmUnavailableResponse } from '@/lib/leadCrmReadiness'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isLeadCrmRequested()) return NextResponse.json(leadCrmUnavailableResponse(), { status: 503 })
  const readiness = await getLeadCrmDatabaseReadiness()
  if (!readiness.ready) return NextResponse.json(leadCrmUnavailableResponse(readiness), { status: 503 })

  const workspace = await findPrimaryLeadWorkspace(userId)
  if (!workspace) return NextResponse.json({ alerts: [], summary: { total: 0, firstResponse: 0, followUp: 0 }, outreachTriggered: false })

  const now = new Date()
  const [responseLeads, overdueTasks] = await Promise.all([
    prisma.lead.findMany({
      where: {
        workspaceId: workspace.id,
        firstContactedAt: null,
        responseDueAt: { lt: now },
        stage: { notIn: ['WON', 'LOST', 'DISQUALIFIED'] },
      },
      orderBy: { responseDueAt: 'asc' },
      take: 100,
      select: {
        id: true, fullName: true, email: true, phone: true, stage: true,
        responseDueAt: true,
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.leadTask.findMany({
      where: {
        status: 'OPEN',
        dueAt: { lt: now },
        lead: { workspaceId: workspace.id },
      },
      orderBy: { dueAt: 'asc' },
      take: 100,
      select: {
        id: true, title: true, dueAt: true, priority: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, fullName: true, email: true, phone: true, stage: true } },
      },
    }),
  ])

  const alerts = [
    ...responseLeads.map(lead => ({
      id: `FIRST_RESPONSE:${lead.id}:${lead.responseDueAt?.toISOString()}`,
      type: 'FIRST_RESPONSE_OVERDUE' as const,
      dueAt: lead.responseDueAt,
      lead,
    })),
    ...overdueTasks.map(task => ({
      id: `FOLLOW_UP:${task.id}:${task.dueAt.toISOString()}`,
      type: 'FOLLOW_UP_OVERDUE' as const,
      dueAt: task.dueAt,
      task: { id: task.id, title: task.title, priority: task.priority },
      assignedTo: task.assignedTo,
      lead: task.lead,
    })),
  ].sort((a, b) => new Date(a.dueAt || 0).getTime() - new Date(b.dueAt || 0).getTime())

  return NextResponse.json({
    alerts,
    summary: { total: alerts.length, firstResponse: responseLeads.length, followUp: overdueTasks.length },
    outreachTriggered: false,
    generatedAt: now.toISOString(),
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}
