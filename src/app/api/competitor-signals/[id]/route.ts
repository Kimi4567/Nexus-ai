import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { attachBrainSignalSources } from '@/lib/brainSignalProvenance'
import { prisma } from '@/lib/prisma'

const db = prisma as any

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json() as { action?: unknown }
  const action = typeof body.action === 'string' ? body.action : ''
  if (!['review', 'dismiss', 'propose'].includes(action)) {
    return NextResponse.json({ error: 'Action must be review, dismiss, or propose.' }, { status: 400 })
  }

  const signal = await db.competitorSignal.findFirst({
    where: { id, workspace: { ownerId: user.id } },
    include: {
      competitor: { select: { name: true } },
      source: { select: { url: true } },
    },
  })
  if (!signal) return NextResponse.json({ error: 'Signal not found.' }, { status: 404 })
  if (signal.status === 'DISMISSED') return NextResponse.json({ error: 'Dismissed signals cannot be applied.' }, { status: 409 })

  if (action === 'review' || action === 'dismiss') {
    const updated = await db.competitorSignal.update({
      where: { id },
      data: {
        status: action === 'review' ? 'REVIEWED' : 'DISMISSED',
        reviewedAt: new Date(),
        reviewedBy: user.id,
      },
    })
    return NextResponse.json({ signal: updated })
  }

  if (signal.proposalId) {
    return NextResponse.json({ proposalId: signal.proposalId, alreadyExists: true })
  }
  const evidence = signal.evidence && typeof signal.evidence === 'object' ? signal.evidence as Record<string, unknown> : {}
  const observedAt = typeof evidence.currentCapturedAt === 'string'
    ? evidence.currentCapturedAt
    : signal.createdAt.toISOString()
  const proposed = `${signal.competitor.name}: ${signal.summary} Observed on the public source on ${observedAt.slice(0, 10)}; validate the live page before changing positioning.`
  const reason = attachBrainSignalSources(
    'A reviewed public-source change is available. Accepting this adds the exact note shown; it does not rewrite past campaigns or claim performance impact.',
    [{ url: signal.source.url, title: signal.title, publisher: signal.competitor.name, publishedAt: observedAt }],
  )
  const currentProfile = await prisma.brandProfile.findUnique({
    where: { workspaceId: signal.workspaceId },
    select: { strategicNotes: true },
  })

  const proposal = await prisma.$transaction(async transaction => {
    const tx = transaction as any
    const created = await tx.brainLearning.create({
      data: {
        workspaceId: signal.workspaceId,
        trigger: 'competitor_monitor',
        field: 'strategicNotes',
        displayName: 'Competitor source observation',
        icon: '🔎',
        current: currentProfile?.strategicNotes ?? null,
        proposed,
        reason,
        evidence: {
          competitorSignalId: signal.id,
          sourceUrl: signal.source.url,
          beforeText: signal.beforeText,
          afterText: signal.afterText,
          confidence: signal.confidence,
          performanceClaim: false,
          autoLearningApplied: false,
        },
      },
    })
    await tx.competitorSignal.update({
      where: { id: signal.id },
      data: {
        status: 'PROPOSED',
        proposalId: created.id,
        reviewedAt: new Date(),
        reviewedBy: user.id,
      },
    })
    return created
  })

  return NextResponse.json({
    proposalId: proposal.id,
    message: 'A separate Brand Brain proposal was created. Brand Brain has not changed.',
  })
}
