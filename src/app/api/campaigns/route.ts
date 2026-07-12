import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureDbUser, getServerUserId } from '@/lib/apiAuth'
import { readLockedCampaignAllowance } from '@/lib/campaignCommercial'
import { randomUUID } from 'crypto'
import type { BrandTone, CampaignGoal, Platform, Prisma } from '@prisma/client'

// Map display names → Prisma Platform enum values
const PLATFORM_MAP: Record<string, string> = {
  facebook:       'FACEBOOK',
  instagram:      'INSTAGRAM',
  tiktok:         'TIKTOK',
  'youtube shorts': 'YOUTUBE_SHORTS',
  youtube:        'YOUTUBE_SHORTS',
  snapchat:       'SNAPCHAT',
  linkedin:       'LINKEDIN',
  twitter:        'TWITTER',
  website:        'WEBSITE',
  // already-uppercase passthrough
  FACEBOOK:        'FACEBOOK',
  INSTAGRAM:       'INSTAGRAM',
  TIKTOK:          'TIKTOK',
  YOUTUBE_SHORTS:  'YOUTUBE_SHORTS',
  SNAPCHAT:        'SNAPCHAT',
  LINKEDIN:        'LINKEDIN',
  TWITTER:         'TWITTER',
  WEBSITE:         'WEBSITE',
}

function normalizePlatforms(raw: string[]): Platform[] {
  const valid = new Set(Object.values(PLATFORM_MAP))
  return [...new Set(raw
    .map((p) => PLATFORM_MAP[p] ?? PLATFORM_MAP[p.toLowerCase()] ?? null)
    .filter((p): p is string => p !== null && valid.has(p)))] as Platform[]
}

const GOALS = new Set<CampaignGoal>(['SALES', 'AWARENESS', 'LEADS', 'TRAFFIC', 'ENGAGEMENT', 'BRAND_BUILDING'])
const TONES = new Set<BrandTone>(['LUXURY', 'MODERN', 'ENERGETIC', 'CORPORATE', 'MINIMAL', 'AGGRESSIVE_SALES', 'FRIENDLY', 'PROFESSIONAL'])

function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

async function getOrCreateDefaultProject(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<{ workspaceId: string; projectId: string }> {
  // Share the workspace lock used by POST /api/workspaces. This prevents a
  // first-campaign request racing a first-workspace request on a free account.
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `workspace-limit:${userId}`)
  let workspace = await tx.workspace.findFirst({ where: { ownerId: userId }, orderBy: { createdAt: 'asc' } })
  if (!workspace) {
    workspace = await tx.workspace.create({
      data: {
        name: 'My Workspace',
        slug: `workspace-${userId.slice(0, 8)}-${randomUUID().slice(0, 8)}`,
        ownerId: userId,
      },
    })
  }
  let project = await tx.project.findFirst({ where: { workspaceId: workspace.id }, orderBy: { createdAt: 'asc' } })
  if (!project) {
    project = await tx.project.create({ data: { name: 'My Project', workspaceId: workspace.id } })
  }
  return { workspaceId: workspace.id, projectId: project.id }
}

