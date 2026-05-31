/**
 * GET  /api/campaigns/[id]/sentinel-review — fetch existing review from aiOutput
 * POST /api/campaigns/[id]/sentinel-review — run a new Sentinel review
 *
 * Sprint G — Sentinel Review Gate
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { runSentinelReview, SentinelReviewInput } from '@/lib/agents/sentinel-reviewer'

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
    return NextResponse.json({
      sentinelReview: aiOutput.sentinelReview ?? null,
    })
  } catch (err) {
    console.error('[sentinel-review GET]', err)
    return NextResponse.json({ error: 'Failed to load review' }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Params) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json().catch(() => ({}))
    const language: string = body.language || 'ar'

    // Fetch campaign with workspace + brand
    const campaign = await (prisma as any).campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: userId } },
      include: {
        workspace: {
          include: { brandProfile: true },
        },
      },
    })
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const brand = campaign.workspace?.brandProfile
    const aiOutput = (campaign.aiOutput as any) || {}
    const strategy = aiOutput.strategy || {}
    const content = {
      topHooks: aiOutput.topHooks || strategy.topHooks || [],
      ctaVariations: aiOutput.ctaVariations || strategy.ctaVariations || [],
      captionFormulas: aiOutput.captionFormulas || [],
      scriptTemplate: aiOutput.scriptTemplate || '',
      contentAngles: strategy.contentAngles || [],
      adCopyVariants: aiOutput.creativeBrief?.adCopyVariants || [],
    }
    const calendar = aiOutput.contentCalendar || strategy.contentCalendar || []
    const creativeBrief = aiOutput.creativeBrief || null

    // Build Sentinel input
    const input: SentinelReviewInput = {
      campaignName: campaign.name,
      campaignGoal: campaign.goal ?? undefined,
      audience: campaign.audience ?? undefined,
      tone: campaign.tone ?? undefined,
      language: language || (aiOutput.language as string | undefined) || 'ar',
      brand: brand ? {
        name: brand.brandName ?? undefined,
        businessType: brand.industry ?? undefined,
        toneKeywords: Array.isArray(brand.toneKeywords) ? brand.toneKeywords : [],
        avoidKeywords: Array.isArray(brand.avoidKeywords) ? brand.avoidKeywords : [],
        writingStyle: brand.writingStyle ?? undefined,
        targetAudience: brand.targetAudience ?? undefined,
        pricePoint: brand.pricePoint ?? undefined,
      } : undefined,
      strategy: {
        positioning: strategy.positioning ?? undefined,
        keyMessage: strategy.keyMessage ?? undefined,
        differentiation: strategy.differentiation ?? undefined,
        riskNotes: Array.isArray(strategy.riskNotes) ? strategy.riskNotes : [],
        diagnosis: strategy.diagnosis ?? undefined,
        offerCTAStrategy: strategy.offerCTAStrategy ?? undefined,
      },
      content,
      calendar: Array.isArray(calendar) ? calendar.slice(0, 20) : [],
      creativeBriefDirection:
        creativeBrief?.overallCreativeDirection ||
        creativeBrief?.moodDescription ||
        undefined,
    }

    const sentinelReview = await runSentinelReview(input)

    // Save to aiOutput.sentinelReview
    const updatedOutput = {
      ...aiOutput,
      sentinelReview,
    }

    await prisma.campaign.update({
      where: { id: params.id },
      data: { aiOutput: updatedOutput },
    })

    // Log activity (non-blocking)
    prisma.campaignActivity.create({
      data: {
        campaignId: params.id,
        type: 'updated',
        description: sentinelReview.status === 'passed'
          ? `Sentinel review passed — Risk: ${sentinelReview.riskScore}/100, Brand: ${sentinelReview.brandConsistencyScore}/100`
          : `Sentinel review flagged issues — Risk: ${sentinelReview.riskScore}/100 (${sentinelReview.recommendedFixes.length} fix${sentinelReview.recommendedFixes.length !== 1 ? 'es' : ''} recommended)`,
      },
    }).catch(() => {})

    return NextResponse.json({ sentinelReview })
  } catch (err: any) {
    console.error('[sentinel-review POST]', err)
    return NextResponse.json({ error: err.message || 'Review failed' }, { status: 500 })
  }
}
