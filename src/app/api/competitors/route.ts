import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { normalizeCompetitorUrl, scanCompetitorSource } from '@/lib/competitorMonitoring'
import { prisma } from '@/lib/prisma'

const db = prisma as any
const MAX_ACTIVE_COMPETITORS = 5

async function ownerWorkspace(userId: string) {
  return prisma.workspace.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: 'asc' },
  })
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const workspace = await ownerWorkspace(user.id)
  if (!workspace) return NextResponse.json({ competitors: [], signals: [], runs: [] })

  const [competitors, signals, runs] = await Promise.all([
    db.competitor.findMany({
      where: { workspaceId: workspace.id },
      include: {
        sources: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            type: true,
            url: true,
            enabled: true,
            cadenceHours: true,
            nextScanAt: true,
            lastCheckedAt: true,
            lastSuccessAt: true,
            lastStatusCode: true,
            robotsAllowed: true,
            lastError: true,
            _count: { select: { snapshots: true, signals: true } },
          },
        },
        _count: { select: { signals: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.competitorSignal.findMany({
      where: { workspaceId: workspace.id },
      include: {
        competitor: { select: { name: true, domain: true } },
        source: { select: { url: true, type: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    db.competitorResearchRun.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { startedAt: 'desc' },
      take: 10,
    }),
  ])

  return NextResponse.json({
    competitors,
    signals,
    runs,
    policy: {
      maxActiveCompetitors: MAX_ACTIVE_COMPETITORS,
      sourceType: 'user-confirmed-public-website',
      autoLearning: false,
      performanceMonitoring: false,
      creditCostPerScan: 0,
    },
  })
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const workspace = await ownerWorkspace(user.id)
    if (!workspace) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

    const body = await req.json() as { name?: unknown; websiteUrl?: unknown }
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : ''
    const websiteInput = typeof body.websiteUrl === 'string' ? body.websiteUrl.trim() : ''
    if (name.length < 2 || !websiteInput) {
      return NextResponse.json({ error: 'Competitor name and the public website you confirm as official are required.' }, { status: 400 })
    }
    let normalized: ReturnType<typeof normalizeCompetitorUrl>
    try {
      normalized = normalizeCompetitorUrl(websiteInput)
    } catch (error) {
      return NextResponse.json({
        error: error instanceof Error ? error.message : 'A valid public HTTP or HTTPS website is required.',
      }, { status: 400 })
    }
    const [activeCount, duplicate, profile] = await Promise.all([
      db.competitor.count({ where: { workspaceId: workspace.id, status: 'ACTIVE' } }),
      db.competitor.findUnique({
        where: { workspaceId_domain: { workspaceId: workspace.id, domain: normalized.domain } },
        select: { id: true },
      }),
      prisma.brandProfile.findUnique({
        where: { workspaceId: workspace.id },
        select: { competitors: true },
      }),
    ])
    if (duplicate) return NextResponse.json({ error: 'This user-confirmed domain is already monitored.' }, { status: 409 })
    if (activeCount >= MAX_ACTIVE_COMPETITORS) {
      return NextResponse.json({ error: `The current workspace limit is ${MAX_ACTIVE_COMPETITORS} active competitors.` }, { status: 409 })
    }

    const created = await prisma.$transaction(async transaction => {
      const tx = transaction as any
      const competitor = await tx.competitor.create({
        data: {
          workspaceId: workspace.id,
          name,
          normalizedName: name.toLocaleLowerCase(),
          websiteUrl: normalized.url,
          domain: normalized.domain,
          baselineStatus: 'RUNNING',
          nextScanAt: new Date(),
          sources: {
            create: {
              workspaceId: workspace.id,
              type: 'HOME',
              url: normalized.url,
              normalizedUrl: normalized.url,
              nextScanAt: new Date(),
            },
          },
        },
        include: { sources: true },
      })
      const names = Array.from(new Set([...(profile?.competitors ?? []), name]))
      await tx.brandProfile.upsert({
        where: { workspaceId: workspace.id },
        update: { competitors: names },
        create: { workspaceId: workspace.id, competitors: names },
      })
      return competitor
    })

    const run = await db.competitorResearchRun.create({
      data: {
        workspaceId: workspace.id,
        trigger: 'BASELINE',
        sourcesSelected: 1,
      },
    })
    const result = await scanCompetitorSource(created.sources[0].id, 'BASELINE')
    await db.competitorResearchRun.update({
      where: { id: run.id },
      data: {
        status: result.checked ? 'COMPLETED' : 'FAILED',
        sourcesChecked: result.checked ? 1 : 0,
        changesDetected: 0,
        signalsCreated: 0,
        errors: result.error ? [result.error] : [],
        completedAt: new Date(),
      },
    })

    const competitor = await db.competitor.findUnique({
      where: { id: created.id },
      include: { sources: true, _count: { select: { signals: true } } },
    })
    return NextResponse.json({
      competitor,
      baseline: result,
      message: result.checked
        ? 'Baseline captured. No alert is created until a later source change is observed.'
        : 'Competitor saved, but the baseline could not be captured. Review the source error before relying on monitoring.',
    }, { status: 201 })
  } catch (error) {
    console.error('[competitors POST]', error)
    const message = error instanceof Error ? error.message : 'Failed to add competitor.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
