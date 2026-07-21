import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { findPrimaryLeadWorkspace, isLeadOperator } from '@/lib/leadCrmAccess'
import { getLeadCrmDatabaseReadiness, isLeadCrmRequested, leadCrmUnavailableResponse } from '@/lib/leadCrmReadiness'
import { isLeadTaskPriority } from '@/lib/leadLifecycle'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ id: string }> }

function clean(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null
}

async function crmUnavailable() {
  if (!isLeadCrmRequested()) return leadCrmUnavailableResponse()
  const readiness = await getLeadCrmDatabaseReadiness()
  return readiness.ready ? null : leadCrmUnavailableResponse(readiness)
}

export async function POST(req: NextRequest, context: Context) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const unavailable = await crmUnavailable()
  if (unavailable) return NextResponse.json(unavailable, { status: 503 })

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Valid JSON body required' }, { status: 400 })
  const workspace = await findPrimaryLeadWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const { id } = await context.params
  const lead = await prisma.lead.findFirst({
    where: { id, workspaceId: workspace.id },
    select: { id: true, assignedToId: true, nextFollowUpAt: true },
  })
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const title = clean(body.title, 180)
  if (!title) return NextResponse.json({ error: 'Task title is required' }, { status: 400 })
  const dueAt = typeof body.dueAt === 'string' ? new Date(body.dueAt) : null
  const now = new Date()
  if (!dueAt || !Number.isFinite(dueAt.getTime()) || dueAt.getTime() <= now.getTime()) {
    return NextResponse.json({ error: 'Task dueAt must be a future timestamp' }, { status: 400 })
  }
  if (dueAt.getTime() > now.getTime() + 2 * 365 * 24 * 60 * 60_000) {
    return NextResponse.json({ error: 'Task dueAt cannot be more than two years ahead' }, { status: 400 })
  }

  const priority = typeof body.priority === 'string' ? body.priority.toUpperCase() : 'MEDIUM'
  if (!isLeadTaskPriority(priority)) return NextResponse.json({ error: 'Priority must be LOW, MEDIUM, or HIGH' }, { status: 400 })
  const assignedToId = clean(body.assignedToId, 100) ?? lead.assignedToId ?? userId
  if (!await isLeadOperator(workspace.id, userId, assignedToId)) {
    return NextResponse.json({ error: 'Task assignee must be an active workspace operator' }, { status: 400 })
  }

  const task = await prisma.$transaction(async tx => {
    const created = await tx.leadTask.create({
      data: {
        leadId: lead.id,
        assignedToId,
        createdById: userId,
        title,
        note: clean(body.note, 2000),
        priority,
        dueAt,
      },
      include: { assignedTo: { select: { id: true, name: true, email: true } } },
    })
    await tx.lead.update({
      where: { id: lead.id },
      data: {
        nextFollowUpAt: !lead.nextFollowUpAt || dueAt < lead.nextFollowUpAt ? dueAt : lead.nextFollowUpAt,
        lastActivityAt: now,
      },
    })
    await tx.leadActivity.create({
      data: {
        leadId: lead.id,
        type: 'TASK_CREATED',
        actor: 'USER',
        metadata: { taskId: created.id, assignedToId, dueAt: dueAt.toISOString(), priority },
        occurredAt: now,
      },
    })
    return created
  })
  return NextResponse.json({ task, outreachTriggered: false }, { status: 201 })
}
