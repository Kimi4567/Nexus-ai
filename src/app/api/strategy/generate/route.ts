import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { prisma } from '@/lib/prisma'
import { getLanguageInstruction } from '@/lib/ai/langHelper'
import {
  buildCreditChargeReceipt,
  checkAndDeductCredits,
  creditCheckHttpStatus,
  finalizeCreditDeduction,
  refundCreditDeduction,
  type CreditDeductionOk,
} from '@/lib/credits'
import { buildStrategyPrompt, guardGeneratedStrategy, extractAllowedNumbers } from '@/lib/ai/strategyGenerateGuard'
import { buildBrandExecutionContext } from '@/lib/brandExecutionContext'
import { getAiProviderUnavailablePayload, isAiProviderConfigured } from '@/lib/ai/provider'
import { reviewBrandTruthConsistency, reviewStrategyGrounding } from '@/lib/ai/marketingQualityGate'
import { enforceBillableAiRateLimit } from '@/lib/billableAiRateLimit'
import { getCreditOperationKey } from '@/lib/creditOperationKey.server'
import { captureOperationalError } from '@/lib/observability/operationalError'
import { readOpenAIChatUsage, summarizeOpenAITextUsage, type OpenAITextUsage } from '@/lib/ai/providerEconomics'
import { fetchAiProvider } from '@/lib/ai/providerFetch'

async function callOpenAI(prompt: string): Promise<{ result: any; usage: OpenAITextUsage }> {
  const response = await fetchAiProvider('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    }),
  }, {
    providerName: 'OpenAI strategy generator',
    timeoutMs: 75_000,
  })
  // Defensive (Trust Sprint #1): a non-2xx or malformed OpenAI response must
  // reject — never silently parse to `{}` and look like a successful strategy.
  const data = await response.json().catch(() => null)
  if (!data) {
    throw new Error(`OpenAI request failed (${response.status})`)
  }
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI returned no content')
  return { result: JSON.parse(content), usage: readOpenAIChatUsage(data.usage) }
}

