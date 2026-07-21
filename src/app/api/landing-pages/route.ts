import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getServerUserId } from '@/lib/apiAuth'
import { dbRateLimit } from '@/lib/dbRateLimit'
import { findPrimaryLeadWorkspace } from '@/lib/leadCrmAccess'
import { getLandingPageGate } from '@/lib/landingPageAccess'
import { parseLandingPageDraft } from '@/lib/landingPageContract'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function publicPagePath(publicId: string) {
  return `/lp/${publicId}`
}

export async function GET(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await getLandingPageGate()
  if (!gate.ready) return NextResponse.json(gate.body, { status: 503 })

  const workspace = await findPrimaryLeadWorkspace(userId)
  if (!workspace) {
    return NextResponse.json({ pages: [], campaigns: [], captureForms: [], summary: { total: 0, reportedViews: 0, reportedClicks: 0, confirmedSubmissions: 0 } })
  }

  const [pages, campaigns, captureForms, eventCounts] = await Promise.all([
    prisma.landingPage.findMany({
      where: { workspaceId: workspace.id },
      include: {
        campaign: { select: { id: true, name: true } },
        captureForm: { select: { id: true, publicId: true, name: true, status: true, campaignId: true } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.campaign.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true, name: true, status: true },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
    prisma.leadCaptureForm.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true, publicId: true, name: true, title: true, status: true, campaignId: true },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
    prisma.conversionEvent.groupBy({
      by: ['landingPageId', 'eventType'],
      where: { workspaceId: workspace.id },
      _count: { _all: true },
    }),
  ])

  const countFor = (landingPageId: string, eventType: string) => eventCounts
    .find(row => row.landingPageId === landingPageId && row.eventType === eventType)?._count._all ?? 0
  const serialized = pages.map(page => ({
    ...page,
    publicPath: publicPagePath(page.publicId),
    hasUnpublishedChanges: page.publishedVersion !== null && page.version !== page.publishedVersion,
    evidence: {
      reportedViews: countFor(page.id, 'PAGE_VIEW'),
      reportedClicks: countFor(page.id, 'CTA_CLICK'),
      confirmedSubmissions: countFor(page.id, 'FORM_SUBMITTED'),
    },
  }))

  return NextResponse.json({
    pages: serialized,
    campaigns,
    captureForms,
    summary: serialized.reduce((summary, page) => ({
      total: summary.total + 1,
      reportedViews: summary.reportedViews + page.evidence.reportedViews,
      reportedClicks: summary.reportedClicks + page.evidence.reportedClicks,
      confirmedSubmissions: summary.confirmedSubmissions + page.evidence.confirmedSubmissions,
    }), { total: 0, reportedViews: 0, reportedClicks: 0, confirmedSubmissions: 0 }),
    conversionTruth: {
      pageViews: 'CLIENT_REPORTED',
      ctaClicks: 'CLIENT_REPORTED',
      formSubmissions: 'SERVER_CONFIRMED',
      wonOutcomes: 'MANUAL_CONFIRMED',
      revenueTracking: 'MANUAL_CONFIRMED',
      platformPermissionsRequired: false,
    },
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await getLandingPageGate()
  if (!gate.ready) return NextResponse.json(gate.body, { status: 503 })

  const rateLimit = await dbRateLimit(`landing-page-create:${userId}`, { limit: 30, windowMs: 24 * 60 * 60_000 })
  if (!rateLimit.ok) return NextResponse.json({ error: rateLimit.message, code: 'LANDING_PAGE_RATE_LIMITED' }, { status: 429 })
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Valid JSON body required' }, { status: 400 })
  const parsed = parseLandingPageDraft(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const workspace = await findPrimaryLeadWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const [campaign, captureForm] = await Promise.all([
    prisma.campaign.findFirst({
      where: { id: parsed.value.campaignId, workspaceId: workspace.id },
      select: { id: true },
    }),
    parsed.value.captureFormId ? prisma.leadCaptureForm.findFirst({
      where: { id: parsed.value.captureFormId, workspaceId: workspace.id },
      select: { id: true, campaignId: true },
    }) : Promise.resolve(null),
  ])
  if (!campaign) return NextResponse.json({ error: 'Campaign not found in this workspace.' }, { status: 400 })
  if (parsed.value.captureFormId && !captureForm) {
    return NextResponse.json({ error: 'Capture form not found in this workspace.' }, { status: 400 })
  }
  if (captureForm && captureForm.campaignId !== parsed.value.campaignId) {
    return NextResponse.json({ error: 'Capture form must belong to the same campaign as the landing page.' }, { status: 400 })
  }

  const page = await prisma.$transaction(async tx => {
    const created = await tx.landingPage.create({
      data: {
        workspaceId: workspace.id,
        campaignId: parsed.value.campaignId,
        captureFormId: parsed.value.captureFormId,
        createdById: userId,
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
      },
    })
    await tx.landingPageRevision.create({
      data: {
        landingPageId: created.id,
        version: 1,
        snapshot: parsed.value as unknown as Prisma.InputJsonValue,
        changeNote: 'Initial draft',
        createdById: userId,
      },
    })
    return created
  })

  return NextResponse.json({
    page: { ...page, publicPath: publicPagePath(page.publicId), hasUnpublishedChanges: false },
  }, { status: 201 })
}
