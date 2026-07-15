/**
 * GET  /api/campaigns/[id]/creative-brief — fetch existing brief from aiOutput
 * POST /api/campaigns/[id]/creative-brief — generate new brief (asset or concept mode)
 *
 * Sprint F — Creative Direction
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import {
  analyzeAssets,
  generateVisualConcepts,
  CampaignContext,
  AssetItem,
} from '@/lib/agents/visual-director'
import {
  checkAndDeductCredits,
  getCreditActionPolicy,
  refundCreditDeduction,
  type CreditDeductionOk,
} from '@/lib/credits'
import { getAiProviderUnavailablePayload, isAiProviderConfigured } from '@/lib/ai/provider'
import { canMutateCampaignExecution } from '@/lib/strategyApproval'
import {
  isPersistedMarketingQualityGatePassed,
  reviewStrategyGrounding,
} from '@/lib/ai/marketingQualityGate'

type Params = { params: Promise<{ id: string }> }

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, props: Params) {
  const params = await props.params;
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: userId } },
    })
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const aiOutput = (campaign.aiOutput as any) || {}
    return NextResponse.json({
      creativeBrief: aiOutput.creativeBrief ?? null,
      creativeMode: aiOutput.creativeMode ?? null,
    })
  } catch (err) {
    console.error('[creative-brief GET]', err)
    return NextResponse.json({ error: 'Failed to load creative brief' }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, props: Params) {
  const params = await props.params;
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let chargedCredit: CreditDeductionOk | null = null
  try {
    const body = await req.json()
    const mode: 'asset' | 'concept' = body.mode === 'asset' ? 'asset' : 'concept'
    const mediaIds: string[] = Array.isArray(body.mediaIds) ? body.mediaIds : []

    // Fetch campaign with workspace and brand (no media include — see note below)
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
    if (!canMutateCampaignExecution(String(campaign.status), campaign.aiOutput)) {
      return NextResponse.json({
        error: 'STRATEGY_APPROVAL_REQUIRED',
        code: 'STRATEGY_APPROVAL_REQUIRED',
        message: 'Approve the reviewed strategy before spending credits on creative planning.',
        creditsUsed: 0,
      }, { status: 409 })
    }
    if (
      aiOutput.sentinelReview?.status !== 'passed'
      || !isPersistedMarketingQualityGatePassed(aiOutput.qualityGate)
    ) {
      return NextResponse.json({
        error: 'COMPLETE_STRATEGY_REVIEW_REQUIRED',
        code: 'COMPLETE_STRATEGY_REVIEW_REQUIRED',
        message: 'Complete the deterministic Brand Brain gate and Sentinel review before creative planning.',
        creditsUsed: 0,
      }, { status: 409 })
    }
    const currentQualityGate = reviewStrategyGrounding({
      strategy,
      brand,
      allowedPlatforms: Array.isArray(campaign.platforms) ? campaign.platforms.map(String) : [],
      goal: campaign.goal,
    })
    if (currentQualityGate.status !== 'passed') {
      return NextResponse.json({
        error: 'MARKETING_QUALITY_GATE_BLOCKED',
        code: 'MARKETING_QUALITY_GATE_BLOCKED',
        message: 'The approved strategy no longer matches the current Brand Brain or campaign scope.',
        qualityGate: currentQualityGate,
        creditsUsed: 0,
      }, { status: 422 })
    }

    // Build campaign context from all available data
    const ctx: CampaignContext = {
      campaignName: campaign.name,
      campaignGoal: campaign.goal ?? undefined,
      audience: campaign.audience ?? undefined,
      tone: campaign.tone ?? undefined,
      language: (body.language as string | undefined)
        || (aiOutput.language as string | undefined)
        || 'ar',
      brand: brand ? {
        name: brand.brandName ?? undefined,
        businessType: brand.industry ?? undefined,
        visualStyle: brand.visualStyle ?? undefined,
        // colorPalette is String[] in schema — join to string
        colorPalette: Array.isArray(brand.colorPalette)
          ? brand.colorPalette.join(', ')
          : (brand.colorPalette ?? undefined),
        uniqueValue: Array.isArray(brand.uniqueAdvantages)
          ? brand.uniqueAdvantages.slice(0, 3).join('; ')
          : undefined,
        writingStyle: brand.writingStyle ?? undefined,
        painPoints: Array.isArray(brand.audiencePainPoints)
          ? brand.audiencePainPoints.slice(0, 3).join('; ')
          : undefined,
        desires: Array.isArray(brand.audienceDesires)
          ? brand.audienceDesires.slice(0, 3).join('; ')
          : undefined,
      } : undefined,
      strategy: {
        positioning: strategy.positioning ?? undefined,
        keyMessage: strategy.keyMessage ?? undefined,
        contentPillars: Array.isArray(strategy.contentPillars)
          ? strategy.contentPillars
          : undefined,
        visualDirection: strategy.visualDirection ?? undefined,
        differentiation: strategy.differentiation ?? undefined,
        diagnosis: strategy.diagnosis ?? undefined,
      },
    }

    let selectedMedia: any[] = []
    if (mode === 'asset') {
      // NOTE: Media uploaded via the Media Library has campaignId = null — it's workspace-level.
      // campaign.media (campaign-linked) is always empty for workspace uploads.
      // Fix: query workspace media directly, optionally filtered by the selected mediaIds.
      const mediaFilter: any = { workspaceId: campaign.workspaceId }
      if (mediaIds.length > 0) mediaFilter.id = { in: mediaIds }
      selectedMedia = await prisma.media.findMany({ where: mediaFilter, take: 20 })

      if (selectedMedia.length === 0) {
        return NextResponse.json(
          { error: 'No media found. Upload assets to your workspace first, then select them for analysis.' },
          { status: 400 }
        )
      }
      if (!selectedMedia.some((item) => item.type === 'IMAGE' || item.type === 'LOGO')) {
        return NextResponse.json({
          error: 'Asset analysis currently supports images and logos. Select at least one image or logo; no credits were used.',
          code: 'NO_ANALYZABLE_VISUAL_ASSETS',
        }, { status: 422 })
      }
    }

    if (!isAiProviderConfigured()) {
      return NextResponse.json(getAiProviderUnavailablePayload(ctx.language), { status: 503 })
    }

    const credit = await checkAndDeductCredits(userId, 'CREATIVE_BRIEF')
    if (!credit.ok) return NextResponse.json(credit, { status: 402 })
    chargedCredit = credit

    let creativeBrief

    if (mode === 'asset') {

      const assets: AssetItem[] = selectedMedia.map(m => ({
        mediaId: m.id,
        fileName: m.fileName,
        url: m.url,
        type: m.type,
      }))

      creativeBrief = await analyzeAssets(assets, ctx)
    } else {
      creativeBrief = await generateVisualConcepts(ctx)
    }

    // Persist to campaign.aiOutput.creativeBrief
    const updatedOutput = {
      ...aiOutput,
      creativeBrief,
      creativeMode: mode,
    }

    await prisma.campaign.update({
      where: { id: params.id },
      data: { aiOutput: updatedOutput },
    })

    // Log activity (non-blocking)
    const analysisCount = (creativeBrief.assetAnalyses || []).length
    prisma.campaignActivity.create({
      data: {
        campaignId: params.id,
        type: 'updated',
        description: mode === 'asset'
          ? `Creative brief generated — ${analysisCount} asset${analysisCount !== 1 ? 's' : ''} analyzed`
          : 'AI visual concept package generated',
      },
    }).catch(() => {})

    return NextResponse.json({
      creativeBrief,
      creativeMode: mode,
      creditsRemaining: chargedCredit.creditsRemaining,
      creditsUsed: chargedCredit.creditsUsed,
      creditCharge: {
        ...getCreditActionPolicy('CREATIVE_BRIEF'),
        creditsUsed: chargedCredit.creditsUsed,
      },
    })
  } catch (err: any) {
    console.error('[creative-brief POST]', err)
    await refundCreditDeduction({
      userId,
      action: 'CREATIVE_BRIEF',
      deduction: chargedCredit,
      reason: 'Creative brief generation failed',
    })
    return NextResponse.json({ error: err.message || 'Generation failed', refunded: Boolean(chargedCredit?.creditsUsed) }, { status: 500 })
  }
}
