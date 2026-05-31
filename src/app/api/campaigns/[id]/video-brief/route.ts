/**
 * GET  /api/campaigns/[id]/video-brief — fetch existing brief
 * POST /api/campaigns/[id]/video-brief — generate new brand-aware video brief
 *
 * Sprint Q — Video Intelligence
 * Always works — does not require a video provider.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { checkAndDeductCredits } from '@/lib/credits'
import { generateVideoBrief, VideoContext } from '@/lib/ai/videoGen'

type Params = { params: { id: string } }

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Params) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: userId } },
    })
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const aiOutput = (campaign.aiOutput as any) || {}
    return NextResponse.json({ videoBrief: aiOutput.videoBrief ?? null })
  } catch (err) {
    console.error('[video-brief GET]', err)
    return NextResponse.json({ error: 'Failed to load video brief' }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Params) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Credit check
  const credit = await checkAndDeductCredits(userId, 'VIDEO_BRIEF')
  if (!credit.ok) return NextResponse.json(credit, { status: 402 })

  try {
    // Fetch campaign + Brand Brain + Strategy
    const campaign = await (prisma as any).campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: userId } },
      include: {
        workspace: { include: { brandProfile: true } },
      },
    })
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const brand = campaign.workspace?.brandProfile
    const aiOutput = (campaign.aiOutput as any) || {}
    const strategy = aiOutput.strategy || {}

    // Build VideoContext from all available sources
    const ctx: VideoContext = {
      campaignName:    campaign.name,
      campaignGoal:    campaign.goal    ?? undefined,
      campaignTone:    campaign.tone    ?? undefined,
      audience:        campaign.audience ?? undefined,
      language:        aiOutput.language || 'en',
      // Brand Brain
      brandName:       brand?.brandName    || undefined,
      primaryOffer:    brand?.primaryOffer || undefined,
      industry:        brand?.industry     || undefined,
      brandToneWords:  brand?.toneKeywords || [],
      colorPalette:    Array.isArray(brand?.colorPalette)
        ? brand.colorPalette.join(', ')
        : (brand?.colorPalette || undefined),
      uniqueAdvantages: Array.isArray(brand?.uniqueAdvantages)
        ? brand.uniqueAdvantages.slice(0, 3).join(', ')
        : undefined,
      // Strategy
      positioning:     strategy.positioning     || undefined,
      visualDirection: strategy.visualDirection || undefined,
      differentiation: strategy.differentiation || undefined,
      keyMessage:      strategy.keyMessage      || undefined,
    }

    const videoBrief = await generateVideoBrief(ctx)

    // Persist to campaign.aiOutput.videoBrief
    await prisma.campaign.update({
      where: { id: params.id },
      data: { aiOutput: { ...aiOutput, videoBrief } },
    })

    // Activity log (non-blocking)
    prisma.campaignActivity.create({
      data: {
        campaignId: params.id,
        type: 'updated',
        description: `Video brief generated — ${videoBrief.scenes.length} scenes, ${videoBrief.durationSeconds}s`,
      },
    }).catch(() => {})

    return NextResponse.json({
      videoBrief,
      creditsRemaining: credit.creditsRemaining,
    })
  } catch (err: any) {
    console.error('[video-brief POST]', err)
    return NextResponse.json({ error: err.message || 'Video brief generation failed' }, { status: 500 })
  }
}
