import type { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { dbRateLimit } from '@/lib/dbRateLimit'
import { findPrimaryLeadWorkspace } from '@/lib/leadCrmAccess'
import { getLandingExperimentGate } from '@/lib/landingPageExperimentAccess'
import {
  buildChallengerSnapshot,
  landingExperimentSnapshotHash,
  parseLandingExperimentDraft,
  summarizeLandingExperimentVariant,
} from '@/lib/landingPageExperiment'
import type { PublicLandingPageSnapshot } from '@/lib/landingPageContract'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ id: string }> }

type EventCount = {
  experimentId: string | null
  experimentVariant: string | null
  eventType: string
  _count: { _all: number }
}

function countFor(counts: EventCount[], experimentId: string, variant: string, eventType: string) {
  return counts.find(row => (
    row.experimentId === experimentId
    && row.experimentVariant === variant
    && row.eventType === eventType
  ))?._count._all ?? 0
}

function evidenceFor(experiment: {
  id: string
  minimumVisitorsPerVariant: number
  minimumConversionsPerVariant: number
}, counts: EventCount[]) {
  const variant = (key: 'CONTROL' | 'CHALLENGER') => summarizeLandingExperimentVariant({
    reportedViews: countFor(counts, experiment.id, key, 'PAGE_VIEW'),
    reportedClicks: countFor(counts, experiment.id, key, 'CTA_CLICK'),
    confirmedSubmissions: countFor(counts, experiment.id, key, 'FORM_SUBMITTED'),
    minimumVisitorsPerVariant: experiment.minimumVisitorsPerVariant,
    minimumConversionsPerVariant: experiment.minimumConversionsPerVariant,
  })
  const control = variant('CONTROL')
  const challenger = variant('CHALLENGER')
  return {
    control,
    challenger,
    readyForHumanDecision: control.minimumEvidenceMet && challenger.minimumEvidenceMet,
    statisticalWinnerClaimed: false,
  }
}

export async function GET(req: NextRequest, context: Context) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await getLandingExperimentGate()
  if (!gate.ready) return NextResponse.json(gate.body, { status: 503 })
  const workspace = await findPrimaryLeadWorkspace(userId)
  if (!workspace) return NextResponse.json({ experiments: [], truth: { statisticalWinnerClaimed: false } })

  const { id } = await context.params
  const page = await prisma.landingPage.findFirst({
    where: { id, workspaceId: workspace.id },
    select: { id: true, name: true, status: true, publishedHash: true, publishedVersion: true, version: true },
  })
  if (!page) return NextResponse.json({ error: 'Landing page not found' }, { status: 404 })

  const experiments = await prisma.landingPageExperiment.findMany({
    where: { landingPageId: page.id, workspaceId: workspace.id },
    orderBy: { createdAt: 'desc' },
  })
  const counts = experiments.length ? await prisma.conversionEvent.groupBy({
    by: ['experimentId', 'experimentVariant', 'eventType'],
    where: { workspaceId: workspace.id, experimentId: { in: experiments.map(experiment => experiment.id) } },
    _count: { _all: true },
  }) : []

  return NextResponse.json({
    page,
    experiments: experiments.map(experiment => ({
      ...experiment,
      evidence: evidenceFor(experiment, counts),
    })),
    truth: {
      successMetric: 'SERVER_CONFIRMED_FORM_SUBMISSION',
      pageViews: 'CLIENT_REPORTED',
      decision: 'HUMAN_REVIEW_AFTER_MINIMUM_EVIDENCE',
      statisticalWinnerClaimed: false,
      revenueTracking: false,
    },
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(req: NextRequest, context: Context) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const gate = await getLandingExperimentGate()
  if (!gate.ready) return NextResponse.json(gate.body, { status: 503 })
  const rateLimit = await dbRateLimit(`landing-experiment-create:${userId}`, { limit: 20, windowMs: 24 * 60 * 60_000 })
  if (!rateLimit.ok) return NextResponse.json({ error: rateLimit.message, code: 'LANDING_EXPERIMENT_RATE_LIMITED' }, { status: 429 })

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Valid JSON body required' }, { status: 400 })
  const parsed = parseLandingExperimentDraft(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const workspace = await findPrimaryLeadWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const { id } = await context.params
  const page = await prisma.landingPage.findFirst({
    where: { id, workspaceId: workspace.id },
    select: {
      id: true,
      campaignId: true,
      status: true,
      version: true,
      publishedVersion: true,
      publishedSnapshot: true,
      publishedHash: true,
    },
  })
  if (!page || page.status !== 'PUBLISHED' || !page.publishedSnapshot || !page.publishedHash) {
    return NextResponse.json({ error: 'A published landing page is required before creating an experiment.' }, { status: 409 })
  }
  if (page.version !== page.publishedVersion) {
    return NextResponse.json({ error: 'Publish or discard draft changes before creating an experiment.' }, { status: 409 })
  }
  const control = page.publishedSnapshot as unknown as PublicLandingPageSnapshot
  if (control.schemaVersion !== 1 || control.primaryCta?.kind !== 'LEAD_FORM') {
    return NextResponse.json({ error: 'Experiments require a published lead-form CTA so the success metric can be server-confirmed.' }, { status: 409 })
  }
  const active = await prisma.landingPageExperiment.findFirst({
    where: { landingPageId: page.id, status: { in: ['DRAFT', 'RUNNING', 'PAUSED'] } },
    select: { id: true },
  })
  if (active) return NextResponse.json({ error: 'Finish or cancel the current experiment before creating another.' }, { status: 409 })

  const challenger = buildChallengerSnapshot(control, parsed.value.variable, parsed.value.challengerValue)
  const experiment = await prisma.landingPageExperiment.create({
    data: {
      workspaceId: workspace.id,
      campaignId: page.campaignId,
      landingPageId: page.id,
      hypothesis: parsed.value.hypothesis,
      variable: parsed.value.variable,
      successMetric: 'FORM_SUBMITTED',
      decisionRule: 'MANUAL_REVIEW_AFTER_MINIMUM_EVIDENCE',
      minimumVisitorsPerVariant: parsed.value.minimumVisitorsPerVariant,
      minimumConversionsPerVariant: parsed.value.minimumConversionsPerVariant,
      challengerAllocationPercent: parsed.value.challengerAllocationPercent,
      controlSnapshot: control as unknown as Prisma.InputJsonValue,
      controlHash: page.publishedHash,
      challengerSnapshot: challenger as unknown as Prisma.InputJsonValue,
      challengerHash: landingExperimentSnapshotHash(challenger),
      createdById: userId,
    },
  })
  return NextResponse.json({
    experiment,
    truth: { running: false, successMetric: 'SERVER_CONFIRMED_FORM_SUBMISSION', statisticalWinnerClaimed: false },
  }, { status: 201 })
}
