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

export const dynamic = 'force-dynamic'

// Cron auth
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // dev — no secret configured
  const authHeader = req.headers.get('authorization')
  return authHeader === `Bearer ${secret}`
}

// Generate content ideas using OpenAI — fast, cheap, high-value
async function generateWeeklyIdeas(brandName: string, industry: string, topPlatform: string): Promise<string[]> {
  if (!process.env.OPENAI_API_KEY) {
    return [
      `Share a behind-the-scenes look at how ${brandName} creates its products`,
      `Post a client success story or testimonial this week`,
      `Create a "how we do it differently" comparison post`,
    ]
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `Generate exactly 3 specific content ideas for a ${industry} brand called "${brandName}" to post on ${topPlatform} this week.

Each idea should be concrete, actionable, and designed to drive engagement.
Format: Return a JSON array of 3 strings. Each string is one content idea, max 15 words.
Example: ["Post a before/after transformation showing your process", "Share a customer quote that explains why they chose you", "Create a quick tips reel about common mistakes in your industry"]`,
        }],
        temperature: 0.8,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      }),
    })
    const data = await res.json()
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}')
    const ideas = parsed.ideas || parsed.content || parsed.suggestions || Object.values(parsed)[0]
    if (Array.isArray(ideas) && ideas.length >= 3) return ideas.slice(0, 3)
  } catch (e) {
    console.error('[Weekly Brief] OpenAI error:', e)
  }

  return [
    `Share a behind-the-scenes look at how ${brandName} operates`,
    `Post a client success story or testimonial`,
    `Create educational content about your industry this week`,
  ]
}

// Generate strategy focus
async function generateStrategyFocus(brandName: string, campaignsCount: number): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return `Focus this week on deepening audience trust for ${brandName}. Consistency in posting — even 2-3 times — builds more loyalty than any single viral post.`
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `Write a 1-sentence strategic marketing focus for a brand called "${brandName}" that has run ${campaignsCount} campaigns.
Make it specific and actionable — what should their marketing focus on THIS week?
Return plain text only, no quotes, max 25 words.`,
        }],
        temperature: 0.7,
        max_tokens: 60,
      }),
    })
    const data = await res.json()
    return data.choices?.[0]?.message?.content?.trim() || `Keep building momentum for ${brandName} with consistent, valuable content this week.`
  } catch {
    return `Keep building momentum for ${brandName} with consistent, valuable content this week.`
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
          where: { project: { workspace: { ownerId: user.id } } },
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
