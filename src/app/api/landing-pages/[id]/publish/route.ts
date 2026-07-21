import type { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { findPrimaryLeadWorkspace } from '@/lib/leadCrmAccess'
import { getLandingPageGate } from '@/lib/landingPageAccess'
import { buildPublicLandingPageSnapshot, hashLandingPageSnapshot, parseLandingPageDraft } from '@/lib/landingPageContract'
import { getLandingExperimentGate } from '@/lib/landingPageExperimentAccess'
import { isLandingPageExperimentsRequested } from '@/lib/landingPageExperimentReadiness'
import { prisma } from '@/lib/prisma'
import { landingPageCanonicalUrl } from '@/lib/landingPageSeo'
import { hasUsableConversionDestination } from '@/lib/strategyBriefReadiness'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, context: Context) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await getLandingPageGate()
  if (!gate.ready) return NextResponse.json(gate.body, { status: 503 })
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const expectedVersion = Number(body?.expectedVersion)
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return NextResponse.json({ error: 'expectedVersion is required for a safe publish.' }, { status: 400 })
  }

  const workspace = await findPrimaryLeadWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const { id } = await context.params
  const current = await prisma.landingPage.findFirst({ where: { id, workspaceId: workspace.id } })
  if (!current) return NextResponse.json({ error: 'Landing page not found' }, { status: 404 })
  if (current.status === 'ARCHIVED') return NextResponse.json({ error: 'Archived landing pages cannot be published.' }, { status: 409 })
  if (current.version !== expectedVersion) {
    return NextResponse.json({ error: 'Landing page changed before publish. Refresh and review the latest version.', code: 'LANDING_PAGE_CONCURRENT_CHANGE' }, { status: 409 })
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
        error: 'Complete or cancel the active experiment before publishing another page version.',
        code: 'LANDING_EXPERIMENT_PAGE_LOCKED',
      }, { status: 409 })
    }
  }

  const parsed = parseLandingPageDraft({
    name: current.name,
    campaignId: current.campaignId,
    captureFormId: current.captureFormId,
    locale: current.locale,
    headline: current.headline,
    subheadline: current.subheadline,
    body: current.body,
    benefits: current.benefits,
    proof: current.proof,
    primaryCtaLabel: current.primaryCtaLabel,
    primaryCtaUrl: current.primaryCtaUrl,
    theme: current.theme,
    seoTitle: current.seoTitle,
    seoDescription: current.seoDescription,
    seoIndexable: current.seoIndexable,
  })
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const captureForm = current.captureFormId ? await prisma.leadCaptureForm.findFirst({
    where: { id: current.captureFormId, workspaceId: workspace.id },
    select: { publicId: true, status: true, campaignId: true },
  }) : null
  if (current.captureFormId && (!captureForm || captureForm.status !== 'ACTIVE')) {
    return NextResponse.json({ error: 'The selected capture form must be active before publishing.' }, { status: 400 })
  }
  if (captureForm && captureForm.campaignId !== current.campaignId) {
    return NextResponse.json({ error: 'The selected capture form no longer belongs to this campaign.' }, { status: 409 })
  }

  let snapshot
  try {
    snapshot = buildPublicLandingPageSnapshot({
      publicId: current.publicId,
      draft: parsed.value,
      captureFormPublicId: captureForm?.publicId,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Landing page is not publishable.' }, { status: 400 })
  }
  const publishedHash = hashLandingPageSnapshot(snapshot)
  const canonicalDestination = landingPageCanonicalUrl(current.publicId)
  const brandProfile = await prisma.brandProfile.findUnique({
    where: { workspaceId: workspace.id },
    select: { conversionDestination: true },
  })
  const shouldSetBrandDestination = !hasUsableConversionDestination(brandProfile?.conversionDestination)
  const now = new Date()

  try {
    const page = await prisma.$transaction(async tx => {
      const updated = await tx.landingPage.updateMany({
        where: { id: current.id, workspaceId: workspace.id, version: expectedVersion },
        data: {
          status: 'PUBLISHED',
          publishedVersion: current.version,
          publishedSnapshot: snapshot as unknown as Prisma.InputJsonValue,
          publishedHash,
          publishedSeoIndexable: parsed.value.seoIndexable,
          publishedById: userId,
          publishedAt: now,
        },
      })
      if (updated.count !== 1) throw new Error('LANDING_PAGE_CONCURRENT_CHANGE')
      await tx.landingPageRevision.updateMany({
        where: { landingPageId: current.id, version: current.version },
        data: { publishedById: userId, publishedAt: now },
      })
      if (shouldSetBrandDestination) {
        await tx.brandProfile.updateMany({
          where: { workspaceId: workspace.id },
          data: { conversionDestination: canonicalDestination },
        })
      }
      return tx.landingPage.findUniqueOrThrow({ where: { id: current.id } })
    })
    return NextResponse.json({
      page: { ...page, publicPath: `/lp/${page.publicId}`, hasUnpublishedChanges: false },
      publishedSnapshotHash: publishedHash,
      conversionDestination: canonicalDestination,
      brandDestinationUpdated: shouldSetBrandDestination,
      conversionTruth: {
        formSubmissions: 'SERVER_CONFIRMED',
        wonOutcomes: 'MANUAL_CONFIRMED',
        revenueTracking: 'MANUAL_CONFIRMED',
        platformPermissionsRequired: false,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'LANDING_PAGE_CONCURRENT_CHANGE') {
      return NextResponse.json({ error: 'Landing page changed before publish. Refresh and review the latest version.', code: error.message }, { status: 409 })
    }
    console.error('[Landing page publish]', error)
    return NextResponse.json({ error: 'Landing page could not be published.' }, { status: 500 })
  }
}
