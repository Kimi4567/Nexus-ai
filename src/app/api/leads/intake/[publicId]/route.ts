import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { dbRateLimit } from '@/lib/dbRateLimit'
import { getLandingPageGate } from '@/lib/landingPageAccess'
import { conversionFingerprint, publishedSnapshotCaptureFormPublicId } from '@/lib/landingPageContract'
import { isLandingPagesRequested } from '@/lib/landingPageReadiness'
import { verifyLandingExperimentToken } from '@/lib/landingPageExperiment'
import { isLandingPageExperimentsRequested } from '@/lib/landingPageExperimentReadiness'
import { getLeadCrmDatabaseReadiness, isLeadCrmRequested } from '@/lib/leadCrmReadiness'
import {
  calculateLeadResponseDueAt,
  normalizeLeadEmail,
  normalizeLeadPhone,
  sanitizeLeadAttribution,
} from '@/lib/leadLifecycle'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ publicId: string }> }

function clean(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null
}

function ipHash(req: NextRequest): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'
  return createHash('sha256').update(ip).digest('hex').slice(0, 24)
}

async function publicCrmReady(): Promise<boolean> {
  if (!isLeadCrmRequested()) return false
  return (await getLeadCrmDatabaseReadiness()).ready
}

function unavailable() {
  return NextResponse.json({ error: 'Lead capture is temporarily unavailable.' }, {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}

async function activeForm(publicId: string) {
  return prisma.leadCaptureForm.findUnique({
    where: { publicId },
    select: {
      id: true,
      publicId: true,
      workspaceId: true,
      campaignId: true,
      title: true,
      description: true,
      consentStatement: true,
      allowedOrigin: true,
      status: true,
    },
  })
}

export async function GET(_req: NextRequest, context: Context) {
  if (!await publicCrmReady()) return unavailable()
  const { publicId } = await context.params
  const form = await activeForm(publicId)
  if (!form || form.status !== 'ACTIVE') return NextResponse.json({ error: 'Form not found' }, { status: 404 })
  return NextResponse.json({
    form: {
      publicId: form.publicId,
      title: form.title,
      description: form.description,
      consentStatement: form.consentStatement,
    },
    outreachAutomation: false,
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest, context: Context) {
  if (!await publicCrmReady()) return unavailable()
  const contentLength = Number(req.headers.get('content-length') || 0)
  if (contentLength > 16 * 1024) return NextResponse.json({ error: 'Submission is too large' }, { status: 413 })

  const { publicId } = await context.params
  const form = await activeForm(publicId)
  if (!form || form.status !== 'ACTIVE') return NextResponse.json({ error: 'Form not found' }, { status: 404 })

  const origin = req.headers.get('origin')
  const hostedOrigin = req.nextUrl.origin
  if (form.allowedOrigin && origin && origin !== form.allowedOrigin && origin !== hostedOrigin) {
    return NextResponse.json({ error: 'Origin is not allowed for this form' }, { status: 403 })
  }

  const requester = ipHash(req)
  const [perIp, perForm] = await Promise.all([
    dbRateLimit(`lead-intake:${form.id}:${requester}`, { limit: 10, windowMs: 60 * 60_000 }),
    dbRateLimit(`lead-intake-total:${form.id}`, { limit: 500, windowMs: 60 * 60_000 }),
  ])
  if (!perIp.ok || !perForm.ok) {
    return NextResponse.json({ error: 'Too many submissions. Try again later.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Valid JSON body required' }, { status: 400 })
  if (clean(body.website, 200)) {
    return NextResponse.json({ accepted: true, outreachTriggered: false }, { status: 202 })
  }

  const email = clean(body.email, 254)
  const phone = clean(body.phone, 40)
  const emailNormalized = normalizeLeadEmail(email)
  const phoneNormalized = normalizeLeadPhone(phone)
  if ((email && !emailNormalized) || (phone && !phoneNormalized) || (!emailNormalized && !phoneNormalized)) {
    return NextResponse.json({ error: 'A valid email or phone number is required' }, { status: 400 })
  }

  const consentGranted = body.consentGranted === true && Boolean(form.consentStatement)
  const now = new Date()
  const attribution = sanitizeLeadAttribution({
    ...(body.attribution && typeof body.attribution === 'object' ? body.attribution : {}),
    landingPage: clean(body.landingPage, 500),
    referrer: clean(body.referrer, 500),
  })
  const landingPagePublicId = clean(body.landingPagePublicId, 100)
  let landingContext: {
    id: string
    publicId: string
    workspaceId: string
    campaignId: string
    publishedSnapshot: unknown
  } | null = null
  let experimentAssignment: { experimentId: string; variant: 'CONTROL' | 'CHALLENGER' } | null = null
  if (landingPagePublicId && isLandingPagesRequested()) {
    const landingGate = await getLandingPageGate()
    if (!landingGate.ready) return NextResponse.json(landingGate.body, { status: 503 })
    landingContext = await prisma.landingPage.findFirst({
      where: {
        publicId: landingPagePublicId,
        workspaceId: form.workspaceId,
        campaignId: form.campaignId || '__no_campaign__',
        status: 'PUBLISHED',
      },
      select: { id: true, publicId: true, workspaceId: true, campaignId: true, publishedSnapshot: true },
    })
    if (!landingContext || publishedSnapshotCaptureFormPublicId(landingContext.publishedSnapshot) !== form.publicId) {
      return NextResponse.json({ error: 'Landing page attribution context is invalid.' }, { status: 400 })
    }
    if (isLandingPageExperimentsRequested()) {
      const assignment = verifyLandingExperimentToken(process.env.CRO_EVENT_HASH_KEY as string, body.experimentToken)
      if (assignment && assignment.landingPageId === landingContext.id) {
        const experiment = await prisma.landingPageExperiment.findFirst({
          where: {
            id: assignment.experimentId,
            landingPageId: landingContext.id,
            workspaceId: landingContext.workspaceId,
            campaignId: landingContext.campaignId,
            status: { in: ['RUNNING', 'PAUSED', 'COMPLETED'] },
            startedAt: { not: null },
          },
          select: { id: true },
        })
        if (experiment) experimentAssignment = { experimentId: experiment.id, variant: assignment.variant }
      }
    }
  }
  const duplicateWhere = {
    workspaceId: form.workspaceId,
    OR: [
      ...(emailNormalized ? [{ emailNormalized }] : []),
      ...(phoneNormalized ? [{ phoneNormalized }] : []),
    ],
  }
  const duplicate = await prisma.lead.findFirst({
    where: duplicateWhere,
    select: { id: true },
  })
  // Preserve the validated values across the nested async transaction callback;
  // TypeScript correctly refuses to rely on outer control-flow narrowing there.
  const acceptedForm = form
  const submissionBody = body

  async function persistIntake(existingLeadId: string | null) {
    return prisma.$transaction(async tx => {
      let acceptedLeadId: string
      if (existingLeadId) {
        acceptedLeadId = existingLeadId
        await tx.leadActivity.create({
          data: {
            leadId: existingLeadId,
            type: 'FORM_RECAPTURED',
            actor: 'SYSTEM',
            metadata: {
              captureFormId: acceptedForm.id,
              campaignId: acceptedForm.campaignId,
              landingPageId: landingContext?.id,
              experimentId: experimentAssignment?.experimentId,
              experimentVariant: experimentAssignment?.variant,
              // Lead.attribution remains the immutable first touch. Recaptures
              // carry their own bounded attribution so reporting can expose a
              // separate last-touch model without rewriting acquisition truth.
              attribution,
              consentSelfAttested: consentGranted,
            },
            occurredAt: now,
          },
        })
      } else {
        const lead = await tx.lead.create({
          data: {
            workspaceId: acceptedForm.workspaceId,
            campaignId: acceptedForm.campaignId,
            fullName: clean(submissionBody.fullName, 140),
            email,
            emailNormalized,
            phone,
            phoneNormalized,
            company: clean(submissionBody.company, 140),
            jobTitle: clean(submissionBody.jobTitle, 140),
            source: 'FORM',
            sourceDetail: `Capture form: ${acceptedForm.id}`,
            stage: 'NEW',
            consentStatus: consentGranted ? 'GRANTED' : 'UNKNOWN',
            consentSource: consentGranted ? `Form ${acceptedForm.id}: explicit checkbox (identity unverified)` : null,
            consentAt: consentGranted ? now : null,
            attribution,
            responseDueAt: calculateLeadResponseDueAt(now),
            lastActivityAt: now,
          },
          select: { id: true },
        })
        acceptedLeadId = lead.id
        await tx.leadActivity.create({
          data: {
            leadId: lead.id,
            type: 'CREATED',
            actor: 'SYSTEM',
            metadata: {
              source: 'FORM',
              captureFormId: acceptedForm.id,
              campaignId: acceptedForm.campaignId,
              landingPageId: landingContext?.id,
              experimentId: experimentAssignment?.experimentId,
              experimentVariant: experimentAssignment?.variant,
              consentStatus: consentGranted ? 'GRANTED' : 'UNKNOWN',
              consentSelfAttested: consentGranted,
              identityVerified: false,
            },
            occurredAt: now,
          },
        })
      }
      if (landingContext) {
        const bucket = Math.floor(now.getTime() / 10_000)
        const dedupeKey = conversionFingerprint(process.env.CRO_EVENT_HASH_KEY as string, [
          'FORM_SUBMITTED',
          landingContext.id,
          acceptedForm.id,
          acceptedLeadId,
          experimentAssignment?.experimentId || 'none',
          experimentAssignment?.variant || 'none',
          String(bucket),
        ])
        await tx.conversionEvent.createMany({
          data: [{
            workspaceId: landingContext.workspaceId,
            campaignId: landingContext.campaignId,
            landingPageId: landingContext.id,
            leadId: acceptedLeadId,
            experimentId: experimentAssignment?.experimentId,
            experimentVariant: experimentAssignment?.variant,
            eventType: 'FORM_SUBMITTED',
            verificationState: 'SERVER_CONFIRMED',
            source: 'LANDING_PAGE',
            attribution,
            dedupeKey,
            occurredAt: now,
          }],
          skipDuplicates: true,
        })
      }
      await tx.leadCaptureForm.update({
        where: { id: acceptedForm.id },
        data: { submissionCount: { increment: 1 }, lastSubmissionAt: now },
      })
    })
  }

  try {
    await persistIntake(duplicate?.id ?? null)
  } catch (error) {
    if (error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2002') {
      // A concurrent request may have created the same contact after the first
      // lookup. Retry once as a recapture so the activity, form counter, and
      // server-confirmed conversion evidence are not silently lost.
      const concurrent = await prisma.lead.findFirst({ where: duplicateWhere, select: { id: true } })
      if (concurrent) {
        try {
          await persistIntake(concurrent.id)
          return NextResponse.json({ accepted: true, outreachTriggered: false }, { status: 202 })
        } catch (retryError) {
          console.error('[Public lead intake retry]', retryError)
        }
      }
    }
    console.error('[Public lead intake]', error)
    return NextResponse.json({ error: 'Submission could not be accepted' }, { status: 500 })
  }

  return NextResponse.json({ accepted: true, outreachTriggered: false }, { status: 202 })
}
