import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { findPrimaryLeadWorkspace } from '@/lib/leadCrmAccess'
import { getLeadCrmDatabaseReadiness, isLeadCrmRequested, leadCrmUnavailableResponse } from '@/lib/leadCrmReadiness'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ id: string; taskId: string }> }

function clean(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null
}

async function crmUnavailable() {
  if (!isLeadCrmRequested()) return leadCrmUnavailableResponse()
  const readiness = await getLeadCrmDatabaseReadiness()
  return readiness.ready ? null : leadCrmUnavailableResponse(readiness)
}

export async function PATCH(req: NextRequest, context: Context) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const unavailable = await crmUnavailable()
  if (unavailable) return NextResponse.json(unavailable, { status: 503 })
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Valid JSON body required' }, { status: 400 })

  const workspace = await findPrimaryLeadWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const { id, taskId } = await context.params
  const task = await prisma.leadTask.findFirst({
    where: { id: taskId, leadId: id, lead: { workspaceId: workspace.id } },
  })
  if (!task) return NextResponse.json({ error: 'Lead task not found' }, { status: 404 })
  if (task.status !== 'OPEN') return NextResponse.json({ error: 'Only open tasks can be resolved' }, { status: 409 })

  const expectedUpdatedAt = typeof body.expectedUpdatedAt === 'string' ? new Date(body.expectedUpdatedAt) : null
  if (!expectedUpdatedAt || !Number.isFinite(expectedUpdatedAt.getTime())) {
    return NextResponse.json({ error: 'expectedUpdatedAt is required for a safe update' }, { status: 400 })
  }
  const status = typeof body.status === 'string' ? body.status.toUpperCase() : ''
  if (!['COMPLETED', 'CANCELLED'].includes(status)) {
    return NextResponse.json({ error: 'Task status must be COMPLETED or CANCELLED' }, { status: 400 })
  }

  const now = new Date()
  try {
    await prisma.$transaction(async tx => {
      const updated = await tx.leadTask.updateMany({
        where: { id: task.id, leadId: id, status: 'OPEN', updatedAt: expectedUpdatedAt },
        data: {
          status,
          completedAt: status === 'COMPLETED' ? now : null,
          completionNote: clean(body.completionNote, 2000),
        },
      })
      if (updated.count !== 1) throw new Error('LEAD_TASK_CONCURRENT_CHANGE')
      const nextTask = await tx.leadTask.findFirst({
        where: { leadId: id, status: 'OPEN', id: { not: task.id } },
        orderBy: { dueAt: 'asc' },
        select: { dueAt: true },
      })
      await tx.lead.update({
        where: { id },
        data: { nextFollowUpAt: nextTask?.dueAt ?? null, lastActivityAt: now },
      })
      await tx.leadActivity.create({
        data: {
          leadId: id,
          type: status === 'COMPLETED' ? 'TASK_COMPLETED' : 'TASK_CANCELLED',
          actor: 'USER',
          note: clean(body.completionNote, 2000),
          metadata: { taskId: task.id, dueAt: task.dueAt.toISOString() },
          occurredAt: now,
        },
      })
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'LEAD_TASK_CONCURRENT_CHANGE') {
      return NextResponse.json({
        error: 'Task changed while you were reviewing it. Refresh and try again.',
        code: 'LEAD_TASK_CONCURRENT_CHANGE',
      }, { status: 409 })
    }
    console.error('[Lead task PATCH]', error)
    return NextResponse.json({ error: 'Failed to update lead task' }, { status: 500 })
  }

  const resolvedTask = await prisma.leadTask.findUnique({
    where: { id: task.id },
    include: { assignedTo: { select: { id: true, name: true, email: true } } },
  })
  return NextResponse.json({ task: resolvedTask, outreachTriggered: false })
}
