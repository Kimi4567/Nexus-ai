import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { findPrimaryLeadWorkspace } from '@/lib/leadCrmAccess'
import { getLeadCrmDatabaseReadiness, isLeadCrmRequested, leadCrmUnavailableResponse } from '@/lib/leadCrmReadiness'
import { isLeadCaptureFormStatus } from '@/lib/leadLifecycle'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ id: string }> }

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
  const { id } = await context.params
  const current = await prisma.leadCaptureForm.findFirst({ where: { id, workspaceId: workspace.id } })
  if (!current) return NextResponse.json({ error: 'Lead capture form not found' }, { status: 404 })

  const expectedUpdatedAt = typeof body.expectedUpdatedAt === 'string' ? new Date(body.expectedUpdatedAt) : null
  if (!expectedUpdatedAt || !Number.isFinite(expectedUpdatedAt.getTime())) {
    return NextResponse.json({ error: 'expectedUpdatedAt is required for a safe update' }, { status: 400 })
  }
  const status = typeof body.status === 'string' ? body.status.toUpperCase() : null
  if (!isLeadCaptureFormStatus(status)) {
    return NextResponse.json({ error: 'Status must be ACTIVE, PAUSED, or ARCHIVED' }, { status: 400 })
  }

  const updated = await prisma.leadCaptureForm.updateMany({
    where: { id: current.id, workspaceId: workspace.id, updatedAt: expectedUpdatedAt },
    data: { status },
  })
  if (updated.count !== 1) {
    return NextResponse.json({
      error: 'Form changed while you were reviewing it. Refresh and try again.',
      code: 'LEAD_FORM_CONCURRENT_CHANGE',
    }, { status: 409 })
  }
  const form = await prisma.leadCaptureForm.findUnique({ where: { id: current.id } })
  return NextResponse.json({ form })
}
