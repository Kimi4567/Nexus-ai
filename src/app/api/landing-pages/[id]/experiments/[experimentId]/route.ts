import type { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { findPrimaryLeadWorkspace } from '@/lib/leadCrmAccess'
import { getLandingExperimentGate } from '@/lib/landingPageExperimentAccess'
import {
  applyChallengerToDraft,
  LANDING_EXPERIMENT_DECISIONS,
  summarizeLandingExperimentVariant,
  type LandingExperimentDecision,
  type LandingExperimentVariable,
} from '@/lib/landingPageExperiment'
import { parseLandingPageDraft, type PublicLandingPageSnapshot } from '@/lib/landingPageContract'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ id: string; experimentId: string }> }

function cleanNote(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 1_000) : null
}

async function experimentEvidence(experiment: {
  id: string
  minimumVisitorsPerVariant: number
  minimumConversionsPerVariant: number
}) {
  const counts = await prisma.conversionEvent.groupBy({
    by: ['experimentVariant', 'eventType'],
    where: { experimentId: experiment.id },
    _count: { _all: true },
  })
  const summarize = (key: 'CONTROL' | 'CHALLENGER') => {
    const count = (eventType: string) => counts.find(row => row.experimentVariant === key && row.eventType === eventType)?._count._all ?? 0
    return summarizeLandingExperimentVariant({
      reportedViews: count('PAGE_VIEW'),
      reportedClicks: count('CTA_CLICK'),
      confirmedSubmissions: count('FORM_SUBMITTED'),
      minimumVisitorsPerVariant: experiment.minimumVisitorsPerVariant,
      minimumConversionsPerVariant: experiment.minimumConversionsPerVariant,
    })
  }
  const control = summarize('CONTROL')
  const challenger = summarize('CHALLENGER')
  return {
    control,
    challenger,
    readyForHumanDecision: control.minimumEvidenceMet && challenger.minimumEvidenceMet,
    capturedAt: new Date().toISOString(),
    statisticalWinnerClaimed: false,
  }
}

