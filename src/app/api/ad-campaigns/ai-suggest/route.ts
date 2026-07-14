/**
 * POST /api/ad-campaigns/ai-suggest
 *
 * Reads Brand Brain + an approved Paid/Full strategy → returns an execution suggestion.
 * Free (no credit cost) — it's a smart recommendation, not a full AI generation.
 *
 * Returns:
 *   platform, objective, dailyBudget, currency, name, language, rationale
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/apiAuth'
import { suggestRateLimitDb } from '@/lib/dbRateLimit'
import { buildBrandExecutionContext } from '@/lib/brandExecutionContext'
import { getAiProviderUnavailablePayload, isAiProviderConfigured } from '@/lib/ai/provider'
import {
  normalizePaidPlanningPlatform,
  normalizePaidPlanningRationale,
} from '@/lib/paidPlanningSuggestion'
import { paidPlatformSupportsObjective } from '@/lib/paidExecutionObjective'
import {
  getPaidStrategySourceForUser,
  PaidStrategySourceError,
} from '@/lib/paidStrategySourceServer'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

async function callGPT(system: string, user: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 600,
    }),
  })
  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`)
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error('OpenAI returned no campaign suggestion')
  return content
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json().catch(() => ({})) as { sourceCampaignId?: unknown }

    // Rate limit — 30 AI suggestions per hour (free endpoint, no credits)
    const rl = await suggestRateLimitDb(user.id)
    if (!rl.ok) return NextResponse.json({ error: rl.message }, { status: 429 })

    const paidSource = await getPaidStrategySourceForUser({
      campaignId: typeof body.sourceCampaignId === 'string' ? body.sourceCampaignId : '',
      userId: user.id,
    })

    // Get Brand Brain
    let brandProfile = null
    try {
      brandProfile = await db.brandProfile.findUnique({
        where: { workspaceId: paidSource.campaign.workspaceId },
      })
    } catch { /* ok */ }

    // Detect MENA market
    const locationHint = (brandProfile?.audienceLocation || '').toLowerCase()
    const isMENA = ['saudi', 'uae', 'egypt', 'mena', 'gulf', 'كويت', 'إمارات', 'السعودية', 'مصر', 'خليج'].some(
      kw => locationHint.includes(kw)
    )

    if (!brandProfile) {
      return NextResponse.json({
        error: 'BRAND_BRAIN_REQUIRED',
        code: 'BRAND_BRAIN_REQUIRED',
      }, { status: 422 })
    }

    const activeAccounts = await db.adAccount.findMany({
      where: {
        workspaceId: paidSource.campaign.workspaceId,
        status: 'ACTIVE',
        platform: { in: ['META', 'GOOGLE', 'TIKTOK', 'LINKEDIN'] },
      },
      select: { id: true, platform: true, currency: true },
    })
    const compatibleAccounts = activeAccounts.filter((account: { platform: string }) => (
      paidPlatformSupportsObjective(account.platform, paidSource.truth.executionObjective)
    ))
    const connectedPlatforms = [...new Set(
      compatibleAccounts.map((account: { platform: string }) => account.platform),
    )]
    if (connectedPlatforms.length === 0) {
      return NextResponse.json({
        error: activeAccounts.length > 0 ? 'PAID_NO_COMPATIBLE_ACCOUNT' : 'PAID_AD_ACCOUNT_REQUIRED',
        code: activeAccounts.length > 0 ? 'PAID_NO_COMPATIBLE_ACCOUNT' : 'PAID_AD_ACCOUNT_REQUIRED',
      }, { status: 422 })
    }

    if (!isAiProviderConfigured()) {
      return NextResponse.json(getAiProviderUnavailablePayload(isMENA ? 'ar' : 'en'), { status: 503 })
    }

    const brandCtx = buildBrandExecutionContext(brandProfile)

    const now = new Date()
    const month = now.toLocaleString('en', { month: 'short' })
    const year = now.getFullYear()

    const systemPrompt = `You are a senior paid media execution planner.
The approved Paid/Full strategy is the marketing decision source. Brand Brain is the brand-truth source.
Suggest one platform execution configuration without rewriting the strategy, changing its audience, inventing an offer, or introducing unsupported claims.
Never claim readiness, never launch anything, and never invent a budget, currency, result, forecast, or platform capability.
The rationale must discuss only the returned platform and explain how it executes the approved strategy. Output ONLY valid JSON.`

    const userPrompt = `APPROVED SOURCE STRATEGY: ${paidSource.campaign.name}
${paidSource.executionContext}

BRAND BRAIN TRUTH:
${brandCtx}

Suggest the best platform execution configuration for this approved strategy. Consider:
- Choose ONLY from connected active platforms: ${connectedPlatforms.join(', ')}
- Channel roles: META (B2C/social), LINKEDIN (B2B/professional), TIKTOK (young/consumer), GOOGLE (high-intent/search)
- Objective is fixed by the approved strategy: ${paidSource.truth.executionObjective}
- Budget: return null; the user must explicitly confirm a daily budget
- Language: 'ar' for Arabic-speaking market, 'en' for English, 'bilingual' for mixed

Return JSON:
{
  "platform": "META|GOOGLE|TIKTOK|LINKEDIN",
  "objective": "${paidSource.truth.executionObjective}",
  "dailyBudget": null,
  "currency": null,
  "name": "${brandProfile.brandName || 'Campaign'} — [objective label] ${month} ${year}",
  "language": "ar|en|bilingual",
  "rationale": "1-2 sentence explanation of why these choices make sense for this brand"
}`

    const raw = await callGPT(systemPrompt, userPrompt)
    let suggestion: Record<string, unknown>
    try {
      suggestion = JSON.parse(raw)
    } catch {
      suggestion = {}
    }

    const providerSuggestionComplete =
      typeof suggestion.platform === 'string' &&
      typeof suggestion.objective === 'string' &&
      typeof suggestion.name === 'string' &&
      typeof suggestion.rationale === 'string'

    if (!providerSuggestionComplete) {
      return NextResponse.json({
        error: 'AI_EXECUTION_SUGGESTION_INCOMPLETE',
        code: 'AI_EXECUTION_SUGGESTION_INCOMPLETE',
      }, { status: 502 })
    }

    const proposedPlatform = normalizePaidPlanningPlatform(suggestion.platform)
    const platform = connectedPlatforms.includes(proposedPlatform)
      ? proposedPlatform
      : connectedPlatforms.length === 1
        ? normalizePaidPlanningPlatform(connectedPlatforms[0])
        : null
    if (!platform) {
      return NextResponse.json({
        error: 'AI_EXECUTION_PLATFORM_NOT_CONNECTED',
        code: 'AI_EXECUTION_PLATFORM_NOT_CONNECTED',
      }, { status: 502 })
    }
    const platformAccounts = compatibleAccounts.filter((account: { platform: string }) => account.platform === platform)
    const accountCurrencies = [...new Set(
      platformAccounts
        .map((account: { currency?: string | null }) => account.currency)
        .filter((currency: unknown): currency is string => typeof currency === 'string' && currency.length > 0),
    )]
    const language = String(suggestion.language || 'en')
    return NextResponse.json({
      platform,
      objective: paidSource.truth.executionObjective,
      dailyBudget: null,
      currency: accountCurrencies.length === 1 ? accountCurrencies[0] : null,
      name: suggestion.name,
      language,
      rationale: normalizePaidPlanningRationale({
        platform,
        objective: paidSource.truth.executionObjective,
        rationale: suggestion.rationale,
        locale: language === 'ar' ? 'ar' : 'en',
      }),
      requiresBudgetConfirmation: true,
      requiresCurrencyConfirmation: true,
      providerGenerated: true,
      recommendationSource: 'openai',
      sourceStrategy: {
        id: paidSource.campaign.id,
        name: paidSource.campaign.name,
        scope: paidSource.truth.scope,
      },
      suggestedAdAccountId: platformAccounts.length === 1 ? platformAccounts[0].id : null,
    })
  } catch (err) {
    if (err instanceof PaidStrategySourceError) {
      return NextResponse.json({ error: err.code, code: err.code }, { status: err.status })
    }
    console.error('[ai-suggest]', err)
    return NextResponse.json({ error: 'Suggestion failed' }, { status: 500 })
  }
}
