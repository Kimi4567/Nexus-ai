/**
 * POST /api/strategy/run-full
 *
 * Re-triggers the full agency orchestration from the dashboard at any time.
 * Reads Brand Brain from the existing workspace -- no form required.
 * Reuses the exact same runFullAgency() orchestrator used during onboarding.
 *
 * Credit cost: RUN_FULL_STRATEGY (see lib/credits.ts)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { runFullAgency } from '@/lib/agents/orchestrator'
import { checkAndDeductCredits, refundCreditsForTransaction } from '@/lib/credits'
// B1c-c-1 — allocation-aware refund-to-source for the wallet path (flag-gated).
import { isCreditWalletEnabled } from '@/lib/credits/wallet'
import { normalizeStrategyIntent } from '@/lib/ai/strategyKpiGuard'
// PR-S1c-2 — server-side order normalization + variable charge (never trust client price).
import { resolveStrategyCharge } from '@/lib/strategy/normalizeStrategyOrder'
// PR-S1c-3 — deterministic deliverables contract → binding generation scope.
import { getStrategyDeliverables } from '@/lib/strategy/deliverablesContract'
import { tierToPostsPerMonth } from '@/lib/strategy/strategyOrderDisplay'
import { getBrandBrainReadiness } from '@/lib/brandReadiness'
import { getStrategyBriefReadiness } from '@/lib/strategyBriefReadiness'
import { getRelevantMemories, formatMemoriesForPrompt, saveCampaignMemory } from '@/lib/campaign-memory'
import { aiRateLimitDb } from '@/lib/dbRateLimit'

function isArabicLanguage(language: unknown): boolean {
  return typeof language === 'string' && language.toLowerCase().startsWith('ar')
}

function sanitizeStrategyRunError(error: string | undefined, language: unknown): string | undefined {
  if (!error) return undefined

  if (/Strategy OS contract/i.test(error)) {
    if (isArabicLanguage(language)) {
      return 'أوقف NEXUS حفظ هذه الاستراتيجية لأن النص الناتج لم يطابق اللغة أو جودة المراجعة المطلوبة. لم يتم حفظ حملة جديدة وتمت إعادة كريدت الاستراتيجية إن تم خصمها. حاول مرة أخرى، أو اختر الإنجليزية إذا أردت الاستراتيجية بالإنجليزية.'
    }

    return 'NEXUS blocked this strategy because the generated draft did not match the selected language or review-quality requirements. No new campaign was saved and any strategy credits were restored. Please try again, or choose English if you want the brief in English.'
  }

  return error
}

function genericStrategyRunFailureMessage(language: unknown): string {
  if (isArabicLanguage(language)) {
    return 'تعذر إكمال توليد الاستراتيجية قبل حفظ حملة جديدة. تمت إعادة كريدت هذه المحاولة إن تم خصمها. حاول مرة أخرى.'
  }

  return 'Strategy generation could not be completed before a new campaign was saved. Credits for this attempt were restored if they were charged. Please try again.'
}

type DeductedStrategyCredit = {
  creditsRemaining: number
  creditsUsed: number
  transactionId?: string
}

async function refundDeductedStrategyCredits(
  userId: string,
  credit: DeductedStrategyCredit | null,
  reason: string,
): Promise<boolean> {
  if (!credit || credit.creditsUsed <= 0) return false

  try {
    if (isCreditWalletEnabled() && credit.transactionId) {
      await refundCreditsForTransaction({
        userId,
        transactionId: credit.transactionId,
        reason,
      })
      console.log(`[strategy/run-full] Refunded ${credit.creditsUsed} credits to user ${userId} (wallet)`)
      return true
    }

    const refundData = {
      userId,
      action: 'REFUND',
      amount: credit.creditsUsed,
      description: `Refund — ${reason}`,
      entityType: 'refund',
    }

    if (typeof (prisma as any).$transaction === 'function') {
      await (prisma as any).$transaction(async (tx: any) => {
        await tx.user.update({
          where: { id: userId },
          data: { aiCredits: { increment: credit.creditsUsed } },
        })
        await tx.creditTransaction.create({ data: refundData })
      })
    } else {
      await prisma.user.update({
        where: { id: userId },
        data: { aiCredits: { increment: credit.creditsUsed } },
      })
      await (prisma as any).creditTransaction.create({ data: refundData })
    }
    console.log(`[strategy/run-full] Refunded ${credit.creditsUsed} credits to user ${userId}`)
    return true
  } catch (refundErr) {
    console.error('[strategy/run-full] Credit refund failed:', refundErr)
    return false
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {}
  let chargedUserId: string | null = null
  let deductedCredit: DeductedStrategyCredit | null = null

  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Rate limit: max 20 full-strategy runs per hour per user (most expensive AI operation)
    const rateLimit = await aiRateLimitDb(user.id)
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: 'RATE_LIMITED', message: rateLimit.message },
        { status: 429 }
      )
    }

    body = await req.json().catch(() => ({}))
    const goalOverride = (body?.goal as string | undefined) || 'leads'
    const selectedMediaIds = Array.isArray(body?.mediaIds)
      ? (body.mediaIds as unknown[]).filter((id): id is string => typeof id === 'string' && id.length > 0)
      : undefined
    // PR-I — generation-time strategy intent (chosen in the modal; safe defaults).
    const { strategyType, strategyDuration } = normalizeStrategyIntent(body?.strategyType, body?.strategyDuration)

    // ── PR-S1c-2 — variable strategy pricing ───────────────────────────────
    // Rebuild a validated StrategyOrder from the body and RECOMPUTE the cost
    // server-side. The client only displays a price; it is never trusted here.
    // The body's contentIntensity/customDurationDays feed the order; any
    // client-supplied price is ignored.
    const charge = resolveStrategyCharge({
      strategyType: body?.strategyType,
      strategyDuration: body?.strategyDuration,
      contentIntensity: body?.contentIntensity,
      customDurationDays: body?.customDurationDays,
      language: body?.language,
    })

    // Unsupported (custom > 180 days, or non-positive) → block BEFORE any
    // deduction. No credits are ever charged for an unsupported order.
    if (!charge.supported || charge.cost == null) {
      return NextResponse.json(
        {
          error: 'UNSUPPORTED_DURATION',
          message:
            'Strategies longer than 180 days are not supported yet. Contact support for a custom quote — no credits were charged.',
          supported: false,
        },
        { status: 422 },
      )
    }

    // Get workspace
    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
    })
    if (!workspace) {
      return NextResponse.json(
        { error: 'NO_WORKSPACE', message: 'No workspace found. Please complete onboarding first.' },
        { status: 422 }
      )
    }

    // Get brand profile -- required to auto-populate the brief
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { workspaceId: workspace.id },
    })
    if (!brandProfile) {
      return NextResponse.json(
        {
          error: 'NO_BRAND_PROFILE',
          message: 'Brand Brain not set up. Please complete your brand profile first.',
          redirectUrl: '/brand',
        },
        { status: 422 }
      )
    }

    // Defense-in-depth: check Brand Brain readiness before spending credits
    const readiness = getBrandBrainReadiness(brandProfile as any)
    if (!readiness.ready) {
      return NextResponse.json(
        {
          error: 'BRAND_BRAIN_INCOMPLETE',
          message: `Brand Brain is missing required fields: ${readiness.missingRequired.join(', ')}.`,
          missingRequired: readiness.missingRequired,
          score: readiness.score,
          redirectUrl: '/brand',
        },
        { status: 422 }
      )
    }

    // STRATEGY-OS-1 — mode-aware Strategy Brief gate before any credit deduction.
    // Organic may proceed on the core brief. Paid/full must have explicit paid
    // inputs; no internal default budget may unlock or shape paid generation.
    const strategyBriefReadiness = getStrategyBriefReadiness({
      mode: strategyType,
      brandProfile: brandProfile as any,
    })
    if (!strategyBriefReadiness.canGenerate) {
      return NextResponse.json(
        {
          error: strategyBriefReadiness.explanation,
          code: 'STRATEGY_BRIEF_INCOMPLETE',
          mode: strategyBriefReadiness.mode,
          missingRequiredFields: strategyBriefReadiness.missingRequiredFields,
          recommendedFields: strategyBriefReadiness.recommendedFields,
          blockers: strategyBriefReadiness.blockers,
          warnings: strategyBriefReadiness.warnings,
          safeScope: strategyBriefReadiness.safeScope,
          redirectUrl: '/brand',
        },
        { status: 422 },
      )
    }

    // -- Unified credit check + deduction (variable, server-computed cost) ----
    // Charge only after workspace, Brand Brain profile, readiness, and order
    // validation have passed. Early setup failures must never spend credits.
    const credit = await checkAndDeductCredits(user.id, 'RUN_FULL_STRATEGY', charge.cost)
    if (!credit.ok) {
      return NextResponse.json(credit, { status: 402 })
    }
    chargedUserId = user.id
    deductedCredit = {
      creditsRemaining: credit.creditsRemaining,
      creditsUsed: credit.creditsUsed,
      transactionId: credit.transactionId,
    }
    // ------------------------------------------------------------------------

    // Get user preferences for language detection + plan tier for the deliverables contract
    const freshUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { preferences: true, subscriptionStatus: true },
    })

    // Language detection: body -> user preferences -> fallback 'ar'
    const userPrefs = (freshUser?.preferences as Record<string, string> | null) ?? {}
    const language: string =
      (body?.language as string | undefined) ||
      userPrefs?.language ||
      'ar'

    // ── PR-S1c-3 — deterministic deliverables contract → BINDING generation scope ──
    // Reuse the SAME validated order that priced the run (charge.order), enrich its
    // goal, and resolve the plan quota via the SAME helper the modal used
    // (tierToPostsPerMonth) so the post count shown in the review equals the count
    // the generation is told to produce. Counts/scope come from getStrategyDeliverables
    // — never from the AI. (Custom > 180 was already 422-blocked above, so the contract
    // here is always supported; the unsupported branch returns DO-NOT-GENERATE anyway.)
    const order = { ...charge.order, goal: charge.order.goal || brandProfile.businessGoal || goalOverride }
    const postsPerMonth = tierToPostsPerMonth(freshUser?.subscriptionStatus)
    const deliverables = getStrategyDeliverables(
      order,
      typeof postsPerMonth === 'number' ? { postsPerMonth } : undefined,
    )

    // Build brief from full Brand Brain data -- inject everything
    const brief = {
      companyName: brandProfile.brandName ?? 'My Brand',
      businessType: brandProfile.industry ?? 'General Business',
      targetAudience: brandProfile.targetAudience ?? 'General audience',
      // Internal numeric compatibility only. The strategist prompt gets the
      // real user-provided budget from Brand Brain readiness context. Missing
      // budget must stay "Not provided" and must never become a default spend.
      monthlyBudget: 0,
      primaryGoal: brandProfile.businessGoal || goalOverride,
      // Extended brand brain fields
      competitors: brandProfile.competitorNotes || undefined,
      region: brandProfile.audienceLocation || undefined,
      uniqueValue: brandProfile.uniqueAdvantages?.length
        ? brandProfile.uniqueAdvantages.join(', ')
        : undefined,
      avoidWords: brandProfile.avoidKeywords?.length
        ? brandProfile.avoidKeywords.join(', ')
        : undefined,
      writingStyle: brandProfile.writingStyle || undefined,
      pricePoint: brandProfile.pricePoint || undefined,
      painPoints: brandProfile.audiencePainPoints?.length
        ? brandProfile.audiencePainPoints.join(', ')
        : undefined,
      desires: brandProfile.audienceDesires?.length
        ? brandProfile.audienceDesires.join(', ')
        : undefined,
      primaryOffer: brandProfile.primaryOffer || undefined,
      currentPlatforms: brandProfile.topPlatforms?.length ? brandProfile.topPlatforms : undefined,
      winningHooks: brandProfile.winningHooks?.length
        ? brandProfile.winningHooks.slice(0, 3).join(' | ')
        : undefined,
      // Language preference -- drives AI output language
      language,
      // PR-I — strategy intent (generation-time choice; not persisted to Brand Brain)
      strategyType,
      strategyDuration,
      // PR-S1c-3 — deterministic generation contract (the order the user reviewed & paid for).
      // The strategist treats generationInstructions as BINDING scope; counts come from here.
      strategyOrder: order,
      strategyDeliverables: deliverables,
      generationInstructions: [
        deliverables.generationInstructions,
        `Strategy Brief Readiness Scope: ${strategyBriefReadiness.safeScope}`,
        strategyBriefReadiness.paidPlanningOnly
          ? 'Paid scope is planning-only. Do not describe ad launch, spend, platform activation, connected-account readiness, or publishing as included in this run.'
          : '',
        strategyBriefReadiness.warnings.includes('verified_proof_missing')
          ? 'Verified proof is missing. Avoid proof-based claims and recommend collecting proof instead.'
          : '',
      ].filter(Boolean).join('\n'),
      organicPostCount: deliverables.organicPostCount,
      detailedCalendarDays: deliverables.detailedCalendarDays,
      roadmapMonths: deliverables.roadmapMonths,
      planCapApplied: deliverables.planCapApplied,
      // Campaign memory: inject past learnings for this workspace
      pastLearnings: formatMemoriesForPrompt(
        await getRelevantMemories({
          workspaceId: workspace.id,
          goal: goalOverride,
        })
      ) || undefined,
      selectedMediaIds: selectedMediaIds ?? [],
    }

    // Fetch media context — respect the user's explicit media selection.
    try {
      const mediaItems = await prisma.media.findMany({
        where: {
          workspace: { ownerId: user.id },
          ...(selectedMediaIds ? { id: { in: selectedMediaIds } } : {}),
        },
        select: { type: true, fileName: true },
        take: 100,
      })
      if (mediaItems.length > 0) {
        const imageCount = mediaItems.filter(m => m.type === 'IMAGE').length
        const videoCount = mediaItems.filter(m => m.type === 'VIDEO').length
        const parts: string[] = []
        if (imageCount > 0) parts.push(`${imageCount} image${imageCount !== 1 ? 's' : ''}`)
        if (videoCount > 0) parts.push(`${videoCount} video${videoCount !== 1 ? 's' : ''}`)
        ;(brief as Record<string, unknown>).mediaContext =
          `User has ${parts.join(' and ')} in their media library. Incorporate these existing visual assets into the content strategy — recommend specific usage per platform and content format.`
      }
    } catch { /* non-fatal — proceed without media context */ }

    // Run full orchestration
    const result = await runFullAgency(workspace.id, brief)

    // Fetch the newly-created campaign
    const campaign = result.strategyCreated
      ? await (prisma as any).campaign.findFirst({
          where: { workspaceId: workspace.id },
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true },
        })
      : null

    const success = result.strategyCreated && !!campaign?.id

    // ── Credit refund on complete failure ──────────────────────────────────
    // If strategy itself failed (no campaign created), refund the credits.
    // PR-S1c-2: refund MUST use credit.creditsUsed (the actual variable amount
    // deducted) — NOT refundCredits(userId, 'RUN_FULL_STRATEGY'), which would
    // refund the fixed CREDIT_COSTS.RUN_FULL_STRATEGY (8) and over/under-refund a
    // variable charge. creditsUsed is 0 for unlimited plans, so the guard below
    // correctly skips the refund for them.
    const refunded = !success
      ? await refundDeductedStrategyCredits(user.id, deductedCredit, 'Run Full Strategy failed')
      : false
    // ──────────────────────────────────────────────────────────────────────

    const rawError = !success && result.errors.length > 0 ? result.errors[0] : undefined
    const publicError = sanitizeStrategyRunError(rawError, body?.language)
    const publicErrors = result.errors.map(error => sanitizeStrategyRunError(error, body?.language) || error)

    return NextResponse.json({
      ok: success,
      agentRunId: result.agentRunId,
      campaignId: campaign?.id ?? null,
      campaignName: campaign?.name ?? null,
      suggestions: result.suggestions,
      creditsRemaining: success
        ? credit.creditsRemaining
        : credit.creditsRemaining + (refunded ? credit.creditsUsed : 0),
      creditsUsed: success ? credit.creditsUsed : (refunded ? 0 : credit.creditsUsed),
      refunded,
      // Both formats for frontend compatibility
      errors: publicErrors,
      error: publicError,
    })
  } catch (err: any) {
    console.error('[api/strategy/run-full]', err)
    const refunded = chargedUserId
      ? await refundDeductedStrategyCredits(chargedUserId, deductedCredit, 'Run Full Strategy exception')
      : false
    const rawError = typeof err?.message === 'string' ? err.message : undefined
    const safeError = rawError && /Strategy OS contract/i.test(rawError)
      ? sanitizeStrategyRunError(rawError, body?.language) || genericStrategyRunFailureMessage(body?.language)
      : genericStrategyRunFailureMessage(body?.language)

    return NextResponse.json(
      {
        ok: false,
        error: safeError,
        errors: [safeError],
        refunded,
        creditsRemaining: deductedCredit
          ? deductedCredit.creditsRemaining + (refunded ? deductedCredit.creditsUsed : 0)
          : undefined,
        creditsUsed: refunded ? 0 : (deductedCredit?.creditsUsed ?? 0),
      },
      { status: 500 },
    )
  }
}
