import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { prisma } from '@/lib/prisma'
import { checkAndDeductCredits, refundCredits, refundCreditsForTransaction } from '@/lib/credits'
import { aiRateLimitDb } from '@/lib/dbRateLimit'
import { getStrategyApprovalContract, StrategyApprovalError } from '@/lib/strategyApprovalService'
import { readLockedPlannedPostAllowance } from '@/lib/postCommercial'

/* ═══════════════════════════════════════════════════════════════════════════
   POST /api/autopilot/activate

   Reads the campaign's weeklyExecutionPlan + contentAnglesDetailed from
   aiOutput.strategy, then:
   1. Generates a real caption for each week × platform via GPT-4o-mini
   2. Creates SocialPost records as DRAFTS for explicit content review
   3. Leaves scheduling and publishing disabled until the user approves them

   Proposed timing is stored with each draft, but it does not become an actual
   schedule until the separate approval + scheduling workflow changes status.
   ═══════════════════════════════════════════════════════════════════════════ */

// Map platform strings from strategy to Integration type enum
const PLATFORM_MAP: Record<string, 'META' | 'LINKEDIN' | 'TIKTOK'> = {
  instagram: 'META',
  facebook: 'META',
  meta: 'META',
  linkedin: 'LINKEDIN',
  tiktok: 'TIKTOK',
}

const WEEK_OFFSETS: Record<number, number> = { 1: 3, 2: 10, 3: 17, 4: 24 }

