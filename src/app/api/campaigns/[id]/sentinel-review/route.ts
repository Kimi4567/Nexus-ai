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
import {
  checkAndDeductCredits,
  getCreditActionPolicy,
  refundCreditDeduction,
  type CreditDeductionOk,
} from '@/lib/credits'
import { guardStrategyKpis } from '@/lib/ai/strategyKpiGuard'
import { guardStrategyProof } from '@/lib/ai/strategyProofGuard'
import { guardStrategyOutputContract } from '@/lib/ai/strategyOutputContractGuard'
import { resolveStrategyScope } from '@/lib/strategy/strategyScope'
import { getAiProviderUnavailablePayload, isAiProviderConfigured } from '@/lib/ai/provider'
import { reviewStrategyGrounding } from '@/lib/ai/marketingQualityGate'

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
      sentinelReview: aiOutput.sentinelReview ?? null,
    })
  } catch (err) {
    console.error('[sentinel-review GET]', err)
    return NextResponse.json({ error: 'Failed to load review' }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, props: Params) {
  const params = await props.params;
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let chargedCredit: CreditDeductionOk | null = null
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
    const rawStrategy = aiOutput.strategy || {}
    const strategyScope = resolveStrategyScope(aiOutput)
    const proofContext = {
      verifiedProof: Array.isArray(brand?.verifiedProof) ? brand.verifiedProof : [],
      allowedClaimText: [
        brand?.description,
        brand?.primaryOffer,
        brand?.pricePoint,
        ...(Array.isArray(brand?.uniqueAdvantages) ? brand.uniqueAdvantages : []),
        brand?.complianceNotes,
        ...(Array.isArray(brand?.verifiedProof) ? brand.verifiedProof : []),
      ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
    }
    const strategy = guardStrategyKpis(
      guardStrategyOutputContract(
        guardStrategyProof(rawStrategy, proofContext) as Record<string, unknown>,
        {
          allowedPlatforms: Array.isArray(campaign.platforms) ? campaign.platforms : [],
          language: language || (aiOutput.language as string | undefined) || 'ar',
          strategyType: strategyScope.type,
          hasConversionDestination: Boolean(brand?.conversionDestination),
        },
      ) as Record<string, unknown>,
      [],
      { language: language || (aiOutput.language as string | undefined) || 'ar' },
    ) as any
    const content = {
      topHooks: strategy.topHooks || guardStrategyProof(aiOutput.topHooks || [], proofContext),
      ctaVariations: strategy.ctaVariations || guardStrategyProof(aiOutput.ctaVariations || [], proofContext),
      captionFormulas: guardStrategyProof(aiOutput.captionFormulas || [], proofContext),
      scriptTemplate: guardStrategyProof(aiOutput.scriptTemplate || '', proofContext),
      contentAngles: strategy.contentAngles || [],
      adCopyVariants: aiOutput.creativeBrief?.adCopyVariants || [],
    }
    const calendar = aiOutput.contentCalendar || strategy.contentCalendar || []
    const creativeBrief = aiOutput.creativeBrief || null
    const qualityGate = reviewStrategyGrounding({
      strategy,
      brand,
      allowedPlatforms: Array.isArray(campaign.platforms) ? campaign.platforms : [],
      goal: campaign.goal,
    })

    // Sentinel is a paid, model-based reviewer. The deterministic gate is free
    // and authoritative, so fail before charging when the saved strategy already
    // contradicts Brand Brain or the reviewed channel scope.
    if (qualityGate.status === 'blocked') {
      return NextResponse.json({
        error: 'Strategy failed the deterministic brand and scope review. Regenerate the strategy before running Sentinel.',
        code: 'MARKETING_QUALITY_GATE_BLOCKED',
        qualityGate,
        creditsUsed: 0,
      }, { status: 422 })
    }

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
        // Sprint M operational fields
        doNotDoYet: Array.isArray(strategy.doNotDoYet) ? strategy.doNotDoYet : [],
        readinessChecklist: Array.isArray(strategy.readinessChecklist) ? strategy.readinessChecklist : [],
        adSetupPlan: strategy.adSetupPlan ?? undefined,
        funnelStages: Array.isArray(strategy.funnelStages) ? strategy.funnelStages : [],
        contentAnglesDetailed: Array.isArray(strategy.contentAnglesDetailed) ? strategy.contentAnglesDetailed.slice(0, 5) : [],
        weeklyExecutionPlan: Array.isArray(strategy.weeklyExecutionPlan) ? strategy.weeklyExecutionPlan.slice(0, 6) : [],
        executionAssumptions: Array.isArray(strategy.executionAssumptions) ? strategy.executionAssumptions : [],
        assumptions: Array.isArray(strategy.assumptions) ? strategy.assumptions : [],
      },
      content,
      calendar: Array.isArray(calendar) ? calendar.slice(0, 20) : [],
      creativeBriefDirection:
        creativeBrief?.overallCreativeDirection ||
        creativeBrief?.moodDescription ||
        undefined,
      strategyReviewSource: strategy,
    }

    if (!isAiProviderConfigured()) {
      return NextResponse.json(getAiProviderUnavailablePayload(language), { status: 503 })
    }

    const credit = await checkAndDeductCredits(userId, 'SENTINEL_REVIEW')
    if (!credit.ok) return NextResponse.json(credit, { status: 402 })
    chargedCredit = credit

    const sentinelReview = await runSentinelReview(input)

    // Save to aiOutput.sentinelReview
    const updatedOutput = {
      ...aiOutput,
      // Persist exactly the guarded package that Sentinel reviewed. Legacy
      // strategies may predate current truth guards; approval must never expose
      // a riskier raw version than the reviewed version.
      strategy,
      topHooks: content.topHooks,
      ctaVariations: content.ctaVariations,
      captionFormulas: content.captionFormulas,
      scriptTemplate: content.scriptTemplate,
      sentinelReview,
      qualityGate,
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

    return NextResponse.json({
      sentinelReview,
      qualityGate,
      creditsRemaining: chargedCredit.creditsRemaining,
      creditsUsed: chargedCredit.creditsUsed,
      creditCharge: {
        ...getCreditActionPolicy('SENTINEL_REVIEW'),
        creditsUsed: chargedCredit.creditsUsed,
      },
    })
  } catch (err: any) {
    console.error('[sentinel-review POST]', err)
    await refundCreditDeduction({
      userId,
      action: 'SENTINEL_REVIEW',
      deduction: chargedCredit,
      reason: 'Sentinel quality review failed',
    })
    return NextResponse.json({ error: err.message || 'Review failed', refunded: Boolean(chargedCredit?.creditsUsed) }, { status: 500 })
  }
}
