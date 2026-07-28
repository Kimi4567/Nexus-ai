import type { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { findPrimaryLeadWorkspace } from '@/lib/leadCrmAccess'
import { getLandingPageGate } from '@/lib/landingPageAccess'
import { parseLandingPageDraft } from '@/lib/landingPageContract'
import { getLandingExperimentGate } from '@/lib/landingPageExperimentAccess'
import { isLandingPageExperimentsRequested } from '@/lib/landingPageExperimentReadiness'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ id: string }> }

function draftInput(current: {
  name: string
  campaignId: string
  captureFormId: string | null
  locale: string
  headline: string
  subheadline: string | null
  body: string | null
  benefits: Prisma.JsonValue
  proof: string | null
  primaryCtaLabel: string
  primaryCtaUrl: string | null
  theme: Prisma.JsonValue
  seoTitle: string | null
  seoDescription: string | null
  seoIndexable: boolean
}, body: Record<string, unknown>) {
  return {
    name: body.name ?? current.name,
    campaignId: body.campaignId ?? current.campaignId,
    captureFormId: body.captureFormId !== undefined ? body.captureFormId : current.captureFormId,
    locale: body.locale ?? current.locale,
    headline: body.headline ?? current.headline,
    subheadline: body.subheadline !== undefined ? body.subheadline : current.subheadline,
    body: body.body !== undefined ? body.body : current.body,
    benefits: body.benefits ?? current.benefits,
    proof: body.proof !== undefined ? body.proof : current.proof,
    primaryCtaLabel: body.primaryCtaLabel ?? current.primaryCtaLabel,
    primaryCtaUrl: body.primaryCtaUrl !== undefined ? body.primaryCtaUrl : current.primaryCtaUrl,
    theme: body.theme ?? current.theme,
    seoTitle: body.seoTitle !== undefined ? body.seoTitle : current.seoTitle,
    seoDescription: body.seoDescription !== undefined ? body.seoDescription : current.seoDescription,
    seoIndexable: body.seoIndexable !== undefined ? body.seoIndexable : current.seoIndexable,
  }
}

