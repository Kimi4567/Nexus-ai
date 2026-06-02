import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { prisma } from '@/lib/prisma'
import { checkAndDeductCredits } from '@/lib/credits'
import { aiRateLimitDb } from '@/lib/dbRateLimit'

/* ═══════════════════════════════════════════════════════════════════════════
   POST /api/autopilot/activate

   Reads the campaign's weeklyExecutionPlan + contentAnglesDetailed from
   aiOutput.strategy, then:
   1. Generates a real caption for each week × platform via GPT-4o-mini
   2. Creates SocialPost records (status=SCHEDULED) for each post
   3. Sets Campaign.autopilotEnabled = true

   Scheduling logic:
     Week 1 → +3 days from now
     Week 2 → +10 days from now
     Week 3 → +17 days from now
     Week 4 → +24 days from now
     Time   → 10:00 UTC (adjustable by user in future)
   ═══════════════════════════════════════════════════════════════════════════ */

// Map platform strings from strategy to Integration type enum
const PLATFORM_MAP: Record<string, 'META' | 'LINKEDIN' | 'TIKTOK'> = {
  instagram: 'META',
  facebook: 'META',
  meta: 'META',
  linkedin: 'LINKEDIN',
  tiktok: 'TIKTOK',
}

// Days offset per week
const WEEK_OFFSETS: Record<number, number> = { 1: 3, 2: 10, 3: 17, 4: 24 }

function scheduledDate(weekNumber: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + (WEEK_OFFSETS[weekNumber] ?? weekNumber * 7))
  d.setUTCHours(10, 0, 0, 0)
  return d
}

