import { NextRequest, NextResponse } from 'next/server'
import { hashLifecycleDestination, verifyUnsubscribeToken } from '@/lib/lifecycleMessaging'
import { lifecycleGate } from '@/lib/lifecycleReadiness'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const GENERIC_SUCCESS = 'Your communication preference has been recorded.'

export async function POST(req: NextRequest) {
  const gate = await lifecycleGate()
  if (!gate.ready) return NextResponse.json({ error: 'Preference service is temporarily unavailable.' }, { status: 503 })
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Valid request required' }, { status: 400 }) }
  const payload = verifyUnsubscribeToken(body.token)
  if (!payload) return NextResponse.json({ error: 'This preference link is invalid or expired.' }, { status: 400 })

  const lead = await prisma.lead.findFirst({
    where: { id: payload.leadId, workspaceId: payload.workspaceId },
    select: { id: true, email: true, phone: true },
  })
  if (!lead) return NextResponse.json({ ok: true, message: GENERIC_SUCCESS })
  const destination = payload.channel === 'EMAIL' ? lead.email : lead.phone
  const destinationHash = hashLifecycleDestination(payload.channel, destination)
  if (!destinationHash) return NextResponse.json({ ok: true, message: GENERIC_SUCCESS })

  const now = new Date()
  await prisma.$transaction(async tx => {
    const suppression = await tx.contactSuppression.upsert({
      where: { workspaceId_channel_destinationHash: { workspaceId: payload.workspaceId, channel: payload.channel, destinationHash } },
      create: {
        workspaceId: payload.workspaceId, leadId: lead.id, channel: payload.channel, destinationHash,
        reason: 'Recipient unsubscribe request', source: 'UNSUBSCRIBE_LINK',
      },
      update: {
        leadId: lead.id, status: 'ACTIVE', reason: 'Recipient unsubscribe request', source: 'UNSUBSCRIBE_LINK',
        revokedAt: null, revokedById: null,
      },
      select: { id: true },
    })
    await tx.lead.update({
      where: { id: lead.id },
      data: { consentStatus: 'REVOKED', consentSource: `${payload.channel} unsubscribe link`, consentAt: now, lastActivityAt: now },
    })
    await tx.leadActivity.create({
      data: {
        leadId: lead.id, type: 'CONSENT_REVOKED', actor: 'SYSTEM',
        metadata: { channel: payload.channel, source: 'UNSUBSCRIBE_LINK', suppressionId: suppression.id },
        occurredAt: now,
      },
    })
  })
  return NextResponse.json({ ok: true, message: GENERIC_SUCCESS })
}
