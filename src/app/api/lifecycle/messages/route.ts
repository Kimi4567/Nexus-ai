import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { findPrimaryLeadWorkspace } from '@/lib/leadCrmAccess'
import { evaluateLifecycleDelivery, hashLifecycleDestination, isLifecycleChannel, isLifecyclePurpose } from '@/lib/lifecycleMessaging'
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
  if (!workspace) return NextResponse.json({ messages: [], sendsEnabled: false })

  const messages = await prisma.lifecycleMessage.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { updatedAt: 'desc' },
    take: 100,
    include: { lead: { select: { id: true, fullName: true, email: true, phone: true, consentStatus: true } } },
  })
  const messageDestinations = messages.map(message => {
    if (!isLifecycleChannel(message.channel)) return { message, destination: null, destinationHash: null }
    const destination = message.channel === 'EMAIL' ? message.lead.email : message.lead.phone
    return { message, destination, destinationHash: hashLifecycleDestination(message.channel, destination) }
  })
  const hashes = [...new Set(messageDestinations.flatMap(item => item.destinationHash ? [item.destinationHash] : []))]
  const activeSuppressions = hashes.length ? await prisma.contactSuppression.findMany({
    where: { workspaceId: workspace.id, status: 'ACTIVE', destinationHash: { in: hashes } },
    select: { channel: true, destinationHash: true },
  }) : []
  const suppressionKeys = new Set(activeSuppressions.map(item => `${item.channel}:${item.destinationHash}`))
  const views = messageDestinations.map(({ message, destination, destinationHash }) => ({
    ...message,
    delivery: isLifecycleChannel(message.channel) && isLifecyclePurpose(message.purpose)
      ? evaluateLifecycleDelivery({
          channel: message.channel,
          purpose: message.purpose,
          destination,
          consentStatus: message.lead.consentStatus,
          suppressed: Boolean(destinationHash && suppressionKeys.has(`${message.channel}:${destinationHash}`)),
        })
      : null,
  }))
  return NextResponse.json({ messages: views, sendsEnabled: false }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await lifecycleGate()
  if (!gate.ready) return NextResponse.json(gate.body, { status: 503 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Valid JSON body required' }, { status: 400 }) }
  const channel = typeof body.channel === 'string' ? body.channel.toUpperCase() : ''
  const purpose = typeof body.purpose === 'string' ? body.purpose.toUpperCase() : ''
  if (!isLifecycleChannel(channel)) return NextResponse.json({ error: 'Invalid lifecycle channel' }, { status: 400 })
  if (!isLifecyclePurpose(purpose)) return NextResponse.json({ error: 'Invalid lifecycle purpose' }, { status: 400 })
  const leadId = text(body.leadId, 100)
  const messageBody = text(body.body, channel === 'SMS' ? 1600 : 10_000)
  const subject = channel === 'EMAIL' ? text(body.subject, 200) : null
  if (!leadId || !messageBody) return NextResponse.json({ error: 'Lead and message body are required' }, { status: 400 })
  if (channel === 'EMAIL' && !subject) return NextResponse.json({ error: 'Email subject is required' }, { status: 400 })

  const workspace = await findPrimaryLeadWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, workspaceId: workspace.id },
    select: { id: true, email: true, phone: true, consentStatus: true },
  })
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const destination = channel === 'EMAIL' ? lead.email : lead.phone
  const destinationHash = hashLifecycleDestination(channel, destination)
  const suppression = destinationHash ? await prisma.contactSuppression.findFirst({
    where: { workspaceId: workspace.id, channel, destinationHash, status: 'ACTIVE' },
    select: { id: true },
  }) : null
  const delivery = evaluateLifecycleDelivery({ channel, purpose, destination, consentStatus: lead.consentStatus, suppressed: Boolean(suppression) })
  const created = await prisma.lifecycleMessage.create({
    data: {
      workspaceId: workspace.id, leadId: lead.id, channel, purpose, subject, body: messageBody,
      status: 'DRAFT', providerState: 'NOT_CONNECTED', deliveryBlockedReason: delivery.blockers.join(','), createdById: userId,
    },
    include: { lead: { select: { id: true, fullName: true, email: true, phone: true, consentStatus: true } } },
  })
  return NextResponse.json({ message: { ...created, delivery }, sendsEnabled: false }, { status: 201 })
}
