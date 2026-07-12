/**
 * GET /api/cron/daily-digest
 * Sends reminders only for real SocialPost rows that the user approved and
 * scheduled for the current UTC day. Generated strategy calendars and drafts
 * never enter this email path.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendDailyDigest } from '@/lib/email/resend'
import { cronAuthError } from '@/lib/cronAuth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authError = cronAuthError(req)
  if (authError) return authError

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ skipped: true, reason: 'No RESEND_API_KEY' })
  }

  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  const results = { checked: 0, sent: 0, skipped: 0, errors: 0 }

  try {
    const posts = await (prisma.socialPost as any).findMany({
      where: {
        status: 'SCHEDULED',
        approvedAt: { not: null },
        scheduledAt: { gte: start, lt: end },
      },
      select: {
        id: true,
        workspaceId: true,
        campaignId: true,
        caption: true,
        platform: true,
        pageName: true,
        scheduledAt: true,
        workspace: { select: { owner: { select: { email: true, name: true } } } },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 200,
    }) as Array<any>
    results.checked = posts.length

    const campaignIds = [...new Set(posts.map((post) => post.campaignId).filter(Boolean))] as string[]
    const campaigns = campaignIds.length > 0
      ? await prisma.campaign.findMany({
          where: { id: { in: campaignIds } },
          select: { id: true, name: true },
        })
      : []
    const campaignNames = new Map(campaigns.map((campaign) => [campaign.id, campaign.name]))

    // One concise reminder per workspace per day. Additional scheduled posts
    // remain visible in the dashboard instead of generating email bursts.
    const sentWorkspaces = new Set<string>()
    for (const post of posts) {
      const owner = post.workspace?.owner
      if (!owner?.email || sentWorkspaces.has(post.workspaceId)) {
        results.skipped++
        continue
      }
      try {
        const workspacePosts = posts.filter((item) => item.workspaceId === post.workspaceId)
        await sendDailyDigest(owner.email, {
          name: owner.name || owner.email.split('@')[0],
          campaignName: campaignNames.get(post.campaignId) || 'Approved campaign',
          day: post.scheduledAt
            ? new Date(post.scheduledAt).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
            : 'Today',
          platform: String(post.platform),
          type: 'Approved scheduled post',
          topic: post.pageName || campaignNames.get(post.campaignId) || '',
          caption: post.caption,
          campaignId: post.campaignId || '',
          postIndex: 1,
          totalPosts: workspacePosts.length,
        })
        sentWorkspaces.add(post.workspaceId)
        results.sent++
      } catch (error) {
        results.errors++
        console.error(`[daily-digest] workspace ${post.workspaceId}:`, error)
      }
    }

    return NextResponse.json({
      ok: results.errors === 0,
      source: 'approved-scheduled-posts',
      draftsIncluded: false,
      ...results,
      ts: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[daily-digest] fatal:', error)
    return NextResponse.json({ error: 'Daily digest failed' }, { status: 500 })
  }
}
