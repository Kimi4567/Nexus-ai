import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { scanCompetitorSource } from '@/lib/competitorMonitoring'
import { prisma } from '@/lib/prisma'

const db = prisma as any

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const competitor = await db.competitor.findFirst({
    where: { id, workspace: { ownerId: user.id } },
    include: { sources: { where: { enabled: true }, take: 5 } },
  })
  if (!competitor) return NextResponse.json({ error: 'Competitor not found.' }, { status: 404 })
  if (competitor.status !== 'ACTIVE') return NextResponse.json({ error: 'Resume this competitor before scanning.' }, { status: 409 })

  const run = await db.competitorResearchRun.create({
    data: {
      workspaceId: competitor.workspaceId,
      trigger: competitor.baselineAt ? 'MANUAL' : 'BASELINE',
      sourcesSelected: competitor.sources.length,
    },
  })
  const results = []
  for (const source of competitor.sources) {
    results.push(await scanCompetitorSource(source.id, competitor.baselineAt ? 'MANUAL' : 'BASELINE'))
  }
  const errors = results.flatMap(result => result.error ? [result.error] : [])
  const checked = results.filter(result => result.checked).length
  const signalsCreated = results.filter(result => result.signalCreated).length
  await db.competitorResearchRun.update({
    where: { id: run.id },
    data: {
      status: errors.length === 0 ? 'COMPLETED' : checked > 0 ? 'PARTIAL' : 'FAILED',
      sourcesChecked: checked,
      changesDetected: results.filter(result => result.changed).length,
      signalsCreated,
      errors,
      completedAt: new Date(),
    },
  })
  return NextResponse.json({
    ok: errors.length === 0,
    results,
    message: signalsCreated > 0
      ? `${signalsCreated} source change signal(s) created for review.`
      : 'Scan completed with no new reviewed change signal.',
  }, { status: checked > 0 ? 200 : 502 })
}