// POST /api/campaigns — save a campaign with full AI output
export async function POST(req: NextRequest) {
  const authUser = await ensureDbUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: userId } = authUser

  try {
    const body = await req.json()
    const name = cleanText(body.name, 120)
    const description = cleanText(body.description, 2_000)
    const audience = cleanText(body.audience, 1_000)
    const requestedGoal = cleanText(body.goal, 40).toUpperCase() as CampaignGoal
    const requestedTone = cleanText(body.tone, 40).toUpperCase() as BrandTone
    const goal = GOALS.has(requestedGoal) ? requestedGoal : 'SALES'
    const tone = TONES.has(requestedTone) ? requestedTone : 'MODERN'
    const normalizedPlatforms = normalizePlatforms(Array.isArray(body.platforms) ? body.platforms.slice(0, 20) : [])
    const aiOutput = body.aiOutput ?? null

    if (name.length < 2) return NextResponse.json({ error: 'A valid campaign name is required' }, { status: 400 })
    if (aiOutput !== null && JSON.stringify(aiOutput).length > 1_000_000) {
      return NextResponse.json({ error: 'Campaign output is too large' }, { status: 413 })
    }

    const THUMBNAILS = ['🚀', '⚡', '🎯', '🔥', '💡', '🌟', '📣', '🎪', '💎', '🎨']
    const thumbnail = THUMBNAILS[Math.floor(Math.random() * THUMBNAILS.length)]

    const result = await prisma.$transaction(async (tx) => {
      const ids = await getOrCreateDefaultProject(tx, userId)
      const allowance = await readLockedCampaignAllowance(tx, userId)
      if (allowance.limit !== 999 && allowance.current >= allowance.limit) {
        return { limitReached: true as const, allowance }
      }

      const campaign = await tx.campaign.create({
        data: {
          name,
          description,
          goal,
          audience,
          tone,
          platforms: normalizedPlatforms,
          workspaceId: ids.workspaceId,
          projectId: ids.projectId,
          status: 'DRAFT',
          aiOutput,
          thumbnail,
          activities: {
            create: {
              type: 'created',
              description: `Campaign "${name}" created as a draft`,
            },
          },
        },
        include: { activities: true },
      })
      return { campaign, allowance }
    })

    if ('limitReached' in result) {
      return NextResponse.json({
        error: 'CAMPAIGN_LIMIT_REACHED',
        message: `Your plan allows ${result.allowance.limit} campaign creation${result.allowance.limit === 1 ? '' : 's'} per billing month.`,
        limit: result.allowance.limit,
        current: result.allowance.current,
        resetsAt: result.allowance.periodEnd.toISOString(),
        upgradeUrl: '/billing',
      }, { status: 403 })
    }

    return NextResponse.json({ id: result.campaign.id, campaign: result.campaign }, { status: 201 })
  } catch (err: any) {
    console.error('[campaigns POST]', err)
    return NextResponse.json({ error: err.message || 'Failed to save campaign' }, { status: 500 })
  }
}

// GET /api/campaigns — list with search, filter, sort
export async function GET(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const favorite = searchParams.get('favorite') === 'true'
    const sort = searchParams.get('sort') || 'createdAt'
    const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc'
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: any = {
      workspace: { ownerId: userId },
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      ...(status ? { status } : {}),
      ...(favorite ? { favorite: true } : {}),
    }

    // Workspace-wide counts for the summary cards. These are deliberately
    // independent of search/status/favorite filters and of the `limit` page
    // size, so the cards always reflect the TRUE totals (matching the dashboard)
    // rather than the currently-filtered/paginated rows.
    const baseWhere = { workspace: { ownerId: userId } } as const

    const [campaigns, total, active, draft] = await Promise.all([
      prisma.campaign.findMany({
        where,
        orderBy: { [sort]: order },
        take: limit,
        select: {
          id: true,
          name: true,
          description: true,
          goal: true,
          audience: true,
          tone: true,
          platforms: true,
          status: true,
          favorite: true,
          thumbnail: true,
          lastViewedAt: true,
          createdAt: true,
          updatedAt: true,
          aiOutput: true,  // Required by calendar page to extract calendarItems / contentCalendar
          _count: { select: { activities: true } },
        },
      }),
      prisma.campaign.count({ where: baseWhere }),
      prisma.campaign.count({ where: { ...baseWhere, status: 'ACTIVE' } }),
      prisma.campaign.count({ where: { ...baseWhere, status: 'DRAFT' } }),
    ])

    return NextResponse.json({ campaigns, counts: { total, active, draft } })
  } catch (err: any) {
    console.error('[campaigns GET]', err)
    return NextResponse.json({ campaigns: [], counts: { total: 0, active: 0, draft: 0 } })
  }
}
