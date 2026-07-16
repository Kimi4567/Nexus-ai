import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import * as ai from '@/lib/ai/adapter'
import {
  buildCreditChargeReceipt,
  checkAndDeductCredits,
  creditCheckHttpStatus,
  finalizeCreditDeduction,
  refundCreditDeduction,
} from '@/lib/credits'
import { aiRateLimitDb } from '@/lib/dbRateLimit'
import { validateOutputObject, logQualityReport } from '@/lib/ai/outputValidator'
import { getRelevantMemories, formatMemoriesForPrompt, saveCampaignMemory } from '@/lib/campaign-memory'
import { getAiProviderUnavailablePayload, isAiProviderConfigured } from '@/lib/ai/provider'
import { guardStrategyOutputContract } from '@/lib/ai/strategyOutputContractGuard'
import { guardStrategyProof } from '@/lib/ai/strategyProofGuard'
import { assertCampaignStrategyContract } from '@/lib/campaignStrategyContract'
import { reviewBrandTruthConsistency, reviewStrategyGrounding } from '@/lib/ai/marketingQualityGate'
import { getCreditOperationKey } from '@/lib/creditOperationKey.server'
import { captureOperationalError } from '@/lib/observability/operationalError'

export async function POST(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // BUG-03 fix: DB-backed rate limit (cross-instance, survives cold starts)
  const rl = await aiRateLimitDb(userId)
  if (!rl.ok) return NextResponse.json({ error: rl.message }, { status: 429 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { campaignId, language } = body
  if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 })

  // BUG-04 fix: verify ownership — only the campaign owner can trigger generation
  const workspace = await prisma.workspace.findFirst({ where: { ownerId: userId } })
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId: workspace.id },
  })
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const project = await prisma.project.findUnique({ where: { id: campaign.projectId }, include: { media: true } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
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

  if (!isAiProviderConfigured()) {
    return NextResponse.json(getAiProviderUnavailablePayload(language), { status: 503 })
  }

  // Attach language preference so AI functions use the correct output language
  // Falls back to 'ar' (Arabic) to preserve behaviour for existing users
  const memories = await getRelevantMemories({
    workspaceId: workspace.id,
    goal: campaign.goal ?? undefined,
  })
  const pastLearnings = formatMemoriesForPrompt(memories) || undefined

  const campaignWithLang = {
    ...(campaign as any),
    language: language || 'ar',
    pastLearnings,
    brandProfile,
  }

  // ── Unified credit check + deduction ────────────────────────────────────────
  // Deduct only after cheap validation and ownership checks pass. The next step
  // is the expensive AI/provider work.
  const credit = await checkAndDeductCredits(
    userId,
    'CAMPAIGN_GENERATION',
    undefined,
    {
      entityId: campaign.id,
      entityType: 'campaign_generation',
      operationKey: getCreditOperationKey(req, 'CAMPAIGN_GENERATION', 'campaign_generation', campaign.id),
    },
  )
  if (!credit.ok) {
    return NextResponse.json(credit, { status: creditCheckHttpStatus(credit) })
  }
  // ────────────────────────────────────────────────────────────────────────────

  try {
    // Run both AI calls in parallel — halves execution time vs sequential
    let [strategy, concepts] = await Promise.all([
      ai.generateMarketingStrategy(campaignWithLang, project as any),
      ai.generateAdConcepts(campaignWithLang, project as any),
    ])

    // Legacy campaign generation now passes through the same persistence
    // contract as Strategy OS. This route may remain for old campaigns, but it
    // can no longer overwrite a campaign with the weaker legacy shape.
    strategy = guardStrategyOutputContract(
      guardStrategyProof(strategy, {
        verifiedProof: brandProfile?.verifiedProof || [],
        allowedClaimText: [
          brandProfile?.description,
          brandProfile?.primaryOffer,
          ...(brandProfile?.uniqueAdvantages || []),
          ...(brandProfile?.verifiedProof || []),
        ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
      }),
      {
        allowedPlatforms: campaign.platforms || [],
        allowedCompetitors: brandProfile?.competitors || [],
        language: language || 'ar',
        strategyType: 'full',
        hasLeadHandling: Boolean(brandProfile?.leadHandling),
        hasConversionDestination: Boolean(brandProfile?.conversionDestination),
      },
    )
    assertCampaignStrategyContract(strategy, { language: language || 'ar' })

    const qualityGate = reviewStrategyGrounding({
      strategy,
      brand: brandProfile,
      allowedPlatforms: campaign.platforms || [],
      goal: String(campaign.goal),
    })
    if (qualityGate.status !== 'passed') {
      await refundCreditDeduction({
        userId,
        action: 'CAMPAIGN_GENERATION',
        deduction: credit,
        reason: 'Generated campaign failed the Brand Brain and scope quality gate',
      })
      return NextResponse.json({
        error: 'MARKETING_QUALITY_GATE_BLOCKED',
        code: 'MARKETING_QUALITY_GATE_BLOCKED',
        qualityGate,
        refunded: credit.creditsUsed > 0,
      }, { status: 422 })
    }

    // AD3: Post-generation quality validation (non-blocking — logs only)
    const qualityReport = validateOutputObject(strategy, {
      brandName: campaign.name,
      minScore: 40,
    })
    logQualityReport('/api/generate', qualityReport, `campaign=${campaign.id}`)

    // ── CRITICAL: Save aiOutput — run in parallel with non-critical audit records ──
    await Promise.all([
      prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          aiOutput: { strategy, concepts, qualityGate } as any,
          activities: {
            create: {
              type: 'generated',
              description: 'AI strategy and ad concepts generated',
            },
          },
        },
      }),
      // Audit records — non-critical, failures are silenced
      prisma.generation.create({
        data: {
          campaignId: campaign.id, type: 'SOCIAL_POST', prompt: 'marketing strategy',
          params: {}, status: 'COMPLETED', output: JSON.stringify(strategy),
          provider: 'openai',
        },
      }).catch(() => null),
      prisma.generation.create({
        data: {
          campaignId: campaign.id, type: 'SOCIAL_POST', prompt: 'ad concepts',
          params: {}, status: 'COMPLETED', output: JSON.stringify(concepts),
          provider: 'openai',
        },
      }).catch(() => null),
    ])

    // Save campaign memory (non-blocking — never delays the response)
    saveCampaignMemory({
      workspaceId: workspace.id,
      campaignId: campaign.id,
      goal: campaign.goal ?? undefined,
      tone: (campaign as any).tone ?? undefined,
      audienceHint: campaign.audience ?? undefined,
      strategy: strategy as any,
    }).catch(() => {})

    const finalization = await finalizeCreditDeduction({
      userId,
      action: 'CAMPAIGN_GENERATION',
      deduction: credit,
    })
    if (!finalization.ok) {
      return NextResponse.json({
        error: 'Campaign output was saved but the credit operation could not be finalized. Reserved credits were returned; refresh the campaign.',
        code: 'CREDIT_FINALIZATION_FAILED',
        refunded: finalization.refundStatus === 'refunded',
      }, { status: 503 })
    }

    return NextResponse.json({
      strategy,
      concepts,
      creditsUsed: credit.creditsUsed,
      creditsRemaining: credit.creditsRemaining,
      creditCharge: buildCreditChargeReceipt('CAMPAIGN_GENERATION', credit),
      qualityScore: qualityReport.score,
      qualityGate,
    })
  } catch (error) {
    await captureOperationalError(error, {
      operation: 'ai.campaign-generate',
      route: '/api/generate',
      component: 'ai',
      method: 'POST',
      requestId: req.headers?.get?.('x-vercel-id') ?? null,
      statusCode: 500,
      retryable: true,
    })
    // Refund — failed generation must not charge the user (skip unlimited plans)
    await refundCreditDeduction({
      userId,
      action: 'CAMPAIGN_GENERATION',
      deduction: credit,
      reason: 'Campaign generation failed',
    })
    return NextResponse.json({ error: 'Generation failed', refunded: credit.creditsUsed > 0 }, { status: 500 })
  }
}
