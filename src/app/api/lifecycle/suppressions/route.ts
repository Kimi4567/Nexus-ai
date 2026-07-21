import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { findPrimaryLeadWorkspace } from '@/lib/leadCrmAccess'
import { hashLifecycleDestination, isLifecycleChannel } from '@/lib/lifecycleMessaging'
import { lifecycleGate } from '@/lib/lifecycleReadiness'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function text(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null
}
export async function GET(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await lifecycleGate()
  if (!gate.ready) return NextResponse.json(gate.body, { status: 503 })
  const workspace = await findPrimaryLeadWorkspace(userId)
  if (!workspace) return NextResponse.json({ suppressions: [] })
  const suppressions = await prisma.contactSuppression.findMany({
    where: { workspaceId: workspace.id, status: 'ACTIVE' },
    orderBy: { updatedAt: 'desc' },
    take: 100,
    select: {
      id: true, leadId: true, channel: true, status: true, reason: true, source: true, createdAt: true, updatedAt: true,
      lead: { select: { id: true, fullName: true, email: true, phone: true } },
    },
  })
  return NextResponse.json({ suppressions }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await lifecycleGate()
  if (!gate.ready) return NextResponse.json(gate.body, { status: 503 })
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Valid JSON body required' }, { status: 400 }) }
  const leadId = text(body.leadId, 100)
  const channel = typeof body.channel === 'string' ? body.channel.toUpperCase() : ''
  const reason = text(body.reason, 500)
  if (!leadId || !isLifecycleChannel(channel) || !reason) {
    return NextResponse.json({ error: 'Lead, channel, and reason are required' }, { status: 400 })
  }
  const workspace = await findPrimaryLeadWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, workspaceId: workspace.id },
    select: { id: true, email: true, phone: true },
  })
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  const destination = channel === 'EMAIL' ? lead.email : lead.phone
  const destinationHash = hashLifecycleDestination(channel, destination)
  if (!destinationHash) return NextResponse.json({ error: `Lead has no valid ${channel.toLowerCase()} destination` }, { status: 400 })

  const suppression = await prisma.$transaction(async tx => {
    const record = await tx.contactSuppression.upsert({
      where: { workspaceId_channel_destinationHash: { workspaceId: workspace.id, channel, destinationHash } },
      create: { workspaceId: workspace.id, leadId: lead.id, channel, destinationHash, reason, source: 'USER', createdById: userId },
      update: { leadId: lead.id, status: 'ACTIVE', reason, source: 'USER', createdById: userId, revokedAt: null, revokedById: null },
      select: { id: true, leadId: true, channel: true, status: true, reason: true, source: true, createdAt: true, updatedAt: true },
    })
    await tx.leadActivity.create({
      data: { leadId: lead.id, type: 'CONTACT_SUPPRESSED', actor: 'USER', metadata: { channel, reason, suppressionId: record.id } },
    })
    return record
  })
  return NextResponse.json({ suppression, outreachStopped: true }, { status: 201 })
}