async function generateCaption(
  keyMessage: string,
  cta: string,
  platform: string,
  objective: string,
  hook: string,
  language: string
): Promise<string> {
  const langInstruction = language === 'ar'
    ? 'Write the caption in Arabic.'
    : 'Write the caption in English.'

  const systemPrompt = `You are a professional social media copywriter. ${langInstruction}
Write a compelling social media post caption. Be concise, engaging, and platform-appropriate.
Platform: ${platform}. Keep under 300 characters for TikTok/Instagram, 500 for Facebook/LinkedIn.`

  const userPrompt = `Campaign objective: ${objective}
Key message: ${keyMessage}
Hook to use: ${hook}
CTA: ${cta}

Write a ready-to-publish caption. Output ONLY the caption text, no labels or explanation.`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 200,
        temperature: 0.75,
      }),
    })
    const data = await res.json()
    return data.choices?.[0]?.message?.content?.trim() || `${keyMessage}\n\n${cta}`
  } catch {
    return `${keyMessage}\n\n${cta}`
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user } } = await adminClient.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { campaignId } = await req.json()
    if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 })

    // Fetch workspace
    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
      include: { integrations: { where: { status: 'CONNECTED' } } },
    })
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    // Fetch campaign with aiOutput
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, workspaceId: workspace.id },
    })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    if (!campaign.aiOutput) return NextResponse.json({ error: 'Campaign has no AI strategy yet' }, { status: 400 })

    const aiOutput = campaign.aiOutput as Record<string, any>
    const strategy = aiOutput.strategy as Record<string, any>

    if (!strategy) return NextResponse.json({ error: 'Strategy not found in campaign output' }, { status: 400 })

    const weeklyPlan: any[] = strategy.weeklyExecutionPlan || strategy.weeklyPlan || []
    const contentAngles: any[] = strategy.contentAnglesDetailed || strategy.contentAngles || []
    const brandProfile = await prisma.brandProfile.findFirst({ where: { workspaceId: workspace.id } })
    const language = (aiOutput.language as string) || 'ar'

    if (weeklyPlan.length === 0) {
      return NextResponse.json({ error: 'No weekly execution plan in strategy' }, { status: 400 })
    }

    // BUG-05 fix: rate limit + credit gate before generating AI captions
    const rl = await aiRateLimitDb(user.id)
    if (!rl.ok) return NextResponse.json({ error: rl.message }, { status: 429 })

    const credit = await checkAndDeductCredits(user.id, 'RUN_FULL_STRATEGY')
    if (!credit.ok) return NextResponse.json(credit, { status: 402 })

    const connectedIntegrations = workspace.integrations
    if (connectedIntegrations.length === 0) {
      return NextResponse.json({ error: 'No connected social platforms. Connect at least one in Connections.' }, { status: 400 })
    }

    // Cancel any existing autopilot posts for this campaign (allow re-activation)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma.socialPost as any).deleteMany({
      where: { campaignId, autoGenerated: true, status: 'SCHEDULED' },
    })

    const createdPosts = []

    for (const weekItem of weeklyPlan) {
      const weekNumber: number = weekItem.week || 1
      const objective: string = weekItem.objective || ''
      const keyMessage: string = weekItem.keyMessage || ''
      const cta: string = weekItem.cta || ''
      const platforms: string[] = weekItem.platforms || []
      const assetsNeeded: string[] = weekItem.assetsNeeded || []

      // Pick best content angle for this week
      const angle = contentAngles.find(a =>
        (a.funnelStage || '').toLowerCase().includes(weekNumber <= 2 ? 'awareness' : 'conversion')
      ) || contentAngles[weekNumber - 1] || contentAngles[0]

      const hook = angle?.hook || keyMessage

      // For each platform, find a matching integration
      const platformsToSchedule = platforms.length > 0
        ? platforms
        : connectedIntegrations.map(i => i.type.toLowerCase())

      const scheduledPlatforms = new Set<string>() // avoid duplicate per-week posts on same integration

      for (const platformStr of platformsToSchedule) {
        const normalized = platformStr.toLowerCase()
        const integrationType = PLATFORM_MAP[normalized] || 'META'

        if (scheduledPlatforms.has(integrationType)) continue

        const integration = connectedIntegrations.find(i => i.type === integrationType)
        if (!integration) continue

        scheduledPlatforms.add(integrationType)

        // Get page info from integration config
        const pages: any[] = (integration.config as any)?.pages || []
        const page = pages[0]
        const pageId = page?.id || integration.accountId || ''
        const pageName = page?.name || integration.accountName || integrationType

        // Generate caption via AI
        const caption = await generateCaption(keyMessage, cta, platformStr, objective, hook, language)

        // Build image prompt from assets needed or brand-aware default
        const assetHint = assetsNeeded[0] || angle?.asset || ''
        const imagePrompt = assetHint
          ? `${assetHint}. Brand: ${brandProfile?.brandName || campaign.name}. Style: ${brandProfile?.visualStyle || 'modern, clean, professional'}. Marketing campaign visual.`
          : `Marketing visual for ${brandProfile?.brandName || campaign.name}. ${keyMessage}. Style: ${brandProfile?.visualStyle || 'modern, clean, professional'}. High quality, engaging social media image.`

        const scheduledAt = scheduledDate(weekNumber)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const post = await (prisma.socialPost as any).create({
          data: {
            workspaceId: workspace.id,
            campaignId,
            integrationId: integration.id,
            platform: integrationType,
            pageId,
            pageName,
            caption,
            imagePrompt,
            autoGenerated: true,
            weekNumber,
            status: 'SCHEDULED',
            scheduledAt,
          },
        })

        createdPosts.push(post)
      }
    }

    // Mark campaign as autopilot enabled
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma.campaign as any).update({
      where: { id: campaignId },
      data: {
        autopilotEnabled: true,
        autopilotActivatedAt: new Date(),
        status: 'SCHEDULED',
      },
    })

    return NextResponse.json({
      ok: true,
      postsScheduled: createdPosts.length,
      posts: createdPosts,
    })
  } catch (error) {
    console.error('[Autopilot Activate] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
