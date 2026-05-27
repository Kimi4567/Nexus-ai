/**
 * GET /api/campaigns/today
 * Returns "today's post" from the user's most recent active/draft campaign.
 * Looks at the contentCalendar in aiOutput, figures out which day we're on,
 * and returns the matching post entry + campaign context.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'

const DAY_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

function getDayName(): string {
  return DAY_ORDER[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]
}

function flattenCalendar(contentCalendar: any[]): any[] {
  const posts: any[] = []
  for (const week of contentCalendar || []) {
    for (const post of week.posts || []) {
      posts.push({ ...post, week: week.week })
    }
  }
  return posts
}

export async function GET(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Find user's workspace
    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
    })
    if (!workspace) return NextResponse.json({ today: null })

    // Get the most recent campaign with AI output
    const campaign = await (prisma.campaign as any).findFirst({
      where: {
        workspaceId: workspace.id,
        aiOutput: { not: null },
        status: { in: ['ACTIVE', 'DRAFT'] },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        goal: true,
        platforms: true,
        aiOutput: true,
        createdAt: true,
        status: true,
      },
    })

    if (!campaign?.aiOutput) return NextResponse.json({ today: null })

    const aiOutput = campaign.aiOutput as any
    const contentCalendar: any[] = aiOutput?.strategy?.contentCalendar || []

    if (!contentCalendar.length) return NextResponse.json({ today: null })

    // Figure out which calendar day to show
    // Based on: days since campaign created + today's day of week
    const daysSinceCreated = Math.floor(
      (Date.now() - new Date(campaign.createdAt).getTime()) / 86_400_000
    )
    const todayName = getDayName()
    const allPosts = flattenCalendar(contentCalendar)

    // Try to find today's day name in the calendar first
    let post = allPosts.find(p => p.day === todayName)

    // If no match for today's name, use index based on days elapsed
    if (!post) {
      post = allPosts[daysSinceCreated % allPosts.length]
    }

    if (!post) return NextResponse.json({ today: null })

    return NextResponse.json({
      today: {
        campaignId: campaign.id,
        campaignName: campaign.name,
        campaignGoal: campaign.goal,
        day: post.day || todayName,
        week: post.week || 'Week 1',
        platform: post.platform || (campaign.platforms[0] || 'INSTAGRAM'),
        type: post.type || 'Content Post',
        topic: post.topic || '',
        format: post.format || 'Video',
        caption: post.caption || '',
        daysSinceCreated,
        totalPosts: allPosts.length,
        postIndex: allPosts.indexOf(post) + 1,
      },
    })
  } catch (err: any) {
    console.error('[today] error', err)
    return NextResponse.json({ today: null })
  }
}
