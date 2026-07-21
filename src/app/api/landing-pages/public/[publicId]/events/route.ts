import { NextRequest, NextResponse } from 'next/server'
import { dbRateLimit } from '@/lib/dbRateLimit'
import { getLandingPageGate } from '@/lib/landingPageAccess'
import { conversionDedupeKey, conversionFingerprint, isClientConversionEvent } from '@/lib/landingPageContract'
import { getPublicLandingExperimentState } from '@/lib/landingPageExperimentAccess'
import { verifyLandingExperimentToken } from '@/lib/landingPageExperiment'
import { sanitizeLeadAttribution } from '@/lib/leadLifecycle'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ publicId: string }> }

function requestOrigin(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host
  const protocol = req.headers.get('x-forwarded-proto') || req.nextUrl.protocol.replace(':', '')
  return `${protocol}://${host}`
}

function sameOrigin(req: NextRequest): boolean {
  const supplied = req.headers.get('origin') || req.headers.get('referer')
  if (!supplied) return false
  try {
    return new URL(supplied).origin === new URL(requestOrigin(req)).origin
  } catch {
    return false
  }
}

function requesterParts(req: NextRequest): string[] {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'
  return [ip, req.headers.get('user-agent') || 'unknown', req.headers.get('accept-language') || 'unknown']
}

export async function POST(req: NextRequest, context: Context) {
  const gate = await getLandingPageGate()
  if (!gate.ready) return NextResponse.json(gate.body, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Event origin is not allowed.' }, { status: 403 })
  const contentLength = Number(req.headers.get('content-length') || 0)
  if (contentLength > 8 * 1024) return NextResponse.json({ error: 'Event is too large.' }, { status: 413 })

  const { publicId } = await context.params
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body || !isClientConversionEvent(body.eventType)) {
    return NextResponse.json({ error: 'Event type must be PAGE_VIEW or CTA_CLICK.' }, { status: 400 })
  }
  const page = await prisma.landingPage.findUnique({
    where: { publicId },
    select: { id: true, workspaceId: true, campaignId: true, status: true, publishedHash: true },
  })
  if (!page || page.status !== 'PUBLISHED' || !page.publishedHash) {
    return NextResponse.json({ error: 'Landing page not found' }, { status: 404 })
  }

  const experimentState = await getPublicLandingExperimentState()
  if (experimentState.enabled && !experimentState.ready) {
    return NextResponse.json(experimentState.body, { status: 503 })
  }
  let experimentAssignment: { experimentId: string; variant: 'CONTROL' | 'CHALLENGER' } | null = null
  if (experimentState.enabled && experimentState.ready) {
    const runningExperiment = await prisma.landingPageExperiment.findFirst({
      where: { landingPageId: page.id, status: 'RUNNING' },
      select: { id: true },
    })
    if (runningExperiment) {
      const assignment = verifyLandingExperimentToken(process.env.CRO_EVENT_HASH_KEY as string, body.assignmentToken)
      if (!assignment || assignment.experimentId !== runningExperiment.id || assignment.landingPageId !== page.id) {
        return NextResponse.json({ error: 'A valid active experiment assignment is required.' }, { status: 400 })
      }
      experimentAssignment = { experimentId: assignment.experimentId, variant: assignment.variant }
    }
  }

  const hashSecret = process.env.CRO_EVENT_HASH_KEY as string
  const fingerprintHash = conversionFingerprint(hashSecret, requesterParts(req))
  const rateLimit = await dbRateLimit(`cro-event:${page.id}:${fingerprintHash.slice(0, 24)}`, { limit: 120, windowMs: 60 * 60_000 })
  if (!rateLimit.ok) return NextResponse.json({ error: 'Too many events. Try again later.' }, { status: 429 })
  const occurredAt = new Date()
  const dedupeKey = conversionDedupeKey({
    pageId: page.id,
    eventType: body.eventType,
    fingerprintHash,
    experimentId: experimentAssignment?.experimentId,
    experimentVariant: experimentAssignment?.variant,
    occurredAt,
  })

  try {
    await prisma.conversionEvent.create({
      data: {
        workspaceId: page.workspaceId,
        campaignId: page.campaignId,
        landingPageId: page.id,
        experimentId: experimentAssignment?.experimentId,
        experimentVariant: experimentAssignment?.variant,
        eventType: body.eventType,
        verificationState: 'CLIENT_REPORTED',
        attribution: sanitizeLeadAttribution(body.attribution),
        fingerprintHash,
        dedupeKey,
        occurredAt,
      },
    })
    return NextResponse.json({ accepted: true, deduplicated: false, verificationState: 'CLIENT_REPORTED' }, { status: 202 })
  } catch (error) {
    if (error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2002') {
      return NextResponse.json({ accepted: true, deduplicated: true, verificationState: 'CLIENT_REPORTED' }, { status: 202 })
    }
    console.error('[Landing page conversion event]', error)
    return NextResponse.json({ error: 'Event could not be recorded.' }, { status: 500 })
  }
}