export async function PATCH(req: NextRequest, context: Context) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await getLandingExperimentGate()
  if (!gate.ready) return NextResponse.json(gate.body, { status: 503 })
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const action = typeof body?.action === 'string' ? body.action.toUpperCase() : ''
  const expectedVersion = Number(body?.expectedVersion)
  if (!['START', 'PAUSE', 'COMPLETE', 'CANCEL'].includes(action)) {
    return NextResponse.json({ error: 'Action must be START, PAUSE, COMPLETE, or CANCEL.' }, { status: 400 })
  }
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return NextResponse.json({ error: 'expectedVersion is required.' }, { status: 400 })
  }

  const workspace = await findPrimaryLeadWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const { id, experimentId } = await context.params
  const experiment = await prisma.landingPageExperiment.findFirst({
    where: { id: experimentId, landingPageId: id, workspaceId: workspace.id },
  })
  if (!experiment) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 })
  if (experiment.version !== expectedVersion) {
    return NextResponse.json({ error: 'Experiment changed before this decision. Refresh and review again.', code: 'LANDING_EXPERIMENT_CONCURRENT_CHANGE' }, { status: 409 })
  }

  const page = await prisma.landingPage.findFirst({ where: { id, workspaceId: workspace.id } })
  if (!page) return NextResponse.json({ error: 'Landing page not found' }, { status: 404 })

  if (action === 'START') {
    if (!['DRAFT', 'PAUSED'].includes(experiment.status)) return NextResponse.json({ error: 'Only a draft or paused experiment can start.' }, { status: 409 })
    if (page.status !== 'PUBLISHED' || page.publishedHash !== experiment.controlHash || page.version !== page.publishedVersion) {
      return NextResponse.json({ error: 'The published page changed after this experiment was prepared. Create a new experiment.' }, { status: 409 })
    }
    try {
      const updated = await prisma.landingPageExperiment.updateMany({
        where: { id: experiment.id, workspaceId: workspace.id, version: expectedVersion, status: experiment.status },
        data: {
          status: 'RUNNING',
          startedAt: experiment.startedAt || new Date(),
          pausedAt: null,
          version: { increment: 1 },
        },
      })
      if (updated.count !== 1) throw new Error('LANDING_EXPERIMENT_CONCURRENT_CHANGE')
      return NextResponse.json({ experiment: await prisma.landingPageExperiment.findUniqueOrThrow({ where: { id: experiment.id } }) })
    } catch (error) {
      const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : null
      if (code === 'P2002') return NextResponse.json({ error: 'Another experiment is already running on this page.' }, { status: 409 })
      if (error instanceof Error && error.message === 'LANDING_EXPERIMENT_CONCURRENT_CHANGE') {
        return NextResponse.json({ error: 'Experiment changed before start.', code: error.message }, { status: 409 })
      }
      console.error('[Landing experiment start]', error)
      return NextResponse.json({ error: 'Experiment could not be started.' }, { status: 500 })
    }
  }

  if (action === 'PAUSE') {
    if (experiment.status !== 'RUNNING') return NextResponse.json({ error: 'Only a running experiment can be paused.' }, { status: 409 })
    const updated = await prisma.landingPageExperiment.updateMany({
      where: { id: experiment.id, workspaceId: workspace.id, version: expectedVersion, status: 'RUNNING' },
      data: { status: 'PAUSED', pausedAt: new Date(), version: { increment: 1 } },
    })
    if (updated.count !== 1) return NextResponse.json({ error: 'Experiment changed before pause.' }, { status: 409 })
    return NextResponse.json({ experiment: await prisma.landingPageExperiment.findUniqueOrThrow({ where: { id: experiment.id } }) })
  }

  if (action === 'CANCEL') {
    if (!['DRAFT', 'RUNNING', 'PAUSED'].includes(experiment.status)) return NextResponse.json({ error: 'This experiment can no longer be cancelled.' }, { status: 409 })
    const updated = await prisma.landingPageExperiment.updateMany({
      where: { id: experiment.id, workspaceId: workspace.id, version: expectedVersion, status: experiment.status },
      data: { status: 'CANCELLED', endedAt: new Date(), decisionNote: cleanNote(body?.decisionNote), version: { increment: 1 } },
    })
    if (updated.count !== 1) return NextResponse.json({ error: 'Experiment changed before cancellation.' }, { status: 409 })
    return NextResponse.json({ experiment: await prisma.landingPageExperiment.findUniqueOrThrow({ where: { id: experiment.id } }) })
  }

  if (!['RUNNING', 'PAUSED'].includes(experiment.status)) {
    return NextResponse.json({ error: 'Only a running or paused experiment can be completed.' }, { status: 409 })
  }
  const decision = typeof body?.decision === 'string' ? body.decision.toUpperCase() : ''
  if (!LANDING_EXPERIMENT_DECISIONS.includes(decision as LandingExperimentDecision)) {
    return NextResponse.json({ error: 'A valid completion decision is required.' }, { status: 400 })
  }
  const evidence = await experimentEvidence(experiment)
  if (decision !== 'INCONCLUSIVE' && !evidence.readyForHumanDecision) {
    return NextResponse.json({
      error: 'Minimum evidence is not met for both variants. Stop as inconclusive or continue the experiment.',
      code: 'LANDING_EXPERIMENT_MINIMUM_EVIDENCE_REQUIRED',
      evidence,
    }, { status: 409 })
  }

  const decisionNote = cleanNote(body?.decisionNote)
  if (decision !== 'INCONCLUSIVE' && (!decisionNote || decisionNote.length < 10)) {
    return NextResponse.json({ error: 'A short human decision note is required when selecting a variant.' }, { status: 400 })
  }
  const now = new Date()
  try {
    const result = await prisma.$transaction(async tx => {
      const updated = await tx.landingPageExperiment.updateMany({
        where: { id: experiment.id, workspaceId: workspace.id, version: expectedVersion, status: experiment.status },
        data: {
          status: 'COMPLETED',
          endedAt: now,
          decision,
          decisionNote,
          decisionEvidence: evidence as unknown as Prisma.InputJsonValue,
          decidedById: userId,
          version: { increment: 1 },
        },
      })
      if (updated.count !== 1) throw new Error('LANDING_EXPERIMENT_CONCURRENT_CHANGE')

      let landingPageVersion: number | null = null
      if (decision === 'APPLY_CHALLENGER_DRAFT') {
        if (page.status !== 'PUBLISHED' || page.publishedHash !== experiment.controlHash || page.version !== page.publishedVersion) {
          throw new Error('LANDING_EXPERIMENT_PAGE_CHANGED')
        }
        const currentDraft = parseLandingPageDraft({
          name: page.name,
          campaignId: page.campaignId,
          captureFormId: page.captureFormId,
          locale: page.locale,
          headline: page.headline,
          subheadline: page.subheadline,
          body: page.body,
          benefits: page.benefits,
          proof: page.proof,
          primaryCtaLabel: page.primaryCtaLabel,
          primaryCtaUrl: page.primaryCtaUrl,
          theme: page.theme,
          seoTitle: page.seoTitle,
          seoDescription: page.seoDescription,
          seoIndexable: page.seoIndexable,
        })
        if (!currentDraft.ok) throw new Error('LANDING_EXPERIMENT_PAGE_CHANGED')
        const challenger = experiment.challengerSnapshot as unknown as PublicLandingPageSnapshot
        const nextDraft = applyChallengerToDraft(currentDraft.value, experiment.variable as LandingExperimentVariable, challenger)
        const nextVersion = page.version + 1
        const pageUpdated = await tx.landingPage.updateMany({
          where: { id: page.id, workspaceId: workspace.id, version: page.version, publishedHash: experiment.controlHash },
          data: {
            headline: nextDraft.headline,
            subheadline: nextDraft.subheadline,
            primaryCtaLabel: nextDraft.primaryCtaLabel,
            version: nextVersion,
          },
        })
        if (pageUpdated.count !== 1) throw new Error('LANDING_EXPERIMENT_PAGE_CHANGED')
        await tx.landingPageRevision.create({
          data: {
            landingPageId: page.id,
            version: nextVersion,
            snapshot: nextDraft as unknown as Prisma.InputJsonValue,
            changeNote: `Experiment ${experiment.id}: challenger prepared after human decision`,
            createdById: userId,
          },
        })
        landingPageVersion = nextVersion
      }
      return {
        experiment: await tx.landingPageExperiment.findUniqueOrThrow({ where: { id: experiment.id } }),
        landingPageVersion,
      }
    })
    return NextResponse.json({
      ...result,
      challengerAppliedToDraftOnly: decision === 'APPLY_CHALLENGER_DRAFT',
      requiresSeparatePublishReview: decision === 'APPLY_CHALLENGER_DRAFT',
      evidence,
    })
  } catch (error) {
    if (error instanceof Error && ['LANDING_EXPERIMENT_CONCURRENT_CHANGE', 'LANDING_EXPERIMENT_PAGE_CHANGED'].includes(error.message)) {
      return NextResponse.json({ error: 'The experiment or page changed before completion. Refresh and review again.', code: error.message }, { status: 409 })
    }
    console.error('[Landing experiment completion]', error)
    return NextResponse.json({ error: 'Experiment could not be completed.' }, { status: 500 })
  }
}