export async function GET(req: NextRequest, context: Context) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await getLandingPageGate()
  if (!gate.ready) return NextResponse.json(gate.body, { status: 503 })
  const workspace = await findPrimaryLeadWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const { id } = await context.params
  const page = await prisma.landingPage.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      campaign: { select: { id: true, name: true } },
      captureForm: { select: { id: true, publicId: true, name: true, status: true, campaignId: true } },
      revisions: { orderBy: { version: 'desc' }, take: 20 },
    },
  })
  if (!page) return NextResponse.json({ error: 'Landing page not found' }, { status: 404 })
  return NextResponse.json({
    page: {
      ...page,
      publicPath: `/lp/${page.publicId}`,
      hasUnpublishedChanges: page.publishedVersion !== null && page.version !== page.publishedVersion,
    },
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function PATCH(req: NextRequest, context: Context) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await getLandingPageGate()
  if (!gate.ready) return NextResponse.json(gate.body, { status: 503 })
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Valid JSON body required' }, { status: 400 })
  const expectedVersion = Number(body.expectedVersion)
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return NextResponse.json({ error: 'expectedVersion is required for a safe update.' }, { status: 400 })
  }

  const workspace = await findPrimaryLeadWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const { id } = await context.params
  const current = await prisma.landingPage.findFirst({ where: { id, workspaceId: workspace.id } })
  if (!current) return NextResponse.json({ error: 'Landing page not found' }, { status: 404 })
  if (current.status === 'ARCHIVED') {
    return NextResponse.json({ error: 'Archived landing pages are read-only.' }, { status: 409 })
  }
  if (current.version !== expectedVersion) {
    return NextResponse.json({ error: 'Landing page changed while you were editing it. Refresh and try again.', code: 'LANDING_PAGE_CONCURRENT_CHANGE' }, { status: 409 })
  }
  if (isLandingPageExperimentsRequested()) {
    const experimentGate = await getLandingExperimentGate()
    if (!experimentGate.ready) return NextResponse.json(experimentGate.body, { status: 503 })
    const activeExperiment = await prisma.landingPageExperiment.findFirst({
      where: { landingPageId: current.id, status: { in: ['RUNNING', 'PAUSED'] } },
      select: { id: true },
    })
    if (activeExperiment) {
      return NextResponse.json({
        error: 'Pause is not an editing unlock. Complete or cancel the active experiment before changing the page.',
        code: 'LANDING_EXPERIMENT_PAGE_LOCKED',
      }, { status: 409 })
    }
  }

  const parsed = parseLandingPageDraft(draftInput(current, body))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  if (current.publishedVersion !== null && parsed.value.campaignId !== current.campaignId) {
    return NextResponse.json({
      error: 'Campaign identity cannot change after first publication. Create a new landing page for another campaign.',
      code: 'LANDING_PAGE_CAMPAIGN_IMMUTABLE',
    }, { status: 400 })
  }
  const requestedStatus = typeof body.status === 'string' ? body.status.toUpperCase() : current.status
  if (![current.status, 'ARCHIVED'].includes(requestedStatus)) {
    return NextResponse.json({ error: 'Only archiving is allowed through this update route.' }, { status: 400 })
  }

  const [campaign, captureForm] = await Promise.all([
    prisma.campaign.findFirst({
      where: { id: parsed.value.campaignId, workspaceId: workspace.id },
      select: { id: true },
    }),
    parsed.value.captureFormId ? prisma.leadCaptureForm.findFirst({
      where: { id: parsed.value.captureFormId, workspaceId: workspace.id },
      select: { id: true, campaignId: true, status: true },
    }) : Promise.resolve(null),
  ])
  if (!campaign) return NextResponse.json({ error: 'Campaign not found in this workspace.' }, { status: 400 })
  if (parsed.value.captureFormId && !captureForm) return NextResponse.json({ error: 'Capture form not found in this workspace.' }, { status: 400 })
  if (captureForm && captureForm.campaignId && captureForm.campaignId !== parsed.value.campaignId) {
    return NextResponse.json({ error: 'Capture form must belong to the same campaign as the landing page.' }, { status: 400 })
  }
  if (captureForm && captureForm.campaignId === null && captureForm.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Only an active unassigned capture form can be linked to a campaign.' }, { status: 400 })
  }

  const nextVersion = current.version + 1
  try {
    const page = await prisma.$transaction(async tx => {
      if (captureForm?.campaignId === null) {
        const linked = await tx.leadCaptureForm.updateMany({
          where: {
            id: captureForm.id,
            workspaceId: workspace.id,
            campaignId: null,
            status: 'ACTIVE',
          },
          data: { campaignId: parsed.value.campaignId },
        })
        if (linked.count !== 1) throw new Error('CAPTURE_FORM_CAMPAIGN_CHANGED')
      }
      const updated = await tx.landingPage.updateMany({
        where: { id: current.id, workspaceId: workspace.id, version: expectedVersion },
        data: {
          campaignId: parsed.value.campaignId,
          captureFormId: parsed.value.captureFormId,
          name: parsed.value.name,
          locale: parsed.value.locale,
          headline: parsed.value.headline,
          subheadline: parsed.value.subheadline,
          body: parsed.value.body,
          benefits: parsed.value.benefits as Prisma.InputJsonValue,
          proof: parsed.value.proof,
          primaryCtaLabel: parsed.value.primaryCtaLabel,
          primaryCtaUrl: parsed.value.primaryCtaUrl,
          theme: parsed.value.theme as Prisma.InputJsonValue,
          seoTitle: parsed.value.seoTitle,
          seoDescription: parsed.value.seoDescription,
          seoIndexable: parsed.value.seoIndexable,
          status: requestedStatus,
          version: nextVersion,
        },
      })
      if (updated.count !== 1) throw new Error('LANDING_PAGE_CONCURRENT_CHANGE')
      await tx.landingPageRevision.create({
        data: {
          landingPageId: current.id,
          version: nextVersion,
          snapshot: parsed.value as unknown as Prisma.InputJsonValue,
          changeNote: typeof body.changeNote === 'string' ? body.changeNote.trim().slice(0, 300) || null : null,
          createdById: userId,
        },
      })
      return tx.landingPage.findUniqueOrThrow({
        where: { id: current.id },
        include: {
          campaign: { select: { id: true, name: true } },
          captureForm: { select: { id: true, publicId: true, name: true, status: true, campaignId: true } },
        },
      })
    })
    return NextResponse.json({
      page: {
        ...page,
        publicPath: `/lp/${page.publicId}`,
        hasUnpublishedChanges: page.publishedVersion !== null && page.version !== page.publishedVersion,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'CAPTURE_FORM_CAMPAIGN_CHANGED') {
      return NextResponse.json({
        error: 'The capture form was linked elsewhere while you were editing. Refresh and choose again.',
        code: error.message,
      }, { status: 409 })
    }
    if (error instanceof Error && error.message === 'LANDING_PAGE_CONCURRENT_CHANGE') {
      return NextResponse.json({ error: 'Landing page changed while you were editing it. Refresh and try again.', code: error.message }, { status: 409 })
    }
    console.error('[Landing page update]', error)
    return NextResponse.json({ error: 'Landing page could not be updated.' }, { status: 500 })
  }
}
