import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { leadWorkspaceAccessFilter } from '@/lib/leadCrmAccess'
import { createUnsubscribeToken, evaluateLifecycleDelivery, hashLifecycleDestination, isLifecycleChannel, isLifecyclePurpose } from '@/lib/lifecycleMessaging'
import { lifecycleGate } from '@/lib/lifecycleReadiness'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, context: Context) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await lifecycleGate()
  if (!gate.ready) return NextResponse.json(gate.body, { status: 503 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Valid JSON body required' }, { status: 400 }) }
  const expectedUpdatedAt = typeof body.expectedUpdatedAt === 'string' ? new Date(body.expectedUpdatedAt) : null
  if (!expectedUpdatedAt || !Number.isFinite(expectedUpdatedAt.getTime())) {
    return NextResponse.json({ error: 'expectedUpdatedAt is required for safe approval' }, { status: 400 })
  }

  const { id } = await context.params
  const current = await prisma.lifecycleMessage.findFirst({
    where: { id, workspace: leadWorkspaceAccessFilter(userId) },
    include: { lead: { select: { id: true, email: true, phone: true, consentStatus: true } } },
  })
  if (!current) return NextResponse.json({ error: 'Lifecycle message not found' }, { status: 404 })
  if (current.status !== 'DRAFT') {
    return NextResponse.json({ error: 'Only a draft can be approved', code: 'MESSAGE_NOT_DRAFT' }, { status: 409 })
  }
  if (!isLifecycleChannel(current.channel) || !isLifecyclePurpose(current.purpose)) {
    return NextResponse.json({ error: 'Stored lifecycle message is invalid' }, { status: 500 })
  }

  const destination = current.channel === 'EMAIL' ? current.lead.email : current.lead.phone
  const destinationHash = hashLifecycleDestination(current.channel, destination)
  const suppression = destinationHash ? await prisma.contactSuppression.findFirst({
    where: { workspaceId: current.workspaceId, channel: current.channel, destinationHash, status: 'ACTIVE' },
    select: { id: true },
  }) : null
  const delivery = evaluateLifecycleDelivery({
    channel: current.channel,
    purpose: current.purpose,
    destination,
    consentStatus: current.lead.consentStatus,
    suppressed: Boolean(suppression),
  })
  const now = new Date()
  const result = await prisma.$transaction(async tx => {
    const updated = await tx.lifecycleMessage.updateMany({
      where: { id: current.id, status: 'DRAFT', updatedAt: expectedUpdatedAt },
      data: {
        status: 'APPROVED', approvedById: userId, approvedAt: now,
        deliveryBlockedReason: delivery.blockers.join(','),
      },
    })
    if (updated.count !== 1) return null
    await tx.leadActivity.create({
      data: {
        leadId: current.leadId,
        type: 'LIFECYCLE_COPY_APPROVED',
        actor: 'USER',
        metadata: {
          lifecycleMessageId: current.id,
          channel: current.channel,
          purpose: current.purpose,
          deliveryState: 'BLOCKED',
          blockers: delivery.blockers,
        },
        occurredAt: now,
      },
    })
    return tx.lifecycleMessage.findUnique({
      where: { id: current.id },
      include: { lead: { select: { id: true, fullName: true, email: true, phone: true, consentStatus: true } } },
    })
  })
  if (!result) {
    return NextResponse.json({ error: 'Draft changed before approval. Reload and review again.', code: 'STALE_MESSAGE_VERSION' }, { status: 409 })
  }

  const unsubscribeToken = createUnsubscribeToken({
    workspaceId: current.workspaceId,
    leadId: current.leadId,
    channel: current.channel,
    expiresAt: new Date(now.getTime() + 90 * 24 * 60 * 60_000),
  })
  return NextResponse.json({
    message: result,
    approvalScope: 'COPY_ONLY',
    delivery: { state: 'BLOCKED', providerState: 'NOT_CONNECTED', ...delivery },
    previewUnsubscribePath: `/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`,
    sendsEnabled: false,
  })
}
