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
import { checkAndDeductCredits, FREE_STARTER_CREDITS, refundCreditsForTransaction } from '@/lib/credits'
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
import { getBrandBrainGenerationSafety } from '@/lib/brandBrainGenerationSafety'

function isArabicLanguage(language: unknown): boolean {
  return typeof language === 'string' && language.toLowerCase().startsWith('ar')
}

function sanitizeStrategyRunError(error: string | undefined, language: unknown): string | undefined {
  if (!error) return undefined

  if (/Strategy OS contract/i.test(error)) {
    if (/count:/i.test(error)) {
      return isArabicLanguage(language)
        ? 'أوقف NEXUS الحفظ لأن مولّد الاستراتيجية لم يُكمل العدد الذي راجعته من اتجاهات المحتوى والخطة الأسبوعية. لم تُحفظ حملة جديدة وتمت إعادة الكريدت إن خُصمت. أعد المحاولة؛ سيحاول النظام إصلاح العدد تلقائيًا قبل الحفظ.'
        : 'NEXUS blocked saving because the strategy generator did not complete the reviewed number of content directions and weekly deliverables. No campaign was saved and charged credits were restored. Retry; the system will attempt a count repair before saving.'
    }
    if (isArabicLanguage(language)) {
      return /language:/i.test(error)
        ? 'أوقف NEXUS حفظ هذه الاستراتيجية لأن لغة المخرجات لم تطابق اللغة المختارة. لم يتم حفظ حملة جديدة وتمت إعادة الكريدت إن خُصمت. حاول مرة أخرى مع نفس اللغة أو اختر الإنجليزية إذا أردت المخرجات بالإنجليزية.'
        : 'أوقف NEXUS حفظ هذه الاستراتيجية لأن الوثيقة لم تجتز عقد الجودة البنيوي. لم يتم حفظ حملة جديدة وتمت إعادة الكريدت إن خُصمت. حاول مرة أخرى.'
    }

    return /language:/i.test(error)
      ? 'NEXUS blocked saving because the output language did not match the selected language. No campaign was saved and charged credits were restored. Retry with the same language, or choose English for English output.'
      : 'NEXUS blocked saving because the strategy document did not pass the structural quality contract. No campaign was saved and charged credits were restored. Please retry.'
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

type StrategyCreditPreflightOk = {
  ok: true
  visibleCredits: number
  user: {
    preferences: unknown
    subscriptionStatus: string | null
  }
}

type StrategyCreditPreflightFailure = {
  ok: false
  error: 'INSUFFICIENT_CREDITS'
  message: string
  requiredCredits: number
  currentCredits: number
  upgradeUrl: string
}

async function checkStrategyCreditsAvailable(
  userId: string,
  cost: number,
): Promise<StrategyCreditPreflightOk | StrategyCreditPreflightFailure> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      subscriptionStatus: true,
      aiCredits: true,
      monthlyGenerations: true,
      preferences: true,
    },
  })

  if (!user) {
    return {
      ok: false,
      error: 'INSUFFICIENT_CREDITS',
      message: 'User not found.',
      requiredCredits: cost,
      currentCredits: 0,
      upgradeUrl: '/billing',
    }
  }

  if (user.aiCredits === -1) {
    return {
      ok: true,
      visibleCredits: -1,
      user: { preferences: user.preferences, subscriptionStatus: user.subscriptionStatus },
    }
  }

  const isFree = user.subscriptionStatus === 'FREE'
  const starterGrantAvailable = isFree && user.aiCredits === 0 && user.monthlyGenerations === 0
  const spendableCredits = starterGrantAvailable ? FREE_STARTER_CREDITS : user.aiCredits

  if (spendableCredits < cost) {
    return {
      ok: false,
      error: 'INSUFFICIENT_CREDITS',
      message: isFree
        ? `You've used all your free credits. Upgrade to continue.`
        : 'Monthly credits exhausted. Upgrade your plan or wait for the next billing cycle.',
      requiredCredits: cost,
      currentCredits: spendableCredits,
      upgradeUrl: '/billing',
    }
  }

  return {
    ok: true,
    visibleCredits: user.aiCredits,
    user: { preferences: user.preferences, subscriptionStatus: user.subscriptionStatus },
  }
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
  let lateCreditFailure: StrategyCreditPreflightFailure | null = null
  let preflightVisibleCredits: number | undefined

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
      customOrganicPostCount: body?.customOrganicPostCount,
      customDurationDays: body?.customDurationDays,
      language: body?.language,
    })

    // Unsupported (custom > 180 days, or non-positive) → block BEFORE any
    // deduction. No credits are ever charged for an unsupported order.
    if (!charge.supported || charge.cost == null) {
      const customPostCountError = /custom organic post count/i.test(charge.pricing.pricingExplanation)
      return NextResponse.json(
        {
          error: customPostCountError ? 'UNSUPPORTED_POST_COUNT' : 'UNSUPPORTED_DURATION',
          message: customPostCountError
            ? 'Custom organic post count must be between 1 and 30 for the first detailed window — no credits were charged.'
            : 'Strategies longer than 180 days are not supported yet. Contact support for a custom quote — no credits were charged.',
          supported: false,
        },
        { status: 422 },
      )
    }
    const strategyCreditCost: number = charge.cost

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

    // -- Credit preflight only (no mutation) ---------------------------------
    // Strategy generation can run long enough for provider/platform disconnects.
    // Do not debit credits before AI + deterministic contract guards produce a
    // saveable strategy. The real atomic deduction happens in runFullAgency's
    // beforePersistStrategy callback, immediately before campaign rows are saved.
    const creditPreflight = await checkStrategyCreditsAvailable(user.id, strategyCreditCost)
    if (!creditPreflight.ok) {
      return NextResponse.json(creditPreflight, { status: 402 })
    }
    preflightVisibleCredits = creditPreflight.visibleCredits
    const freshUser = creditPreflight.user
    // ------------------------------------------------------------------------

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
    const safeBrandProfile = getBrandBrainGenerationSafety(brandProfile as any).safeProfile as any
    const order = { ...charge.order, goal: charge.order.goal || safeBrandProfile.businessGoal || goalOverride }
    const postsPerMonth = tierToPostsPerMonth(freshUser?.subscriptionStatus)
    const deliverables = getStrategyDeliverables(
      order,
      typeof postsPerMonth === 'number' ? { postsPerMonth } : undefined,
    )

    // Build brief from Brand Brain data after generation-safety screening.
    const brief = {
      companyName: safeBrandProfile.brandName ?? 'My Brand',
      businessType: safeBrandProfile.industry ?? 'General Business',
      targetAudience: safeBrandProfile.targetAudience ?? 'General audience',
      // Internal numeric compatibility only. The strategist prompt gets the
      // real user-provided budget from Brand Brain readiness context. Missing
      // budget must stay "Not provided" and must never become a default spend.
      monthlyBudget: 0,
      primaryGoal: safeBrandProfile.businessGoal || goalOverride,
      // Extended brand brain fields
      competitors: safeBrandProfile.competitorNotes || undefined,
      region: safeBrandProfile.audienceLocation || undefined,
      uniqueValue: safeBrandProfile.uniqueAdvantages?.length
        ? safeBrandProfile.uniqueAdvantages.join(', ')
        : undefined,
      avoidWords: safeBrandProfile.avoidKeywords?.length
        ? safeBrandProfile.avoidKeywords.join(', ')
        : undefined,
      writingStyle: safeBrandProfile.writingStyle || undefined,
      pricePoint: safeBrandProfile.pricePoint || undefined,
      painPoints: safeBrandProfile.audiencePainPoints?.length
        ? safeBrandProfile.audiencePainPoints.join(', ')
        : undefined,
      desires: safeBrandProfile.audienceDesires?.length
        ? safeBrandProfile.audienceDesires.join(', ')
        : undefined,
      primaryOffer: safeBrandProfile.primaryOffer || undefined,
      currentPlatforms: safeBrandProfile.topPlatforms?.length ? safeBrandProfile.topPlatforms : undefined,
      winningHooks: safeBrandProfile.winningHooks?.length
        ? safeBrandProfile.winningHooks.slice(0, 3).join(' | ')
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
    const result = await runFullAgency(workspace.id, brief, {
      beforePersistStrategy: async () => {
        const credit = await checkAndDeductCredits(user.id, 'RUN_FULL_STRATEGY', strategyCreditCost)
        if (!credit.ok) {
          lateCreditFailure = credit
          throw new Error('STRATEGY_CREDIT_DEDUCTION_FAILED')
        }
        chargedUserId = user.id
        deductedCredit = {
          creditsRemaining: credit.creditsRemaining,
          creditsUsed: credit.creditsUsed,
          transactionId: credit.transactionId,
        }
      },
    })

    // Fetch the newly-created campaign
    const campaign = result.strategyCreated
      ? await (prisma as any).campaign.findFirst({
          where: { workspaceId: workspace.id },
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true },
        })
      : null

    const success = result.strategyCreated && !!campaign?.id
    const finalDeductedCredit = deductedCredit as DeductedStrategyCredit | null

    if (!success && lateCreditFailure) {
      return NextResponse.json(lateCreditFailure, { status: 402 })
    }

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
        ? finalDeductedCredit?.creditsRemaining
        : (finalDeductedCredit
            ? finalDeductedCredit.creditsRemaining + (refunded ? finalDeductedCredit.creditsUsed : 0)
            : preflightVisibleCredits),
      creditsUsed: success ? (finalDeductedCredit?.creditsUsed ?? 0) : (refunded ? 0 : (finalDeductedCredit?.creditsUsed ?? 0)),
      refunded,
      // Both formats for frontend compatibility
      errors: publicErrors,
      error: publicError,
    })
  } catch (err: any) {
    console.error('[api/strategy/run-full]', err)
    if (lateCreditFailure && !deductedCredit) {
      return NextResponse.json(lateCreditFailure, { status: 402 })
    }
    const finalDeductedCredit = deductedCredit as DeductedStrategyCredit | null
    const refunded = chargedUserId
      ? await refundDeductedStrategyCredits(chargedUserId, finalDeductedCredit, 'Run Full Strategy exception')
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
        creditsRemaining: finalDeductedCredit
          ? finalDeductedCredit.creditsRemaining + (refunded ? finalDeductedCredit.creditsUsed : 0)
          : undefined,
        creditsUsed: refunded ? 0 : (finalDeductedCredit?.creditsUsed ?? 0),
      },
      { status: 500 },
    )
  }
}
