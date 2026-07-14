/**
 * POST /api/ad-campaigns/ai-suggest
 *
 * Reads Brand Brain + an approved Paid/Full strategy → returns an execution suggestion.
 * Free (no provider call) — deterministic setup from the approved strategy,
 * Brand Brain, compatible connected accounts, and the fixed execution objective.
 *
 * Returns:
 *   platform, objective, dailyBudget, currency, name, language, rationale
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/apiAuth'
import { suggestRateLimitDb } from '@/lib/dbRateLimit'
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

const PLATFORM_HINTS: Record<string, RegExp> = {
  META: /\b(meta|facebook|instagram)\b/i,
  GOOGLE: /\bgoogle(?:\s+ads)?\b|\bsearch\b/i,
  TIKTOK: /\btik\s*tok\b/i,
  LINKEDIN: /\blinked\s*in\b/i,
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
    const connectedPlatforms: string[] = Array.from(new Set<string>(
      compatibleAccounts.map((account: { platform: string }) => account.platform),
    ))
    if (connectedPlatforms.length === 0) {
      return NextResponse.json({
        error: activeAccounts.length > 0 ? 'PAID_NO_COMPATIBLE_ACCOUNT' : 'PAID_AD_ACCOUNT_REQUIRED',
        code: activeAccounts.length > 0 ? 'PAID_NO_COMPATIBLE_ACCOUNT' : 'PAID_AD_ACCOUNT_REQUIRED',
      }, { status: 422 })
    }

    const now = new Date()
    const month = now.toLocaleString('en', { month: 'short' })
    const year = now.getFullYear()

    const sourceText = [
      paidSource.executionContext,
      ...(Array.isArray(paidSource.campaign.platforms) ? paidSource.campaign.platforms : []),
    ].join(' ')
    const explicitStrategyPlatform = connectedPlatforms.find(platform => PLATFORM_HINTS[platform]?.test(sourceText))
    const audienceText = `${brandProfile.targetAudience || ''} ${brandProfile.description || ''}`
    const looksB2B = /\b(b2b|businesses|companies|founders|teams|enterprise)\b|شركات|مؤسسات|فرق|رواد الأعمال/i.test(audienceText)
    const objective = paidSource.truth.executionObjective
    const platform = normalizePaidPlanningPlatform(
      explicitStrategyPlatform
      || (looksB2B && connectedPlatforms.includes('LINKEDIN') ? 'LINKEDIN' : '')
      || (['TRAFFIC', 'CONVERSIONS'].includes(objective) && connectedPlatforms.includes('GOOGLE') ? 'GOOGLE' : '')
      || (connectedPlatforms.includes('META') ? 'META' : '')
      || connectedPlatforms[0],
    )
    const platformAccounts = compatibleAccounts.filter((account: { platform: string }) => account.platform === platform)
    const accountCurrencies = [...new Set(
      platformAccounts
        .map((account: { currency?: string | null }) => account.currency)
        .filter((currency: unknown): currency is string => typeof currency === 'string' && currency.length > 0),
    )]
    const language = isMENA ? 'ar' : 'en'
    const name = `${brandProfile.brandName || 'Campaign'} — ${objective.replace(/_/g, ' ').toLowerCase()} ${month} ${year}`
    return NextResponse.json({
      platform,
      objective: paidSource.truth.executionObjective,
      dailyBudget: null,
      currency: accountCurrencies.length === 1 ? accountCurrencies[0] : null,
      name,
      language,
      rationale: normalizePaidPlanningRationale({
        platform,
        objective: paidSource.truth.executionObjective,
        rationale: '',
        locale: language === 'ar' ? 'ar' : 'en',
      }),
      requiresBudgetConfirmation: true,
      requiresCurrencyConfirmation: true,
      providerGenerated: false,
      recommendationSource: 'approved_strategy_rules',
      creditsUsed: 0,
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
