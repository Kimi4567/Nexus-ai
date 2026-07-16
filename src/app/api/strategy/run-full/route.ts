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
import {
  buildCreditChargeReceipt,
  checkAndDeductCredits,
  creditCheckHttpStatus,
  finalizeCreditDeduction,
  FREE_STARTER_CREDITS,
  refundCreditDeduction,
  type CreditDeductionOk,
  type CreditOperationReplayError,
} from '@/lib/credits'
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
import { readLockedCampaignAllowance, type CampaignAllowance } from '@/lib/campaignCommercial'
import { getAiProviderUnavailablePayload, isAiProviderConfigured } from '@/lib/ai/provider'
import { reviewBrandTruthConsistency } from '@/lib/ai/marketingQualityGate'
import { enforceBillableAiRateLimit } from '@/lib/billableAiRateLimit'
import { getCreditOperationKey } from '@/lib/creditOperationKey.server'
import { resolveBillingStatusPlan } from '@/lib/billingStatusPlan'
import { captureOperationalError } from '@/lib/observability/operationalError'

// Strategy generation can legitimately need a second contract-repair pass before
// anything is charged or persisted. The old 60s ceiling killed successful runs
// after the contract had passed but before the campaign transaction could start.
// Vercel Fluid Compute supports this duration on every current plan; keep enough
// headroom for the AI call, the atomic credit charge, and the persistence work.
export const maxDuration = 180

function isArabicLanguage(language: unknown): boolean {
  return typeof language === 'string' && language.toLowerCase().startsWith('ar')
}

