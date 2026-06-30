import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureDbUser, getServerUserId } from '@/lib/apiAuth'
import { PLAN_CAMPAIGN_LIMIT } from '@/lib/stripe'
import { summarizeDashboardPosts } from '@/lib/dashboardTruth'
import type { Platform, UserRole } from '@prisma/client'

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
  return raw
    .map((p) => PLATFORM_MAP[p] ?? PLATFORM_MAP[p.toLowerCase()] ?? null)
    .filter((p): p is string => p !== null && valid.has(p)) as Platform[]
}

// Helper — get or create default workspace+project for a user
// userId + email both required so we can ensure the User row exists first
async function getOrCreateDefaultProject(userId: string, email: string): Promise<{ workspaceId: string; projectId: string } | null> {
  try {
    // Ensure User row exists before creating workspace (FK constraint)
    await prisma.user.upsert({
      where: { id: userId },
      update: { email },
      create: { id: userId, email },
    })

    let workspace = await prisma.workspace.findFirst({ where: { ownerId: userId } })
    if (!workspace) {
      workspace = await prisma.workspace.create({
        data: { name: 'My Workspace', slug: `workspace-${userId.slice(0, 8)}-${Date.now()}`, ownerId: userId },
      })
    }
    let project = await prisma.project.findFirst({ where: { workspaceId: workspace.id } })
    if (!project) {
      project = await prisma.project.create({
        data: { name: 'My Project', workspaceId: workspace.id },
      })
    }
    return { workspaceId: workspace.id, projectId: project.id }
  } catch {
    return null
  }
}

// POST /api/campaigns — save a campaign with full AI output
export async function POST(req: NextRequest) {
  const authUser = await ensureDbUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: userId, email: userEmail } = authUser

  try {
    const body = await req.json()
    const { name, goal, audience, tone, platforms, description, aiOutput } = body

    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

    // ── Enforce campaign limit per plan ──────────────────────────────────────
    // Check both user status and subscription plan for accurate limit
    const [dbUser, subscription] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { subscriptionStatus: true, role: true } }),
      (prisma as any).subscription.findUnique({ where: { userId }, select: { plan: true, status: true } }),
    ])

    // ADMIN users bypass all limits
    const isAdmin = dbUser?.role === ('ADMIN' as UserRole)
    if (!isAdmin) {
      const status = dbUser?.subscriptionStatus || 'FREE'
      // Derive plan: use subscription.plan if ACTIVE, else fall back to status
      const planKey = (
        subscription?.status === 'ACTIVE' && subscription?.plan
          ? subscription.plan
          : status
      ).toUpperCase()
      const limit = PLAN_CAMPAIGN_LIMIT[planKey] ?? PLAN_CAMPAIGN_LIMIT['FREE']

      if (limit !== 999) {
        const workspace = await prisma.workspace.findFirst({ where: { ownerId: userId }, select: { id: true } })
        if (workspace) {
          const existing = await prisma.campaign.count({ where: { workspaceId: workspace.id } })
          if (existing >= limit) {
            return NextResponse.json({
              error: 'CAMPAIGN_LIMIT_REACHED',
              message: `Your plan allows up to ${limit} campaign${limit === 1 ? '' : 's'}. Upgrade to create more.`,
              upgradeUrl: '/billing',
            }, { status: 402 })
          }
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const ids = await getOrCreateDefaultProject(userId, userEmail)
    if (!ids) return NextResponse.json({ error: 'Could not create workspace' }, { status: 500 })

    const THUMBNAILS = ['🚀', '⚡', '🎯', '🔥', '💡', '🌟', '📣', '🎪', '💎', '🎨']
    const thumbnail = THUMBNAILS[Math.floor(Math.random() * THUMBNAILS.length)]

    // Normalize display names → Prisma enum values (e.g. 'Facebook' → 'FACEBOOK')
    const normalizedPlatforms = normalizePlatforms(Array.isArray(platforms) ? platforms : [])

    const campaign = await prisma.campaign.create({
      data: {
        name,
        description,
        goal: goal || 'SALES',
        audience: audience || '',
        tone: tone || 'MODERN',
        platforms: normalizedPlatforms,
        workspaceId: ids.workspaceId,
        projectId: ids.projectId,
        status: 'DRAFT',
        aiOutput: aiOutput || null,
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

    return NextResponse.json({ id: campaign.id, campaign })
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

    const campaignIds = campaigns.map(c => c.id)
    const posts = campaignIds.length
      ? await (prisma as any).socialPost.findMany({
          where: { workspace: { ownerId: userId }, campaignId: { in: campaignIds } },
          select: {
            campaignId: true,
            status: true,
            publishMode: true,
            manuallyPublishedAt: true,
            platformPostId: true,
            platformUrl: true,
            analyticsData: true,
            analyticsFetched: true,
          },
        })
      : []

    const postsByCampaign = new Map<string, any[]>()
    for (const post of posts) {
      if (!post.campaignId) continue
      const list = postsByCampaign.get(post.campaignId) ?? []
      list.push(post)
      postsByCampaign.set(post.campaignId, list)
    }

    const campaignsWithPostSummary = campaigns.map(c => ({
      ...c,
      postSummary: summarizeDashboardPosts(postsByCampaign.get(c.id) ?? []),
    }))

    return NextResponse.json({ campaigns: campaignsWithPostSummary, counts: { total, active, draft } })
  } catch (err: any) {
    console.error('[campaigns GET]', err)
    return NextResponse.json({ campaigns: [], counts: { total: 0, active: 0, draft: 0 } })
  }
}
