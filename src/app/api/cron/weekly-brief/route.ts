/**
 * GET /api/cron/weekly-brief
 * Runs every Monday at 7:00 AM UTC
 * Sends personalized Weekly Intelligence Brief to all active users
 *
 * vercel.json: { "path": "/api/cron/weekly-brief", "schedule": "0 7 * * 1" }
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWeeklyBrief } from '@/lib/email/resend'
import { cronAuthError } from '@/lib/cronAuth'

export const dynamic = 'force-dynamic'

// Deterministic weekly prompts avoid uncovered per-user background model spend.
// They are planning hypotheses, never claims about trends or performance.
async function generateWeeklyIdeas(brandName: string, industry: string, topPlatform: string): Promise<string[]> {
  return [
    `Answer one recurring ${industry} customer question on ${topPlatform}`,
    `Show one behind-the-scenes step in how ${brandName} works`,
    `Test a customer story with a clear source and approval`,
  ]
}

// Planning focus based only on known campaign count; no prediction or benchmark.
async function generateStrategyFocus(brandName: string, campaignsCount: number): Promise<string> {
  return campaignsCount > 1
    ? `Choose one message for ${brandName}, test it consistently this week, and review platform evidence before changing direction.`
    : `Use the first campaign as a measured baseline for ${brandName}; publish only approved content and document what the platform reports.`
}

export async function GET(req: NextRequest) {
  const authError = cronAuthError(req)
  if (authError) return authError

  if (!process.env.RESEND_API_KEY) {
    console.log('[Weekly Brief] RESEND_API_KEY not set — skipping')
    return NextResponse.json({ skipped: true, reason: 'No email provider configured' })
  }

  console.log('[Weekly Brief] Starting job...')
  const now = new Date()

  // Get all users who have at least 1 campaign (= active users worth emailing)
  const users = await prisma.user.findMany({
    where: {
      email: { not: undefined },
    },
    select: {
      id: true,
      email: true,
      name: true,
      subscriptionStatus: true,
    },
  })

  console.log(`[Weekly Brief] Found ${users.length} users`)

  let sent = 0
  let skipped = 0
  let errors = 0

  for (const user of users) {
    if (!user.email) { skipped++; continue }

    try {
      // Get user's campaign data for context
      const [campaigns, brandProfile] = await Promise.all([
        prisma.campaign.findMany({
          where: { workspace: { ownerId: user.id } },
          select: { platforms: true, goal: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        prisma.brandProfile.findFirst({
          where: { workspace: { ownerId: user.id } },
          select: { brandName: true, industry: true, targetAudience: true },
        }),
      ])

      // Only email users with at least 1 campaign (engaged users)
      if (campaigns.length === 0) { skipped++; continue }

      // Calculate top platform
      const platformCounts: Record<string, number> = {}
      campaigns.forEach(c => {
        c.platforms.forEach((p: string) => {
          platformCounts[p] = (platformCounts[p] || 0) + 1
        })
      })
      const topPlatform = Object.entries(platformCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Instagram'

      // Campaigns this month
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const campaignsThisMonth = campaigns.filter(c => new Date(c.createdAt) >= monthStart).length

      const brandName = brandProfile?.brandName || user.name || user.email.split('@')[0]
      const industry = brandProfile?.industry || 'your industry'

      // Generate AI content for this user
      const [contentIdeas, strategyFocus] = await Promise.all([
        generateWeeklyIdeas(brandName, industry, topPlatform.replace('_', ' ')),
        generateStrategyFocus(brandName, campaigns.length),
      ])

      await sendWeeklyBrief(user.email, {
        name: user.name || user.email.split('@')[0],
        brandName,
        campaignsThisMonth,
        topPlatform: topPlatform.replace('_', ' '),
        contentIdeas,
        strategyFocus,
      })

      sent++
      console.log(`[Weekly Brief] Sent to ${user.email}`)

      // Rate limit: 2 emails/sec to respect Resend limits
      await new Promise(r => setTimeout(r, 500))

    } catch (err: any) {
      console.error(`[Weekly Brief] Failed for ${user.email}:`, err.message)
      errors++
    }
  }

  console.log(`[Weekly Brief] Done. Sent: ${sent}, Skipped: ${skipped}, Errors: ${errors}`)
  return NextResponse.json({ sent, skipped, errors, total: users.length })
}