function proposedDate(weekNumber: number): Date {
  const date = new Date()
  date.setDate(date.getDate() + (WEEK_OFFSETS[weekNumber] ?? weekNumber * 7))
  date.setUTCHours(10, 0, 0, 0)
  return date
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
  let creditReservation: { userId: string; creditsUsed: number; transactionId?: string } | null = null
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user } } = await adminClient.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { campaignId, useUserAssets = false } = body
    if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 })

    // Fetch workspace
    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
      include: { integrations: { where: { status: 'CONNECTED' } } },
    })
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    // Fetch campaign with aiOutput + linked media (Sprint AF)
    const campaign = await (prisma as any).campaign.findFirst({
      where: { id: campaignId, workspaceId: workspace.id },
      include: {
        media: {
          where: { type: { in: ['IMAGE', 'LOGO'] } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    if (!campaign.aiOutput) return NextResponse.json({ error: 'Campaign has no AI strategy yet' }, { status: 400 })

    const strategyApproval = await getStrategyApprovalContract(campaignId, user.id)
    if (strategyApproval.state !== 'approved') {
      return NextResponse.json({
        error: 'Strategy approval is required before preparing Autopilot content.',
        code: 'STRATEGY_APPROVAL_REQUIRED',
        approval: strategyApproval,
      }, { status: 409 })
    }

    const aiOutput = campaign.aiOutput as Record<string, any>
    const strategy = aiOutput.strategy as Record<string, any>

    if (!strategy) return NextResponse.json({ error: 'Strategy not found in campaign output' }, { status: 400 })

    const weeklyPlan: any[] = strategy.weeklyExecutionPlan || strategy.weeklyPlan || []
    const contentAngles: any[] = strategy.contentAnglesDetailed || strategy.contentAngles || []
    const brandProfile = await prisma.brandProfile.findFirst({ where: { workspaceId: workspace.id } })
    const language = (aiOutput.language as string) || 'ar'

    // Sprint AF — user asset pool: collect real images from campaign media
    // Also pull analyzed assets from Creative Brief if available
    const userMediaItems: Array<{ id: string; url: string }> = []
    if (useUserAssets) {
      // Primary: media directly linked to campaign
      const linkedMedia: any[] = campaign.media || []
      for (const m of linkedMedia) {
        if (m.url) userMediaItems.push({ id: m.id, url: m.url })
      }
      // Secondary: analyzed assets from Creative Brief (asset mode)
      const creativeBrief = aiOutput.creativeBrief
      if (creativeBrief?.mode === 'asset' && Array.isArray(creativeBrief.assetAnalyses)) {
        for (const a of creativeBrief.assetAnalyses) {
          if (a.url && !userMediaItems.find(m => m.url === a.url)) {
            userMediaItems.push({ id: a.mediaId || '', url: a.url })
          }
        }
      }
    }

    if (weeklyPlan.length === 0) {
      return NextResponse.json({ error: 'No weekly execution plan in strategy' }, { status: 400 })
    }

    const connectedIntegrations = workspace.integrations
    if (connectedIntegrations.length === 0) {
      return NextResponse.json({ error: 'No connected social platforms. Connect at least one in Connections.' }, { status: 400 })
    }

    const existingQueueCount = await (prisma.socialPost as any).count({
      where: {
        campaignId,
        workspaceId: workspace.id,
        autoGenerated: true,
        status: { in: ['DRAFT', 'APPROVED', 'SCHEDULED'] },
      },
    })
    if (existingQueueCount > 0) {
      return NextResponse.json({
        error: 'An Autopilot content queue already exists. Review or clear it before preparing another one.',
        code: 'AUTOPILOT_QUEUE_EXISTS',
      }, { status: 409 })
    }

    const initialPostAllowance = await prisma.$transaction((tx) =>
      readLockedPlannedPostAllowance(tx, user.id),
    )
    if (initialPostAllowance.remaining === 0) {
      return NextResponse.json({
        error: 'POST_LIMIT_REACHED',
        limit: initialPostAllowance.limit,
        current: initialPostAllowance.used,
        resetsAt: initialPostAllowance.periodEnd.toISOString(),
        upgradeUrl: '/billing',
      }, { status: 403 })
    }

    // Rate-limit and charge only after every no-cost validation has passed.
    const rl = await aiRateLimitDb(user.id)
    if (!rl.ok) return NextResponse.json({ error: rl.message }, { status: 429 })

    const credit = await checkAndDeductCredits(user.id, 'RUN_FULL_STRATEGY')
    if (!credit.ok) return NextResponse.json(credit, { status: 402 })
    creditReservation = {
      userId: user.id,
      creditsUsed: credit.creditsUsed,
      transactionId: credit.transactionId,
    }

    const preparedPosts: Array<Record<string, unknown>> = []

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
        if (preparedPosts.length >= initialPostAllowance.remaining) break
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

        // Build image prompt (always kept as fallback for AI generation)
        const assetHint = assetsNeeded[0] || angle?.asset || ''
        const imagePrompt = assetHint
          ? `${assetHint}. Brand: ${brandProfile?.brandName || campaign.name}. Style: ${brandProfile?.visualStyle || 'modern, clean, professional'}. Marketing campaign visual.`
          : `Marketing visual for ${brandProfile?.brandName || campaign.name}. ${keyMessage}. Style: ${brandProfile?.visualStyle || 'modern, clean, professional'}. High quality, engaging social media image.`

        const scheduledAt = proposedDate(weekNumber)

        // Sprint AF — pick user asset if available (round-robin across weeks)
        // If no user assets OR useUserAssets=false → AI generation from imagePrompt (existing flow)
        let resolvedImageUrl: string | undefined
        let resolvedSourceType = 'AI_GENERATED'
        let resolvedSourceMediaId: string | undefined
        if (userMediaItems.length > 0) {
          const postIndex: number = preparedPosts.length
          const assetItem: { id: string; url: string } = userMediaItems[postIndex % userMediaItems.length]
          resolvedImageUrl = assetItem.url
          resolvedSourceType = 'USER_ASSET'
          resolvedSourceMediaId = assetItem.id || undefined
        }

        preparedPosts.push({
          workspaceId: workspace.id,
          campaignId,
          integrationId: integration.id,
          platform: integrationType,
          pageId,
          pageName,
          caption,
          imagePrompt,
          imageUrl: resolvedImageUrl ?? null,
          sourceType: resolvedSourceType,
          sourceMediaId: resolvedSourceMediaId ?? null,
          autoGenerated: true,
          weekNumber,
          status: 'DRAFT',
          publishMode: 'MANUAL',
          scheduledAt,
        })
      }
    }

    if (preparedPosts.length === 0) {
      if (creditReservation.creditsUsed > 0) {
        if (creditReservation.transactionId) {
          await refundCreditsForTransaction({
            userId: creditReservation.userId,
            transactionId: creditReservation.transactionId,
            reason: 'No Autopilot drafts could be prepared',
          })
        } else {
          await refundCredits(creditReservation.userId, 'RUN_FULL_STRATEGY', 'No Autopilot drafts could be prepared')
        }
      }
      creditReservation = null
      return NextResponse.json({
        error: 'No campaign platforms matched the connected social accounts.',
        code: 'NO_MATCHING_CONNECTED_PLATFORM',
      }, { status: 400 })
    }

    // Persist the whole draft queue and activity atomically so retries never
    // leave a half-created queue behind.
    const createdPosts = await prisma.$transaction(async (tx) => {
      const allowance = await readLockedPlannedPostAllowance(tx, user.id)
      if (preparedPosts.length > allowance.remaining) {
        throw new Error(`POST_LIMIT_REACHED:${allowance.limit}:${allowance.periodEnd.toISOString()}`)
      }
      const campaignLock = await tx.campaign.updateMany({
        where: { id: campaignId, workspaceId: workspace.id, status: 'ACTIVE' },
        data: { autopilotEnabled: false, autopilotActivatedAt: null },
      })
      if (campaignLock.count !== 1) throw new Error('CAMPAIGN_EXECUTION_STATE_CHANGED')
      const queueStillEmpty = await (tx.socialPost as any).count({
        where: {
          campaignId,
          workspaceId: workspace.id,
          autoGenerated: true,
          status: { in: ['DRAFT', 'APPROVED', 'SCHEDULED'] },
        },
      })
      if (queueStillEmpty > 0) throw new Error('AUTOPILOT_QUEUE_EXISTS')

      const posts: any[] = []
      for (const data of preparedPosts) {
        posts.push(await (tx.socialPost as any).create({ data }))
      }
      await tx.campaignActivity.create({
        data: {
          campaignId,
          type: 'autopilot_drafts_prepared',
          description: `${posts.length} Autopilot drafts prepared for review`,
          metadata: {
            postsPrepared: posts.length,
            requiresContentApproval: true,
            publishingEnabled: false,
            spendingEnabled: false,
          },
        },
      })
      return posts
    })
    creditReservation = null

    const userAssetPostCount = createdPosts.filter((p: any) => p.sourceType === 'USER_ASSET').length
    const aiGenPostCount = createdPosts.length - userAssetPostCount

    return NextResponse.json({
      ok: true,
      postsPrepared: createdPosts.length,
      postsScheduled: 0,
      requiresApproval: true,
      publishingEnabled: false,
      userAssetPosts: userAssetPostCount,
      aiGeneratedPosts: aiGenPostCount,
      posts: createdPosts,
    })
  } catch (error) {
    if (creditReservation?.creditsUsed) {
      if (creditReservation.transactionId) {
        await refundCreditsForTransaction({
          userId: creditReservation.userId,
          transactionId: creditReservation.transactionId,
          reason: 'Autopilot draft preparation failed',
        })
      } else {
        await refundCredits(creditReservation.userId, 'RUN_FULL_STRATEGY', 'Autopilot draft preparation failed')
      }
    }
    if (error instanceof StrategyApprovalError) {
      return NextResponse.json({ error: error.code, blockers: error.blockers }, { status: error.status })
    }
    if (error instanceof Error && error.message === 'CAMPAIGN_EXECUTION_STATE_CHANGED') {
      return NextResponse.json({
        error: 'Campaign state changed while preparing drafts. Refresh and review the campaign before retrying.',
        code: 'CAMPAIGN_EXECUTION_STATE_CHANGED',
      }, { status: 409 })
    }
    if (error instanceof Error && error.message === 'AUTOPILOT_QUEUE_EXISTS') {
      return NextResponse.json({
        error: 'An Autopilot content queue already exists. Review it before retrying.',
        code: 'AUTOPILOT_QUEUE_EXISTS',
      }, { status: 409 })
    }
    if (error instanceof Error && error.message.startsWith('POST_LIMIT_REACHED:')) {
      const [, limit, ...resetParts] = error.message.split(':')
      return NextResponse.json({
        error: 'POST_LIMIT_REACHED',
        limit: Number(limit),
        resetsAt: resetParts.join(':'),
        refunded: Boolean(creditReservation?.creditsUsed),
        upgradeUrl: '/billing',
      }, { status: 403 })
    }
    console.error('[Autopilot Activate] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