export async function POST(req: NextRequest) {
  let chargedCredit: CreditDeductionOk | null = null
  let chargedUserId: string | null = null
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await adminClient.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { goal, timeframe, platform, budget, language } = await req.json()

    if (!isAiProviderConfigured()) {
      return NextResponse.json(getAiProviderUnavailablePayload(language), { status: 503 })
    }

    // Get brand profile for context
    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
    })
    if (!workspace) {
      return NextResponse.json({ error: 'No workspace', creditsUsed: 0 }, { status: 404 })
    }

    let brandContext = ''
    let brandProfile = null
    brandProfile = await prisma.brandProfile.findFirst({
      where: { workspaceId: workspace.id },
    })
    brandContext = buildBrandExecutionContext(brandProfile as unknown as Record<string, unknown> | null)

    const brandTruth = reviewBrandTruthConsistency(brandProfile)
    if (brandTruth.status !== 'passed') {
      return NextResponse.json({
        error: 'BRAND_TRUTH_CONFLICT',
        code: 'BRAND_TRUTH_CONFLICT',
        qualityGate: brandTruth,
        creditsUsed: 0,
      }, { status: 422 })
    }

    const days = timeframe === '30' ? 30 : timeframe === '60' ? 60 : 90
    const weeks = Math.floor(days / 7)

    const langInstruction = getLanguageInstruction(language || 'ar')

    // PR-C — safety-guarded prompt: English/neutral JSON-schema hints (no hard-coded
    // Arabic leaking into EN output), qualitative KPIs, conservative paid wording.
    const prompt = buildStrategyPrompt({ days, weeks, goal, platform, budget, brandContext, langInstruction })

    const rateLimitResponse = await enforceBillableAiRateLimit(user.id, 'CAMPAIGN_GENERATION')
    if (rateLimitResponse) return rateLimitResponse

    // ── Deduct credits before AI call ────────────────────────────
    const credit = await checkAndDeductCredits(
      user.id,
      'CAMPAIGN_GENERATION',
      undefined,
      {
        entityId: workspace.id,
        entityType: 'workspace_strategy_preview',
        operationKey: getCreditOperationKey(req, 'CAMPAIGN_GENERATION', 'workspace_strategy_preview', workspace.id),
      },
    )
    if (!credit.ok) return NextResponse.json(credit, { status: creditCheckHttpStatus(credit) })
    chargedCredit = credit
    chargedUserId = user.id

    let strategy
    let strategyUsage: OpenAITextUsage | null = null
    try {
      const generated = await callOpenAI(prompt)
      strategy = generated.result
      strategyUsage = generated.usage
      if (!strategy || typeof strategy !== 'object' || Object.keys(strategy).length === 0) {
        throw new Error('OpenAI returned an incomplete strategy')
      }
    } catch (genErr) {
      const failedUsage = strategyUsage
        ? summarizeOpenAITextUsage('gpt-4o-mini', [strategyUsage])
        : null
      await refundCreditDeduction({
        userId: user.id,
        action: 'CAMPAIGN_GENERATION',
        deduction: credit,
        reason: 'Strategy generation returned no usable output',
        providerEconomics: failedUsage ? {
          providerCostUsd: failedUsage.estimatedProviderCostUsd,
          providerPricingVersion: failedUsage.pricingVersion,
          providerUsage: failedUsage,
        } : undefined,
      })
      throw genErr
    }

    // PR-C — defence-in-depth: neutralize any fabricated KPI/budget numbers the
    // model still emitted. Only the user-provided budget is allowed to appear.
    strategy = guardGeneratedStrategy(strategy, extractAllowedNumbers(budget))
    const providerUsage = strategyUsage
      ? summarizeOpenAITextUsage('gpt-4o-mini', [strategyUsage])
      : null

    const qualityGate = reviewStrategyGrounding({
      strategy,
      brand: brandProfile,
      allowedPlatforms: typeof platform === 'string' && platform.trim() ? [platform] : brandProfile?.topPlatforms,
      requireAllReviewedPlatforms: true,
      goal: typeof goal === 'string' ? goal : null,
    })
    if (qualityGate.status !== 'passed') {
      await refundCreditDeduction({
        userId: user.id,
        action: 'CAMPAIGN_GENERATION',
        deduction: credit,
        reason: 'Generated strategy failed the Brand Brain and scope quality gate',
        providerEconomics: providerUsage ? {
          providerCostUsd: providerUsage.estimatedProviderCostUsd,
          providerPricingVersion: providerUsage.pricingVersion,
          providerUsage,
        } : undefined,
      })
      return NextResponse.json({
        error: 'MARKETING_QUALITY_GATE_BLOCKED',
        code: 'MARKETING_QUALITY_GATE_BLOCKED',
        qualityGate,
        refunded: credit.creditsUsed > 0,
      }, { status: 422 })
    }

    const finalization = await finalizeCreditDeduction({
      userId: user.id,
      action: 'CAMPAIGN_GENERATION',
      deduction: credit,
      providerEconomics: providerUsage ? {
        providerCostUsd: providerUsage.estimatedProviderCostUsd,
        providerPricingVersion: providerUsage.pricingVersion,
        providerUsage,
      } : undefined,
    })
    if (!finalization.ok) {
      chargedCredit = null
      return NextResponse.json({
        error: 'Strategy could not be finalized. Reserved credits were returned.',
        code: 'CREDIT_FINALIZATION_FAILED',
        refunded: finalization.refundStatus === 'refunded',
      }, { status: 503 })
    }
    chargedCredit = null

    return NextResponse.json({
      strategy,
      qualityGate,
      creditsUsed: credit.creditsUsed,
      creditsRemaining: credit.creditsRemaining,
      creditCharge: buildCreditChargeReceipt('CAMPAIGN_GENERATION', credit),
    })
  } catch (err: unknown) {
    await captureOperationalError(err, {
      operation: 'ai.strategy-preview-generate',
      route: '/api/strategy/generate',
      component: 'ai',
      method: 'POST',
      requestId: req.headers?.get?.('x-vercel-id') ?? null,
      statusCode: 500,
      retryable: true,
    })
    if (chargedCredit && chargedUserId) {
      await refundCreditDeduction({
        userId: chargedUserId,
        action: 'CAMPAIGN_GENERATION',
        deduction: chargedCredit,
        reason: 'Strategy generation failed before finalization',
      })
    }
    return NextResponse.json({ error: 'Failed to generate strategy' }, { status: 500 })
  }
}
