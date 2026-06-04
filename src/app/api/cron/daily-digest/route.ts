/**
 * GET /api/cron/daily-digest
 * Runs every morning at 08:00 UTC.
 * For each active user with a campaign that has an aiOutput content calendar,
 * sends a "here's what to post today" email.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendDailyDigest } from '@/lib/email/resend'

export const dynamic = 'force-dynamic'

const DAY_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

function getDayName(): string {
  const d = new Date().getDay()
  return DAY_ORDER[d === 0 ? 6 : d - 1]
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
  // Verify cron secret — matches Vercel's Authorization: Bearer <CRON_SECRET> format
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret && process.env.NODE_ENV !== 'development') { return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 }) }
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ skipped: true, reason: 'No RESEND_API_KEY' })
  }

  const todayName = getDayName()
  const results = { sent: 0, skipped: 0, errors: 0 }

  // Get all workspaces that have a campaign with aiOutput
  const workspaces = await prisma.workspace.findMany({
    select: {
      id: true,
      ownerId: true,
      owner: { select: { email: true, name: true, subscriptionStatus: true } },
    },
  })

  for (const ws of workspaces) {
    try {
      // Find most recent campaign with AI output
      const campaign = await (prisma.campaign as any).findFirst({
        where: {
          workspaceId: ws.id,
          aiOutput: { not: null },
          status: { in: ['ACTIVE', 'DRAFT'] },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          platforms: true,
          aiOutput: true,
          createdAt: true,
        },
      })

      if (!campaign?.aiOutput) { results.skipped++; continue }

      const aiOutput = campaign.aiOutput as any
      const contentCalendar: any[] = aiOutput?.strategy?.contentCalendar || []
      if (!contentCalendar.length) { results.skipped++; continue }

      const daysSince = Math.floor(
        (Date.now() - new Date(campaign.createdAt).getTime()) / 86_400_000
      )
      const allPosts = flattenCalendar(contentCalendar)
      if (!allPosts.length) { results.skipped++; continue }

      // Find today's post by day name, fallback to index
      let post = allPosts.find(p => p.day === todayName)
      if (!post) post = allPosts[daysSince % allPosts.length]
      if (!post) { results.skipped++; continue }

      await sendDailyDigest(ws.owner.email, {
        name: ws.owner.name || ws.owner.email.split('@')[0],
        campaignName: campaign.name,
        day: post.day || todayName,
        platform: post.platform || (campaign.platforms[0] || 'INSTAGRAM'),
        type: post.type || 'Content Post',
        topic: post.topic || '',
        caption: post.caption || '',
        campaignId: campaign.id,
        postIndex: allPosts.indexOf(post) + 1,
        totalPosts: allPosts.length,
      })

      results.sent++
    } catch (err: any) {
      results.errors++
      console.error(`[daily-digest] error for workspace ${ws.id}:`, err?.message)
    }
  }

  return NextResponse.json({
    ok: true,
    workspacesChecked: workspaces.length,
    ...results,
    ts: new Date().toISOString(),
  })
}