function sanitizeStrategyRunError(
  error: string | undefined,
  language: unknown,
  strategyType?: 'organic' | 'paid' | 'full',
): string | undefined {
  if (!error) return undefined

  if (/Strategy OS contract/i.test(error)) {
    if (/count:/i.test(error)) {
      const paidPackageCountFailed = /paidPlanning\./i.test(error) || strategyType === 'paid'
      if (paidPackageCountFailed) {
        return isArabicLanguage(language)
          ? 'أوقف NEXUS الحفظ لأن حزمة التخطيط المدفوع لم تُكمل العدد الذي راجعته من فرضيات الجمهور، الزوايا، النسخ الإعلانية، أو البريفات. لم تُحفظ حملة وتمت إعادة الكريديت إن خُصمت.'
          : 'NEXUS blocked saving because the paid-planning package did not complete the reviewed number of audience hypotheses, ad angles, ad-copy variations, or creative briefs. No campaign was saved and charged credits were restored.'
      }
      return isArabicLanguage(language)
        ? 'أوقف NEXUS الحفظ لأن مولّد الاستراتيجية لم يُكمل العدد الذي راجعته من اتجاهات المحتوى والخطة الأسبوعية. لم تُحفظ حملة جديدة وتمت إعادة الكريدت إن خُصمت. أعد المحاولة؛ سيحاول النظام إصلاح العدد تلقائيًا قبل الحفظ.'
        : 'NEXUS blocked saving because the strategy generator did not complete the reviewed number of content directions and weekly deliverables. No campaign was saved and charged credits were restored. Retry; the system will attempt a count repair before saving.'
    }
    if (/paidPlanning\./i.test(error) || strategyType === 'paid') {
      return isArabicLanguage(language)
        ? 'أوقف NEXUS الحفظ لأن حزمة التخطيط المدفوع لم تجتز فحص جودة النسخ أو البريفات. لم تُحفظ حملة وتمت إعادة الكريديت إن خُصمت.'
        : 'NEXUS blocked saving because the paid-planning package did not pass copy or creative-brief quality checks. No campaign was saved and charged credits were restored.'
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

  if (error.startsWith('BRAND_TRUTH_CONFLICT:')) {
    return isArabicLanguage(language)
      ? 'أوقف NEXUS التوليد لأن Brand Brain يحتوي حقائق متعارضة. راجع الحقول المعلّمة في Brand Brain أولاً؛ لم يبدأ التوليد ولم يُخصم أي كريديت.'
      : 'NEXUS stopped generation because Brand Brain contains conflicting facts. Review the flagged Brand Brain fields first; generation did not start and no credits were charged.'
  }

  if (error.startsWith('MARKETING_QUALITY_GATE_BLOCKED:')) {
    return isArabicLanguage(language)
      ? 'رفض NEXUS حفظ الاستراتيجية لأنها خرجت عن حقائق العلامة أو الجمهور أو القنوات التي راجعتها. لم تُحفظ حملة وتمت إعادة الكريديت إن خُصمت.'
      : 'NEXUS refused to save the strategy because it drifted from the reviewed brand, audience, or channel facts. No campaign was saved and charged credits were restored.'
  }

  return error
}

function genericStrategyRunFailureMessage(language: unknown): string {
  if (isArabicLanguage(language)) {
    return 'تعذر إكمال توليد الاستراتيجية قبل حفظ حملة جديدة. تمت إعادة كريدت هذه المحاولة إن تم خصمها. حاول مرة أخرى.'
  }

  return 'Strategy generation could not be completed before a new campaign was saved. Credits for this attempt were restored if they were charged. Please try again.'
}

function campaignLimitPayload(allowance: CampaignAllowance, language: unknown) {
  const resetDate = allowance.periodEnd.toLocaleDateString(
    isArabicLanguage(language) ? 'ar-EG' : 'en-US',
    { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' },
  )
  return {
    error: 'CAMPAIGN_LIMIT_REACHED' as const,
    message: isArabicLanguage(language)
      ? `وصلت إلى حد إنشاء ${allowance.limit} حملة في باقتك خلال دورة الفوترة الحالية. يمكنك إنشاء حملة جديدة بعد ${resetDate} أو ترقية الباقة الآن. لم يبدأ التوليد ولم يُخصم أي كريديت.`
      : `You reached your plan limit of ${allowance.limit} campaign creation${allowance.limit === 1 ? '' : 's'} for the current billing cycle. You can create another campaign after ${resetDate}, or upgrade now. Generation did not start and no credits were charged.`,
    limit: allowance.limit,
    current: allowance.current,
    resetsAt: allowance.periodEnd.toISOString(),
    upgradeUrl: '/billing',
    creditsUsed: 0,
  }
}

function parseCampaignLimitError(error: string | undefined): CampaignAllowance | null {
  if (!error?.startsWith('CAMPAIGN_LIMIT_REACHED:')) return null
  const [, rawLimit, ...resetParts] = error.split(':')
  const periodEnd = new Date(resetParts.join(':'))
  const limit = Number(rawLimit)
  if (!Number.isFinite(limit) || Number.isNaN(periodEnd.getTime())) return null
  return {
    limit,
    current: limit,
    periodStart: new Date(0),
    periodEnd,
    plan: 'UNKNOWN',
  }
}

type DeductedStrategyCredit = CreditDeductionOk

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
  try {
    if (!credit) return false
    const result = await refundCreditDeduction({
      userId,
      action: 'RUN_FULL_STRATEGY',
      deduction: credit,
      reason,
    })
    return result.ok && result.status === 'refunded'
  } catch (refundErr) {
    await captureOperationalError(refundErr, {
      operation: 'credits.full-strategy-refund',
      route: '/api/strategy/run-full',
      component: 'credits',
      method: 'POST',
      statusCode: 500,
      retryable: true,
    })
    return false
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {}
  let chargedUserId: string | null = null
  let deductedCredit: DeductedStrategyCredit | null = null
  let lateCreditFailure: StrategyCreditPreflightFailure | CreditOperationReplayError | null = null
  let preflightVisibleCredits: number | undefined
  let strategyType: 'organic' | 'paid' | 'full' = 'organic'

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
    const requestedGoal = (body?.goal as string | undefined)?.trim()
    const selectedMediaIds = Array.isArray(body?.mediaIds)
      ? (body.mediaIds as unknown[]).filter((id): id is string => typeof id === 'string' && id.length > 0)
      : undefined
    // PR-I — generation-time strategy intent (chosen in the modal; safe defaults).
    const normalizedStrategyIntent = normalizeStrategyIntent(body?.strategyType, body?.strategyDuration)
    strategyType = normalizedStrategyIntent.strategyType
    const { strategyDuration } = normalizedStrategyIntent

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


    // Brand fields may be individually complete while contradicting one another
    // (for example, two different audience age ranges). Block before the model or
    // credit system is touched; completeness is not the same as consistency.
    const brandTruthReview = reviewBrandTruthConsistency(brandProfile as any)
    if (brandTruthReview.status === 'blocked') {
      return NextResponse.json(
        {
          error: 'BRAND_TRUTH_CONFLICT',
          message: sanitizeStrategyRunError(
            `BRAND_TRUTH_CONFLICT:${brandTruthReview.blockers.map(item => item.code).join(',')}`,
            body?.language,
            strategyType,
          ),
          blockers: brandTruthReview.blockers,
          warnings: brandTruthReview.warnings,
          creditsUsed: 0,
          redirectUrl: '/brand',
        },
        { status: 422 },
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

    // Reject an impossible new campaign before the expensive strategist call.
    // The orchestrator repeats this check under the same advisory lock at
    // persistence time, so this fast preflight improves UX without weakening
    // the concurrency-safe commercial boundary.
    const campaignAllowance = await prisma.$transaction((tx) => (
      readLockedCampaignAllowance(tx, user.id)
    ))
    if (campaignAllowance.limit !== 999 && campaignAllowance.current >= campaignAllowance.limit) {
      return NextResponse.json(
        campaignLimitPayload(campaignAllowance, body?.uiLocale || body?.language),
        { status: 403 },
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
    const economicRateLimit = await enforceBillableAiRateLimit(user.id, 'RUN_FULL_STRATEGY')
    if (economicRateLimit) return economicRateLimit
    // ------------------------------------------------------------------------

    // Language detection: body -> user preferences -> fallback 'ar'
    const userPrefs = (freshUser?.preferences as Record<string, string> | null) ?? {}
    const language: string =
      (body?.language as string | undefined) ||
      userPrefs?.language ||
      'ar'

    if (!isAiProviderConfigured()) {
      return NextResponse.json(getAiProviderUnavailablePayload(language), { status: 503 })
    }

    // ── PR-S1c-3 — deterministic deliverables contract → BINDING generation scope ──
    // Reuse the SAME validated order that priced the run (charge.order), enrich its
    // goal, and resolve the plan quota via the SAME helper the modal used
    // (tierToPostsPerMonth) so the post count shown in the review equals the count
    // the generation is told to produce. Counts/scope come from getStrategyDeliverables
    // — never from the AI. (Custom > 180 was already 422-blocked above, so the contract
    // here is always supported; the unsupported branch returns DO-NOT-GENERATE anyway.)
    const safeBrandProfile = getBrandBrainGenerationSafety(brandProfile as any).safeProfile as any
    const goalOverride = requestedGoal
      || safeBrandProfile.campaignObjective
      || safeBrandProfile.businessGoal
      || 'leads'
    const order = { ...charge.order, goal: charge.order.goal || goalOverride }
    const strategySubscription = await prisma.subscription.findUnique({
      where: { userId: user.id },
      select: { plan: true, status: true },
    })
    const strategyPlan = resolveBillingStatusPlan({
      subscriptionPlan: strategySubscription?.plan,
      subscriptionStatus: strategySubscription?.status,
      userSubscriptionStatus: freshUser?.subscriptionStatus,
    }).plan
    const postsPerMonth = tierToPostsPerMonth(strategyPlan)
    const deliverables = getStrategyDeliverables(
      order,
      typeof postsPerMonth === 'number' ? { postsPerMonth } : undefined,
    )
    const requestedOrganicPostCount = order.strategyType !== 'paid'
      ? order.customOrganicPostCount
      : null
    const effectiveOrganicPostCount = deliverables.organicPostCount
    const planCapLedgerNote =
      typeof requestedOrganicPostCount === 'number' &&
      typeof effectiveOrganicPostCount === 'number' &&
      effectiveOrganicPostCount !== requestedOrganicPostCount
        ? `; plan-capped output ${effectiveOrganicPostCount} of ${requestedOrganicPostCount} requested`
        : ''

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
        const credit = await checkAndDeductCredits(
          user.id,
          'RUN_FULL_STRATEGY',
          strategyCreditCost,
          {
            entityId: workspace.id,
            entityType: 'workspace_strategy_run',
            operationKey: getCreditOperationKey(req, 'RUN_FULL_STRATEGY', 'workspace_strategy_run', workspace.id),
            description: `${charge.pricing.pricingExplanation}${planCapLedgerNote} — ${strategyCreditCost} credits`,
          },
        )
        if (!credit.ok) {
          lateCreditFailure = credit
          throw new Error('STRATEGY_CREDIT_DEDUCTION_FAILED')
        }
        chargedUserId = user.id
        deductedCredit = credit
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
      return NextResponse.json(lateCreditFailure, { status: creditCheckHttpStatus(lateCreditFailure) })
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
    const lateCampaignLimit = parseCampaignLimitError(rawError)
    if (lateCampaignLimit) {
      return NextResponse.json({
        ...campaignLimitPayload(lateCampaignLimit, body?.uiLocale || body?.language),
        refunded,
        creditsRemaining: finalDeductedCredit
          ? finalDeductedCredit.creditsRemaining + (refunded ? finalDeductedCredit.creditsUsed : 0)
          : preflightVisibleCredits,
      }, { status: 403 })
    }
    const publicError = sanitizeStrategyRunError(rawError, body?.language, strategyType)
    const publicErrors = result.errors.map(error => sanitizeStrategyRunError(error, body?.language, strategyType) || error)

    if (success && finalDeductedCredit) {
      const finalization = await finalizeCreditDeduction({
        userId: user.id,
        action: 'RUN_FULL_STRATEGY',
        deduction: finalDeductedCredit,
      })
      if (!finalization.ok) {
        deductedCredit = null
        return NextResponse.json({
          ok: false,
          error: 'The strategy was saved but its credit operation could not be finalized. Reserved credits were returned; refresh Strategy Studio.',
          code: 'CREDIT_FINALIZATION_FAILED',
          refunded: finalization.refundStatus === 'refunded',
          campaignId: campaign?.id ?? null,
        }, { status: 503 })
      }
    }

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
      creditCharge: success && finalDeductedCredit
        ? {
            ...buildCreditChargeReceipt('RUN_FULL_STRATEGY', finalDeductedCredit),
            cost: strategyCreditCost,
          }
        : null,
      refunded,
      // Both formats for frontend compatibility
      errors: publicErrors,
      error: publicError,
    }, { status: success ? 200 : 502 })
  } catch (err: unknown) {
    await captureOperationalError(err, {
      operation: 'ai.full-strategy-run',
      route: '/api/strategy/run-full',
      component: 'ai',
      method: 'POST',
      requestId: req.headers?.get?.('x-vercel-id') ?? null,
      statusCode: 500,
      retryable: true,
    })
    if (lateCreditFailure && !deductedCredit) {
      return NextResponse.json(lateCreditFailure, { status: creditCheckHttpStatus(lateCreditFailure) })
    }
    const finalDeductedCredit = deductedCredit as DeductedStrategyCredit | null
    const refunded = chargedUserId
      ? await refundDeductedStrategyCredits(chargedUserId, finalDeductedCredit, 'Run Full Strategy exception')
      : false
    const rawError = err instanceof Error ? err.message : undefined
    const safeError = rawError && (/Strategy OS contract/i.test(rawError)
      || rawError.startsWith('BRAND_TRUTH_CONFLICT:')
      || rawError.startsWith('MARKETING_QUALITY_GATE_BLOCKED:'))
      ? sanitizeStrategyRunError(rawError, body?.language, strategyType) || genericStrategyRunFailureMessage(body?.language)
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
