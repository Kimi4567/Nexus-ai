/**
 * POST /api/generate/preview
 * Generates full AI campaign content. Requires authentication + credits.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { generateMarketingStrategy, generateAdConcepts } from '@/lib/ai/adapter'
import {
  buildCreditChargeReceipt,
  checkAndDeductCredits,
  creditCheckHttpStatus,
  finalizeCreditDeduction,
  refundCreditDeduction,
} from '@/lib/credits'
import { getAiProviderUnavailablePayload, isAiProviderConfigured } from '@/lib/ai/provider'
import { guardStrategyTruthContract } from '@/lib/ai/strategyTruthContractGuard'
import { assertCampaignStrategyContract } from '@/lib/campaignStrategyContract'
import { reviewBrandTruthConsistency, reviewStrategyGrounding } from '@/lib/ai/marketingQualityGate'
import { getCreditOperationKey } from '@/lib/creditOperationKey.server'
import { createOpenAIProviderUsageCollector } from '@/lib/ai/providerUsageContext'
import { summarizeOpenAITextUsage } from '@/lib/ai/providerEconomics'
import { hasUsableConversionDestination } from '@/lib/strategyBriefReadiness'
import { sourceLinkedProofStatements } from '@/lib/strategy/strategyEvidenceLedger'

// Simple in-memory rate limiter: 5 generations per user per minute
const rateMap = new Map<string, { count: number; reset: number }>()
const LIMIT = 5
const WINDOW_MS = 60_000

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(userId) ?? { count: 0, reset: now + WINDOW_MS }
  if (now > entry.reset) { entry.count = 0; entry.reset = now + WINDOW_MS }
  entry.count++
  rateMap.set(userId, entry)
  return entry.count <= LIMIT
}

export async function POST(req: NextRequest) {
  // Require auth
  const userId = await getServerUserId(req)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limit
  if (!checkRateLimit(userId)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { name, goal, audience, tone, platforms, description, language } = body
  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 })
  }

  if (!isAiProviderConfigured()) {
    return NextResponse.json(getAiProviderUnavailablePayload(language), { status: 503 })
  }

  const workspace = await prisma.workspace.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const brandProfile = await prisma.brandProfile.findUnique({ where: { workspaceId: workspace.id } })
  const brandTruth = reviewBrandTruthConsistency(brandProfile)
  if (brandTruth.status !== 'passed') {
    return NextResponse.json({
      error: 'BRAND_TRUTH_CONFLICT',
      code: 'BRAND_TRUTH_CONFLICT',
      qualityGate: brandTruth,
      creditsUsed: 0,
    }, { status: 422 })
  }

  // ── Unified credit check + deduction ────────────────────────────────────────
  const credit = await checkAndDeductCredits(
    userId,
    'CAMPAIGN_GENERATION',
    undefined,
    {
      entityId: workspace.id,
      entityType: 'workspace_campaign_preview',
      operationKey: getCreditOperationKey(req, 'CAMPAIGN_GENERATION', 'workspace_campaign_preview', workspace.id),
    },
  )
  if (!credit.ok) {
    return NextResponse.json(credit, { status: creditCheckHttpStatus(credit) })
  }
  // ────────────────────────────────────────────────────────────────────────────

  const usageCollector = createOpenAIProviderUsageCollector()
  const currentProviderEconomics = () => {
    const calls = usageCollector.snapshot()
    if (calls.length === 0) return undefined
    const usage = summarizeOpenAITextUsage('gpt-4o-mini', calls)
    return {
      providerCostUsd: usage.estimatedProviderCostUsd,
      providerPricingVersion: usage.pricingVersion,
      providerUsage: usage,
    }
  }

  try {
    const campaignData = {
      name: name.trim(),
      goal: goal || 'SALES',
      audience: audience || '',
      tone: tone || 'MODERN',
      platforms: platforms || [],
      description: description || '',
      brandProfile: brandProfile || null,
      language: typeof language === 'string' ? language : 'ar',
    }
    const projectData = { businessType: description || name }

    let [strategy, concepts] = await usageCollector.run(() => Promise.all([
      generateMarketingStrategy(campaignData, projectData),
      generateAdConcepts(campaignData, projectData),
    ]))
    const verifiedProof = Array.isArray(brandProfile?.verifiedProof) ? brandProfile.verifiedProof : []
    const sourceBackedProof = sourceLinkedProofStatements(verifiedProof)
    const strategyProofContext = {
      verifiedProof: sourceBackedProof,
      commercialClaimText: sourceBackedProof,
      allowedClaimText: [
        brandProfile?.description,
        brandProfile?.primaryOffer,
        ...(Array.isArray(brandProfile?.uniqueAdvantages) ? brandProfile.uniqueAdvantages : []),
        ...verifiedProof,
      ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
    }
    strategy = guardStrategyTruthContract(strategy, strategyProofContext, {
      allowedPlatforms: Array.isArray(platforms) ? platforms : [],
      allowedCompetitors: Array.isArray(brandProfile?.competitors) ? brandProfile.competitors : [],
      language: campaignData.language,
      strategyType: 'full',
      hasLeadHandling: Boolean(brandProfile?.leadHandling),
      hasConversionDestination: hasUsableConversionDestination(brandProfile?.conversionDestination, goal || 'SALES'),
      hasBudget: Boolean(brandProfile?.marketingBudget),
      budgetText: brandProfile?.marketingBudget || null,
    })
    assertCampaignStrategyContract(strategy, { language: campaignData.language })

    const qualityGate = reviewStrategyGrounding({
      strategy,
      brand: brandProfile,
      allowedPlatforms: Array.isArray(platforms) ? platforms.map(String) : [],
      requireAllReviewedPlatforms: true,
      goal: String(goal || 'SALES'),
    })
    if (qualityGate.status !== 'passed') {
      await refundCreditDeduction({
        userId,
        action: 'CAMPAIGN_GENERATION',
        deduction: credit,
        reason: 'Generated preview failed the Brand Brain and scope quality gate',
        providerEconomics: currentProviderEconomics(),
      })
      return NextResponse.json({
        error: 'MARKETING_QUALITY_GATE_BLOCKED',
        code: 'MARKETING_QUALITY_GATE_BLOCKED',
        qualityGate,
        refunded: credit.creditsUsed > 0,
      }, { status: 422 })
    }

    const finalization = await finalizeCreditDeduction({
      userId,
      action: 'CAMPAIGN_GENERATION',
      deduction: credit,
      providerEconomics: currentProviderEconomics(),
    })
    if (!finalization.ok) {
      return NextResponse.json({
        error: 'Campaign preview could not be finalized. Reserved credits were returned.',
        code: 'CREDIT_FINALIZATION_FAILED',
        refunded: finalization.refundStatus === 'refunded',
      }, { status: 503 })
    }

    return NextResponse.json({
      campaign: campaignData,
      strategy,
      concepts,
      generatedAt: new Date().toISOString(),
      creditsUsed: credit.creditsUsed,
      creditsRemaining: credit.creditsRemaining,
      creditCharge: buildCreditChargeReceipt('CAMPAIGN_GENERATION', credit),
      qualityGate,
    })
  } catch (err: any) {
    console.error('[generate/preview] error', err)
    await refundCreditDeduction({
      userId,
      action: 'CAMPAIGN_GENERATION',
      deduction: credit,
      reason: 'Campaign preview generation failed',
      providerEconomics: currentProviderEconomics(),
    })
    return NextResponse.json({ error: err.message || 'Generation failed', refunded: credit.creditsUsed > 0 }, { status: 500 })
  }
}
