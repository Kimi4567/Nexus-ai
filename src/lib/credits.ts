/**
 * Nexus AI — Unified Credit System
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all AI credit costs, checks, and deductions.
 * Every AI route must call checkAndDeductCredits() instead of inline logic.
 *
 * To change a cost: edit CREDIT_COSTS below. Nothing else needs touching.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { prisma } from '@/lib/prisma'
import { sendCreditsLowEmail } from '@/lib/email/resend'
import { randomUUID } from 'crypto'
import {
  isCreditWalletEnabled,
  isGrantEligible,
  selectGrantsToSpend,
  planRefundToSource,
  type SpendableGrant,
  type RefundSourceGrant,
  type RefundAllocationInput,
} from '@/lib/credits/wallet'
// B1d-b — create matching CreditGrant rows in parallel with aiCredits writes
// (flag-independent, additive; never changes the scalar balance or read path).
import {
  ensureGrant,
  buildStarterGrant,
  buildBonusGrant,
  STARTER_CREDITS,
} from '@/lib/credits/creditGrants'
import { CURRENT_CREDIT_PRICING_VERSION } from '@/lib/credits/pricing'
import { PUBLIC_PAID_PLANS } from '@/lib/commercialPlans'

// ── Credit cost map ────────────────────────────────────────────────────────────
// All AI actions and their credit costs.
// Keeping this as a plain object (not enum) so it's easy to read and patch.

export const CREDIT_COSTS = {
  /**
   * Campaign generation — legacy full-pipeline generation via /api/generate
   * Routes: /api/generate, /api/generate/preview
   * Model: gpt-4o-mini (via lib/ai/adapter + lib/ai/openai.ts)
   * Input: ~2,000 tokens | Output: ~4,000 tokens
   * API cost: ~$0.003 (gpt-4o-mini @ $0.15/M in, $0.60/M out)
   * Margin is evaluated from the versioned provider meter and the current
   * subscription net-credit floor; do not reuse historical per-credit values.
   */
  CAMPAIGN_GENERATION: 8,

  /**
   * Run Full Strategy — fires the Strategist agent (orchestrator, strategy-only path)
   * Routes: /api/agents/run, /api/strategy/run-full, /api/campaigns/[id]/engine
   * Model: gpt-4o (strategist.ts — Content Director runs separately via CONTENT_PLAN_GENERATION)
   * Measured 2026-07-16 Organic run: 12,298 input + 6,183 output across
   * generation/repair = $0.088735 provider cost. Paid/Full can add one focused
   * Structured Outputs repair; the provider meter records every call.
   * Commercial price is variable (12–96 credits) and includes validation,
   * exact-count repair, persistence, refund risk, and operating margin.
   */
  RUN_FULL_STRATEGY: 12,

  /**
   * Creative Brief — visual direction: asset analysis + concept generation
   * Route: /api/campaigns/[id]/creative-brief (POST)
   * Model: gpt-4o (visual-director.ts — two sequential calls: analyzeAssets + generateVisualConcepts)
   * Input: ~2,000–3,000 tokens | Output: ~900–2,000 tokens per call
   * API cost: ~$0.025–$0.045 (two gpt-4o calls)
   */
  CREATIVE_BRIEF: 5,

  /**
   * Sentinel Review — AI quality + risk + Brand Voice gate for a campaign
   * Route: /api/campaigns/[id]/sentinel-review (POST)
   * Model: gpt-4o (sentinel-reviewer.ts — NOT gpt-4o-mini; uses full reasoning capability)
   * Input: ~2,000–3,000 tokens | Output: ~2,000 tokens (max_tokens: 2000)
   * API cost: ~$0.025 (gpt-4o @ $2.50/M in, $10/M out)
   */
  SENTINEL_REVIEW: 3,

  /**
   * Image generation — gpt-image-1 at high quality (platform-native sizing)
   * Routes: /api/visuals/generate, /api/campaigns/[id]/generate-content-plan/generate
   * Model: gpt-image-1, quality: 'high' (upgraded from DALL-E 3 in Sprint IQ)
   * Sizes: 1024×1024 (square), 1024×1536 (portrait), 1536×1024 (landscape — default)
   * July 2026 planning reserve: up to $0.25 image-output cost for high-quality
   * 1536×1024 on the configured model, plus prompt/image-input tokens. The
   * commercial price includes retry, storage, moderation, and support reserve.
   * Fallback: fal.ai Flux 1.1 Pro Ultra when FAL_KEY is set (~$0.06/image)
   */
  IMAGE_GENERATION: 4,

  /**
   * Professional video-ad master — either a ten-second, three-shot campaign
   * film (about $1.30 provider cost) or an eight-second, multi-reference
   * product-ad recipe (about $3.44), before durable storage, visual QA,
   * moderation, and failure reserve. Eighteen NEXUS credits preserves a
   * positive expected margin while funding one provider attempt only.
   */
  VIDEO_GENERATION: 18,

  /**
   * Source-locked motion design — turns one analysed user-owned screen/demo
   * clip into a six-second bumper master. The route uses deterministic
   * packaged FFmpeg edit plus one bounded visual QA call; it never calls a
   * generative-video provider and never performs an automatic retry.
   */
  MOTION_DESIGN_VIDEO: 6,

  /**
   * Ad copy generation — gpt-4o-mini ad concepts and copy variants
   * Routes: /api/campaigns/suggest, /api/brand/suggest, /api/ai/generate,
   *         /api/ad-campaigns/[id]/generate-strategy, /api/ad-campaigns/[id]/generate-copy,
   *         /api/campaigns/[id]/paid-pack/learn
   * Model: gpt-4o-mini (paid-campaign and ad-copy generation routes)
   * Input: ~800 tokens | Output: ~1,500 tokens
   * API cost: ~$0.001 (gpt-4o-mini @ $0.15/M in, $0.60/M out)
   */
  AD_COPY: 3,

  /**
   * Small field suggestion — one short gpt-4o-mini response used while filling
   * Brand Brain or campaign intake. Kept separate from a five-variant ad-copy
   * package so the visible price matches the actual work.
   */
  AI_FIELD_SUGGESTION: 1,

  /**
   * Paid execution plan — translates an approved Paid/Full strategy into one
   * platform-specific targeting, budget-allocation, creative, and tracking
   * package. This is distinct from ad-copy drafting and uses the full model.
   */
  PAID_EXECUTION_PLAN: 6,

  /**
   * Chat message — streaming assistant with campaign/brand context injection
   * Route: /api/chat
   * Model: gpt-4o-mini (context-aware; cost grows with conversation history length)
   * Estimated cost: ~$0.001–$0.005 (early msg vs long conversation history)
   */
  CHAT_MESSAGE: 1,

  /**
   * AI Post Rewrite — rewrites a single content hub post with style variation
   * Route: /api/campaigns/[id]/content-plan/[postId]/rewrite
   * Model: gpt-4o, one bounded call, max_tokens: 600.
   * Provider prices are monitored separately; one credit is a commercial unit,
   * not a promise that one credit equals a fixed number of provider tokens.
   */
  AI_POST_REWRITE: 2,

  /**
   * Content plan generation — gpt-4o writes all post captions + scheduling for a full month
   * Route: /api/campaigns/[id]/generate-content-plan
   * Model: gpt-4o (content-director.ts — NOT gpt-4o-mini)
   * Output tokens scale with plan quota (postsPerMonth × 150 + 800, capped at 8,000):
   *   Starter (10 posts): ~2,500 out → cost ~$0.033
   *   Growth  (16 posts): ~3,200 out → cost monitored from provider usage
   *   Autopilot (40 posts): ~6,800 out → cost monitored from provider usage
   * Commercial price includes one bounded full-model call, persistence,
   * validation, and automatic refund when no usable output is created.
   */
  CONTENT_PLAN_GENERATION: 6,

  /**
   * A/B caption variants — one additional bounded model call for the reviewed
   * content-plan slots. Kept separate from base planning so the user never pays
   * for experiments they did not request and the product never hides extra COGS.
   */
  CONTENT_AB_VARIANTS: 3,

  /**
   * Paid campaign pack — gpt-4o writes audience targeting, copy variants, budget plan
   * Route: /api/campaigns/[id]/paid-pack/generate
   * Model: gpt-4o (max_tokens: ~4,000)
   * Input: ~2,500 tokens | Output: ~4,000 tokens
   * API cost: ~$0.046–$0.050 (gpt-4o @ $2.50/M in, $10/M out)
   */
  PAID_PACK_GENERATE: 10,

  /**
   * Website Intelligence Scanner — fetches + parses brand website, gpt-4o extracts brand DNA
   * Route: /api/brand/scan-website
   * Model: gpt-4o (deep extraction + structured Brand Brain update)
   * Input: ~3,000 tokens (fetched page text) | Output: ~5,000 tokens
   * API cost: ~$0.055–$0.065 (gpt-4o @ $2.50/M in, $10/M out)
   */
  WEBSITE_SCAN: 4,

  /**
   * Content Samples Analyzer — gpt-4o extracts hooks, angles, and tone from pasted samples
   * Route: /api/brand/analyze-content
   * Model: gpt-4o (structured extraction → Brand Brain update)
   * Input: ~2,000 tokens (samples) | Output: ~2,000 tokens
   * API cost: ~$0.025 (gpt-4o @ $2.50/M in, $10/M out)
   */
  CONTENT_ANALYSIS: 3,

  /**
   * Creative media intelligence — one bounded visual-evidence pass over up to
   * eight uploaded campaign assets, followed by post-to-asset matching. The
   * result is advisory only: it never attaches, approves, schedules, or
   * publishes media. Audio transcription is explicitly outside this action.
   */
  MEDIA_INTELLIGENCE_ANALYSIS: 3,

  /**
   * Brand evidence analysis — extracts source-backed claims from one private
   * document. Upload and human review are free; only this bounded model call is
   * billable. Claims remain candidates until the user explicitly approves them.
   */
  BRAND_EVIDENCE_ANALYSIS: 3,

} as const

export type CreditAction = keyof typeof CREDIT_COSTS

export interface CreditActionPolicy {
  label: string
  reason: string
  includedWork: string
  /** Maximum billable provider calls included in one action execution. */
  providerCallLimit: number
  refundableOnNoUsableOutput: boolean
}

/**
 * Product/economic contract shown in confirmations and credit history. Costs
 * remain in CREDIT_COSTS; this describes exactly why a debit exists and bounds
 * hidden provider work behind a single user action.
 */
export const CREDIT_ACTION_POLICIES: Record<CreditAction, CreditActionPolicy> = {
  CAMPAIGN_GENERATION: {
    label: 'Campaign generation',
    reason: 'Creates a reviewable campaign package from the approved brief.',
    includedWork: 'One bounded campaign generation run.',
    providerCallLimit: 2,
    refundableOnNoUsableOutput: true,
  },
  RUN_FULL_STRATEGY: {
    label: 'Full marketing strategy',
    reason: 'Creates the strategy, operating plan, and measurable execution brief.',
    includedWork: 'Strategy generation, one document repair when required, and one focused paid-package repair when required.',
    providerCallLimit: 3,
    refundableOnNoUsableOutput: true,
  },
  CREATIVE_BRIEF: {
    label: 'Creative brief',
    reason: 'Turns the approved strategy into a reviewable visual direction.',
    includedWork: 'Asset analysis and visual concept direction.',
    providerCallLimit: 2,
    refundableOnNoUsableOutput: true,
  },
  SENTINEL_REVIEW: {
    label: 'Sentinel quality review',
    reason: 'Reviews a strategy for brand consistency, claims, risk, and execution gaps.',
    includedWork: 'One AI review after the free deterministic gate passes.',
    providerCallLimit: 1,
    refundableOnNoUsableOutput: true,
  },
  IMAGE_GENERATION: {
    label: 'Image generation',
    reason: 'Creates one reviewable campaign image for a specific post.',
    includedWork: 'One image result with one configured fallback provider attempt.',
    providerCallLimit: 2,
    refundableOnNoUsableOutput: true,
  },
  VIDEO_GENERATION: {
    label: 'Professional video ad',
    reason: 'Creates one review-only campaign film or product-fidelity ad with a documented production route.',
    includedWork: 'Route-specific preflight, one NEXUS production task, durable storage, multi-frame quality review, branded finishing, and safe draft attachment. No automatic provider retry, publishing, or scheduling.',
    providerCallLimit: 1,
    refundableOnNoUsableOutput: true,
  },
  MOTION_DESIGN_VIDEO: {
    label: 'Source-locked motion design ad',
    reason: 'Turns one approved user-owned screen or demo clip into a platform-ready advertising master without generative-video spend.',
    includedWork: 'Source preflight, one deterministic six-second motion-design bumper, durable storage, five-frame quality review, and safe draft attachment. No generative-video provider, automatic retry, publishing, or scheduling.',
    providerCallLimit: 2,
    refundableOnNoUsableOutput: true,
  },
  AD_COPY: {
    label: 'Ad copy generation',
    reason: 'Creates a reviewable paid-ad copy package.',
    includedWork: 'One bounded ad-copy generation run.',
    providerCallLimit: 1,
    refundableOnNoUsableOutput: true,
  },
  AI_FIELD_SUGGESTION: {
    label: 'AI field suggestion',
    reason: 'Creates one reviewable suggestion for the selected form field.',
    includedWork: 'One short suggestion call; saving it still requires user confirmation.',
    providerCallLimit: 1,
    refundableOnNoUsableOutput: true,
  },
  PAID_EXECUTION_PLAN: {
    label: 'Paid execution plan',
    reason: 'Translates an approved strategy into one reviewable platform execution package without launching spend.',
    includedWork: 'One bounded paid-media planning call; ad-copy variants and platform launch are excluded.',
    providerCallLimit: 1,
    refundableOnNoUsableOutput: true,
  },
  CHAT_MESSAGE: {
    label: 'AI assistant message',
    reason: 'Generates one context-aware assistant response.',
    includedWork: 'One assistant response.',
    providerCallLimit: 1,
    refundableOnNoUsableOutput: true,
  },
  AI_POST_REWRITE: {
    label: 'Post rewrite',
    reason: 'Rewrites one selected post under the current brand and strategy rules.',
    includedWork: 'One post rewrite.',
    providerCallLimit: 1,
    refundableOnNoUsableOutput: true,
  },
  CONTENT_PLAN_GENERATION: {
    label: 'Draft content plan',
    reason: 'Converts the approved strategy into reviewable platform-native post drafts.',
    includedWork: 'One bounded content-plan generation call; images and A/B variants are excluded.',
    providerCallLimit: 1,
    refundableOnNoUsableOutput: true,
  },
  CONTENT_AB_VARIANTS: {
    label: 'A/B caption variants',
    reason: 'Creates an optional second hook variant for eligible content-plan posts.',
    includedWork: 'One bounded A/B caption generation call; no image generation.',
    providerCallLimit: 1,
    refundableOnNoUsableOutput: true,
  },
  PAID_PACK_GENERATE: {
    label: 'Paid campaign pack',
    reason: 'Creates a reviewable paid-media plan without launching or spending.',
    includedWork: 'One bounded paid campaign planning run.',
    providerCallLimit: 1,
    refundableOnNoUsableOutput: true,
  },
  WEBSITE_SCAN: {
    label: 'Website intelligence scan',
    reason: 'Extracts candidate brand facts from a user-supplied website for review.',
    includedWork: 'One website extraction and one bounded AI analysis.',
    providerCallLimit: 1,
    refundableOnNoUsableOutput: true,
  },
  CONTENT_ANALYSIS: {
    label: 'Content sample analysis',
    reason: 'Extracts candidate tone, hooks, and angles from supplied content samples.',
    includedWork: 'One bounded content analysis.',
    providerCallLimit: 1,
    refundableOnNoUsableOutput: true,
  },
  MEDIA_INTELLIGENCE_ANALYSIS: {
    label: 'Creative media intelligence',
    reason: 'Analyzes visible evidence in uploaded assets and ranks honest matches for campaign posts.',
    includedWork: 'One bounded NEXUS visual-analysis pass for up to eight assets plus deterministic post matching. No attachment, generation, approval, scheduling, or publishing.',
    providerCallLimit: 1,
    refundableOnNoUsableOutput: true,
  },
  BRAND_EVIDENCE_ANALYSIS: {
    label: 'Brand evidence analysis',
    reason: 'Extracts source-backed claim candidates from one private brand document for review.',
    includedWork: 'Deterministic document extraction and one bounded AI evidence analysis.',
    providerCallLimit: 1,
    refundableOnNoUsableOutput: true,
  },
}

export function getCreditActionPolicy(action: CreditAction): CreditActionPolicy & { action: CreditAction; cost: number; pricingVersion: string } {
  return {
    action,
    cost: CREDIT_COSTS[action],
    pricingVersion: CURRENT_CREDIT_PRICING_VERSION,
    ...CREDIT_ACTION_POLICIES[action],
  }
}

function debitDescription(action: CreditAction): string {
  const policy = CREDIT_ACTION_POLICIES[action]
  return `${policy.label} — ${policy.reason}`
}

// ── Free plan starter credits ──────────────────────────────────────────────────
// Granted on first AI action to brand-new FREE accounts.
// 15 credits = one bounded activation journey: Organic Light logic / 30 days
// (12), capped to three strategy directions by the Trial post allowance, plus a
// quality review (3). Content production starts after upgrade/top-up.
// Larger confirmed strategy orders are quoted before any reservation.
// Adjust here to change the free tier without touching any route.

export const FREE_STARTER_CREDITS = STARTER_CREDITS

// ── Monthly credit totals per plan ─────────────────────────────────────────────
// Used by the dashboard credit progress bar.
// Must stay in sync with PLAN_CREDITS in src/lib/stripe.ts.
// Free=15 (one-time), Starter=50/mo legacy, Growth(PRO)=60/mo,
// Autopilot(BUSINESS)=180/mo.

export const PLANS_CREDITS: Record<string, number> = {
  FREE:      FREE_STARTER_CREDITS, // 15 (one-time, never refreshes)
  STARTER:   50,
  PRO:       PUBLIC_PAID_PLANS[0].monthlyCredits,   // Growth plan
  GROWTH:    PUBLIC_PAID_PLANS[0].monthlyCredits,   // alias
  BUSINESS:  PUBLIC_PAID_PLANS[1].monthlyCredits,  // Autopilot plan
  AGENCY:    PUBLIC_PAID_PLANS[1].monthlyCredits,  // alias
  // Stripe subscription status aliases (subscriptionStatus field values)
  ACTIVE:    PUBLIC_PAID_PLANS[0].monthlyCredits,   // Stripe active = Growth tier
}

// ── Daily image-generation caps per plan ──────────────────────────────────────
// Secondary guard on top of credits: even with credits available, cap how many
// images a workspace can generate per calendar day to prevent cost runaway /
// abuse (image generation is the only action that costs real $ at scale).
// Free is deliberately tight; paid tiers scale up. -1 = uncapped.

export const DAILY_IMAGE_CAPS: Record<string, number> = {
  FREE:      1,
  STARTER:   20,
  PRO:       12,   // Growth
  GROWTH:    12,
  BUSINESS:  30,   // Autopilot
  AGENCY:    30,
  ACTIVE:    12,   // Stripe active = Growth tier
}

// ── Low-credits warning threshold ─────────────────────────────────────────────
// Fire the "credits low" email when balance falls below this after a deduction.
// 4 = less than 1 CAMPAIGN_GENERATION remaining.

const LOW_CREDITS_THRESHOLD = 4

// ── Result types ───────────────────────────────────────────────────────────────

export interface CreditDeductionOk {
  ok: true
  creditsRemaining: number
  /** How many credits were deducted for this action (0 for unlimited users) */
  creditsUsed: number
  /** true for paid plans that have aiCredits = -1 (unlimited) */
  isUnlimited: boolean
  /**
   * The CreditTransaction id for this debit. Both wallet and scalar deduction
   * paths persist the debit atomically and return its id, allowing idempotent,
   * exact refunds. Optional only for unlimited plans and legacy test doubles.
   */
  transactionId?: string
  operationStatus?: 'RESERVED'
}

export interface InsufficientCreditsError {
  ok: false
  error: 'INSUFFICIENT_CREDITS'
  message: string
  requiredCredits: number
  currentCredits: number
  upgradeUrl: string
}

export interface CreditOperationReplayError {
  ok: false
  error: 'CREDIT_OPERATION_REPLAY'
  message: string
  transactionId: string
  operationStatus: 'RESERVED' | 'SETTLED' | 'REFUNDED'
  entityId: string | null
  entityType: string | null
}

export type CreditCheckResult = CreditDeductionOk | InsufficientCreditsError | CreditOperationReplayError

export interface CreditChargeReceipt extends ReturnType<typeof getCreditActionPolicy> {
  creditsUsed: number
  creditsRemaining: number
  isUnlimited: boolean
  transactionId: string | null
  operationStatus: 'SETTLED'
}

export interface CreditChargeContext {
  entityId: string
  entityType: string
  operationKey?: string
  /** Exact user-visible scope for variable-price operations. */
  description?: string
}

export interface CreditProviderEconomics {
  /** Internal variable provider cost; never presented as the customer price. */
  providerCostUsd: number
  /** Immutable provider-rate catalog or estimate identifier. */
  providerPricingVersion: string
  /** Sanitized components needed to reproduce the estimate. */
  providerUsage?: object
}

function normalizeProviderEconomics(value: CreditProviderEconomics | null | undefined) {
  const providerCostUsd = Number(value?.providerCostUsd)
  const providerPricingVersion = value?.providerPricingVersion?.trim()
  return Number.isFinite(providerCostUsd)
    && providerCostUsd >= 0
    && Boolean(providerPricingVersion)
    ? {
        providerCostUsd: Number(providerCostUsd.toFixed(6)),
        providerPricingVersion: providerPricingVersion!,
        providerUsage: value?.providerUsage ?? undefined,
      }
    : null
}

export type CreditSettlementResult =
  | { ok: true; status: 'settled' | 'already_settled' | 'noop' }
  | { ok: false; status: 'failed'; error: string }

export type CreditFinalizationResult =
  | { ok: true; status: 'settled' | 'already_settled' | 'noop' }
  | {
      ok: false
      status: 'failed'
      error: string
      refundStatus: CreditRefundResult['status']
    }

export type CreditRefundResult =
  | { ok: true; status: 'refunded' | 'noop' }
  | { ok: false; status: 'failed'; error: string }

/**
 * Canonical, user-displayable receipt for every successful AI charge. Routes
 * should return this object so the UI can explain the cost and its purpose
 * without maintaining a second pricing/reason table.
 */
export function buildCreditChargeReceipt(
  action: CreditAction,
  deduction: CreditDeductionOk,
): CreditChargeReceipt {
  return {
    ...getCreditActionPolicy(action),
    creditsUsed: deduction.creditsUsed,
    creditsRemaining: deduction.creditsRemaining,
    isUnlimited: deduction.isUnlimited,
    transactionId: deduction.transactionId || null,
    operationStatus: 'SETTLED',
  }
}

export function creditCheckHttpStatus(result: Exclude<CreditCheckResult, CreditDeductionOk>): 402 | 409 {
  return result.error === 'CREDIT_OPERATION_REPLAY' ? 409 : 402
}

async function findCreditOperationReplay(
  userId: string,
  operationKey: string,
): Promise<CreditOperationReplayError | null> {
  const existing = await (prisma as any).creditTransaction.findUnique({
    where: { userId_operationKey: { userId, operationKey } },
    select: { id: true, status: true, entityId: true, entityType: true },
  })
  if (!existing) return null
  const operationStatus = ['RESERVED', 'SETTLED', 'REFUNDED'].includes(existing.status)
    ? existing.status as CreditOperationReplayError['operationStatus']
    : 'SETTLED'
  return {
    ok: false,
    error: 'CREDIT_OPERATION_REPLAY',
    message: operationStatus === 'RESERVED'
      ? 'This AI operation is already in progress. No additional credits were reserved.'
      : 'This AI operation was already processed. Refresh the linked output; no additional credits were charged.',
    transactionId: existing.id,
    operationStatus,
    entityId: existing.entityId ?? null,
    entityType: existing.entityType ?? null,
  }
}

function isOperationKeyConflict(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { code?: string }).code === 'P2002'
}

// ── Core helper ────────────────────────────────────────────────────────────────

/**
 * Check if a user can afford `action`, deduct the credits, and track usage.
 *
 * Usage in an API route:
 *
 *   const credit = await checkAndDeductCredits(userId, 'CAMPAIGN_GENERATION')
 *   if (!credit.ok) return NextResponse.json(credit, { status: 402 })
 *   // ... proceed with AI work ...
 *   return NextResponse.json({ ..., creditsRemaining: credit.creditsRemaining })
 *
 * Variable pricing (PR-S1c-2): pass `costOverride` to charge a server-computed
 * amount instead of the fixed CREDIT_COSTS[action]. The override MUST be derived
 * from validated server-side input (never a client-supplied price). `action`
 * still drives the transaction-log label. When the override is omitted or
 * invalid (non-finite / negative), the fixed action cost is used — so every
 * existing caller keeps its current behavior unchanged. The returned
 * `creditsUsed` reflects the amount ACTUALLY deducted, so refund-on-failure via
 * `credit.creditsUsed` stays exact for variable charges.
 */
export async function checkAndDeductCredits(
  userId: string,
  action: CreditAction,
  costOverride?: number,
  context?: CreditChargeContext,
): Promise<CreditCheckResult> {
  const hasValidOverride =
    typeof costOverride === 'number' && Number.isFinite(costOverride) && costOverride >= 0
  const cost = hasValidOverride ? Math.floor(costOverride) : CREDIT_COSTS[action]
  const operationKey = context?.operationKey?.trim() || null

  if (operationKey) {
    const replay = await findCreditOperationReplay(userId, operationKey)
    if (replay) return replay
  }

  // ── Fetch user ─────────────────────────────────────────────────────────────
  let user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      subscriptionStatus: true,
      aiCredits: true,
      monthlyGenerations: true,
      email: true,
      name: true,
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

  // ── Unlimited users (paid plans with sentinel value -1) ────────────────────
  const isUnlimited = user.aiCredits === -1
  if (isUnlimited) {
    try {
      const transaction = await (prisma as any).creditTransaction.create({
        data: {
          userId,
          action,
          description: context?.description || debitDescription(action),
          amount: 0,
          creditCost: cost,
          status: 'RESERVED',
          operationKey,
          reservedAt: new Date(),
          entityId: context?.entityId ?? null,
          entityType: context?.entityType ?? null,
          pricingVersion: CURRENT_CREDIT_PRICING_VERSION,
        },
        select: { id: true },
      })
      return {
        ok: true,
        creditsRemaining: -1,
        creditsUsed: 0,
        isUnlimited: true,
        transactionId: transaction.id,
        operationStatus: 'RESERVED',
      }
    } catch (error) {
      if (operationKey && isOperationKeyConflict(error)) {
        const replay = await findCreditOperationReplay(userId, operationKey)
        if (replay) return replay
      }
      throw error
    }
  }

  // ── First-time FREE user: grant starter credits ────────────────────────────
  const isFree = user.subscriptionStatus === 'FREE'
  if (isFree && user.aiCredits === 0 && user.monthlyGenerations === 0) {
    // B1d-b: grant the starter credits AND create a matching TRIAL grant in ONE
    // transaction. The aiCredits result is identical to before (FREE_STARTER_CREDITS);
    // the grant is idempotent (source 'starter:initial') and never read while the
    // wallet flag is OFF.
    user = (await (prisma as any).$transaction(async (tx: any) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { aiCredits: FREE_STARTER_CREDITS },
        select: {
          id: true,
          subscriptionStatus: true,
          aiCredits: true,
          monthlyGenerations: true,
          email: true,
          name: true,
        },
      })
      await ensureGrant(buildStarterGrant(userId), tx)
      return updated
    })) as NonNullable<typeof user>
  }

  const currentCredits = user.aiCredits

  // ── Deduction path selection (B1c-b) ───────────────────────────────────────
  // Default (flag unset/false) = legacy scalar User.aiCredits path, byte-identical
  // to before. Flag ON = grant-based deduction from the CreditGrant ledger, with
  // User.aiCredits maintained as a cache so the rest of the app is unaffected.
  try {
    if (isCreditWalletEnabled()) {
      return await _deductFromGrants(userId, action, cost, currentCredits, isFree, user.email, user.name, context)
    }
    return await _deductScalar(userId, action, cost, currentCredits, isFree, user.email, user.name, context)
  } catch (error) {
    if (operationKey && isOperationKeyConflict(error)) {
      const replay = await findCreditOperationReplay(userId, operationKey)
      if (replay) return replay
    }
    throw error
  }
}

// ── Internal: insufficient-credits result (shared by both deduction paths) ────

function _insufficient(
  cost: number,
  currentCredits: number,
  isFree: boolean,
): InsufficientCreditsError {
  return {
    ok: false,
    error: 'INSUFFICIENT_CREDITS',
    message: isFree
      ? `You've used all your free credits. Upgrade to continue.`
      : 'Monthly credits exhausted. Upgrade your plan or wait for the next billing cycle.',
    requiredCredits: cost,
    currentCredits,
    upgradeUrl: '/billing',
  }
}

// ── Internal: legacy scalar deduction (default path — flag OFF) ───────────────
// Behaviour-preserving extraction of the original deduction logic. No change to
// the atomic race guard, usage tracking, transaction log, or low-credits email.

async function _deductScalar(
  userId: string,
  action: CreditAction,
  cost: number,
  currentCredits: number,
  isFree: boolean,
  email: string | null,
  name: string | null,
  context?: CreditChargeContext,
): Promise<CreditCheckResult> {
  // ── Insufficient credits ───────────────────────────────────────────────────
  if (currentCredits < cost) {
    return _insufficient(cost, currentCredits, isFree)
  }

  // ── Atomic deduction ──────────────────────────────────────────────────────
  // Use updateMany with a conditional WHERE to avoid race conditions.
  // Postgres executes the WHERE check and UPDATE in a single statement —
  // if two requests arrive simultaneously, only one will see count === 1.
  const outcome = await prisma.$transaction(async (tx) => {
    const deducted = await tx.user.updateMany({
      where: { id: userId, aiCredits: { gte: cost } },
      data: {
        aiCredits: { decrement: cost },
      },
    })
    if (deducted.count === 0) return { ok: false as const }

    const transaction = await tx.creditTransaction.create({
      data: {
        userId,
        action,
        description: context?.description || debitDescription(action),
        amount: -cost,
        creditCost: cost,
        status: 'RESERVED',
        operationKey: context?.operationKey ?? null,
        reservedAt: new Date(),
        entityId: context?.entityId ?? null,
        entityType: context?.entityType ?? null,
        pricingVersion: CURRENT_CREDIT_PRICING_VERSION,
      },
      select: { id: true },
    })
    return { ok: true as const, transactionId: transaction.id }
  })

  if (!outcome.ok) {
    // Lost the race — credits were already consumed by a concurrent request
    return _insufficient(cost, currentCredits, isFree)
  }

  const newCredits = Math.max(0, currentCredits - cost)

  return {
    ok: true,
    creditsRemaining: newCredits,
    creditsUsed: cost,
    isUnlimited: false,
    transactionId: outcome.transactionId,
    operationStatus: 'RESERVED',
  }
}

// ── Internal: grant-based deduction (B1c-b — flag ON only) ────────────────────
// Spends from CreditGrant rows in soonest-expiry-first order, maintaining
// User.aiCredits as an exact cache. All ledger writes happen in ONE interactive
// transaction with SELECT ... FOR UPDATE row locks, so concurrent requests can't
// double-spend a grant and an insufficient balance produces ZERO writes.

async function _deductFromGrants(
  userId: string,
  action: CreditAction,
  cost: number,
  currentCredits: number,
  isFree: boolean,
  email: string | null,
  name: string | null,
  context?: CreditChargeContext,
): Promise<CreditCheckResult> {
  // Run the whole spend as one atomic transaction. A thrown DB error rolls the
  // transaction back (no partial writes) and propagates — exactly like the
  // scalar path's awaited updateMany. `prisma as any` keeps this independent of
  // the generated client types (matching the rest of this file's ledger calls).
  const outcome:
    | { ok: true; newCredits: number; transactionId: string }
    | { ok: false; availableCredits: number } =
    await (prisma as any).$transaction(async (tx: any) => {
      const now = new Date()

      // Lock this user's eligible grants for the duration of the transaction so
      // a concurrent debit can't draw from the same remaining balance.
      const rows: SpendableGrant[] = await tx.$queryRawUnsafe(
        `SELECT "id", "type", "remaining", "expiresAt", "status", "createdAt"
           FROM "CreditGrant"
          WHERE "userId" = $1
            AND "status" = 'ACTIVE'
            AND "remaining" > 0
            AND ("expiresAt" IS NULL OR "expiresAt" > now())
          FOR UPDATE`,
        userId,
      )

      const plan = selectGrantsToSpend(rows, cost, now)
      if (!plan.ok) {
        // Expired grants can make the scalar cache stale. Repair that cache even
        // on an insufficient attempt so every subsequent surface shows truth.
        if (currentCredits !== plan.eligibleRemaining) {
          await tx.user.update({
            where: { id: userId },
            data: { aiCredits: plan.eligibleRemaining },
          })
        }
        return { ok: false as const, availableCredits: plan.eligibleRemaining }
      }

      const availableBefore = rows
        .filter((grant) => isGrantEligible(grant, now))
        .reduce((sum, grant) => sum + Math.max(0, grant.remaining), 0)
      const newCredits = Math.max(0, availableBefore - cost)

      // Decrement each drawn grant by its slice.
      for (const a of plan.allocations) {
        await tx.creditGrant.update({
          where: { id: a.grantId },
          data: { remaining: { decrement: a.amount } },
        })
      }

      // Set (not decrement) the cache from the locked grant truth. This also
      // removes any expired-credit drift discovered during this transaction.
      await tx.user.update({
        where: { id: userId },
        data: {
          aiCredits: newCredits,
        },
      })

      // The debit ledger row (same shape/label as the scalar path's _logTransaction).
      const txn = await tx.creditTransaction.create({
        data: {
          userId,
          action,
          description: context?.description || debitDescription(action),
          amount: -cost,
          creditCost: cost,
          status: 'RESERVED',
          operationKey: context?.operationKey ?? null,
          reservedAt: new Date(),
          entityId: context?.entityId ?? null,
          entityType: context?.entityType ?? null,
          pricingVersion: CURRENT_CREDIT_PRICING_VERSION,
        },
      })

      // Per-grant allocation rows linking this debit to the grants it drew from.
      if (plan.allocations.length > 0) {
        await tx.creditTransactionGrantAllocation.createMany({
          data: plan.allocations.map((a) => ({
            creditTransactionId: txn.id,
            creditGrantId: a.grantId,
            amount: a.amount,
          })),
        })
      }

      return { ok: true as const, newCredits, transactionId: txn.id }
    })

  if (!outcome.ok) {
    return _insufficient(cost, outcome.availableCredits, isFree)
  }

  return {
    ok: true,
    creditsRemaining: outcome.newCredits,
    creditsUsed: cost,
    isUnlimited: false,
    transactionId: outcome.transactionId,
    operationStatus: 'RESERVED',
  }
}

/**
 * Converts a held credit debit into a final charge only after the route has a
 * usable output. The ledger row is locked so duplicate success callbacks can
 * never increment usage twice.
 */
export async function settleCreditDeduction(args: {
  userId: string
  action: CreditAction
  deduction: CreditDeductionOk | null | undefined
  settlementEntityId?: string
  settlementEntityType?: string
  providerEconomics?: CreditProviderEconomics
}): Promise<CreditSettlementResult> {
  const { userId, action, deduction, settlementEntityId, settlementEntityType } = args
  const providerEconomics = normalizeProviderEconomics(args.providerEconomics)
  if (!deduction?.transactionId) {
    return deduction && deduction.creditsUsed > 0
      ? { ok: false, status: 'failed', error: 'credit_reservation_transaction_missing' }
      : { ok: true, status: 'noop' }
  }

  try {
    const outcome = await (prisma as any).$transaction(async (tx: any) => {
      const rows: Array<{
        id: string
        userId: string
        action: string
        status: string
        creditCost: number
      }> = await tx.$queryRawUnsafe(
        `SELECT "id", "userId", "action", "status", "creditCost"
           FROM "CreditTransaction"
          WHERE "id" = $1
          FOR UPDATE`,
        deduction.transactionId,
      )
      const transaction = rows[0]
      if (!transaction || transaction.userId !== userId || transaction.action !== action) {
        throw new Error('credit_reservation_not_found')
      }
      if (transaction.status === 'REFUNDED') throw new Error('credit_reservation_already_refunded')
      if (transaction.status === 'SETTLED') {
        return { status: 'already_settled' as const, creditCost: transaction.creditCost, user: null }
      }
      if (transaction.status !== 'RESERVED') throw new Error('invalid_credit_reservation_status')

      const now = new Date()
      await tx.creditTransaction.update({
        where: { id: transaction.id },
        data: {
          status: 'SETTLED',
          settledAt: now,
          ...(settlementEntityId && settlementEntityType
            ? { entityId: settlementEntityId, entityType: settlementEntityType }
            : {}),
          ...(providerEconomics ?? {}),
        },
      })
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { monthlyGenerations: { increment: 1 } },
        select: { aiCredits: true, email: true, name: true },
      })
      return { status: 'settled' as const, creditCost: transaction.creditCost, user: updatedUser }
    })

    if (outcome.status === 'settled') {
      await _trackUsage(userId, outcome.creditCost)
      const user = outcome.user
      if (user && user.aiCredits !== -1 && user.aiCredits < LOW_CREDITS_THRESHOLD && user.email) {
        sendCreditsLowEmail(
          user.email,
          user.name || user.email.split('@')[0],
          user.aiCredits,
        ).catch((error: Error) => console.error('[Credits low email]', error.message))
      }
    }
    return { ok: true, status: outcome.status }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'credit_settlement_failed'
    console.error('[settleCreditDeduction] failed:', message)
    return { ok: false, status: 'failed', error: message }
  }
}

/**
 * Finalizes a successful AI operation. A settlement failure never leaks a held
 * wallet debit: the reservation is returned to its exact source before the
 * route reports that finalization failed.
 */
export async function finalizeCreditDeduction(args: {
  userId: string
  action: CreditAction
  deduction: CreditDeductionOk | null | undefined
  settlementEntityId?: string
  settlementEntityType?: string
  providerEconomics?: CreditProviderEconomics
}): Promise<CreditFinalizationResult> {
  const settlement = await settleCreditDeduction(args)
  if (settlement.ok) return settlement

  const refund = await refundCreditDeduction({
    ...args,
    reason: `Settlement failed: ${settlement.error}`,
  })
  return {
    ok: false,
    status: 'failed',
    error: settlement.error,
    refundStatus: refund.status,
  }
}

// ── Public: add credits (refunds, bonuses, admin top-up) ──────────────────────

/**
 * Add credits to a user's balance and log the transaction.
 * Used for refunds, referral bonuses, and admin top-ups.
 *
 * B1d-b: pass a STABLE `source` to also create a matching non-expiring MANUAL
 * CreditGrant (idempotent via the source). Omit `source` (the default) to keep
 * the exact original behavior — a bare increment + log with no grant. Callers
 * must supply a deterministic key (never a timestamp), so retries don't mint
 * duplicate grants. The grant is never read while the wallet flag is OFF.
 */
export async function addCredits(
  userId: string,
  amount: number,
  description: string,
  entityType = 'bonus',
  source?: string,
): Promise<void> {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error('Credit amount must be a positive integer')
  }
  let added = true
  if (source) {
    // Atomic and truly idempotent: only increment the scalar/cache when the
    // source grant was newly inserted. A retry with the same source must not
    // mint a second balance while createMany(skipDuplicates) silently skips.
    added = await (prisma as any).$transaction(async (tx: any) => {
      const grant = await ensureGrant(buildBonusGrant(userId, 'MANUAL', amount, source), tx)
      if (grant.created) {
        await tx.user.update({
          where: { id: userId },
          data: { aiCredits: { increment: amount } },
        })
      }
      return grant.created
    })
  } else {
    // Original behavior — unchanged.
    await prisma.user.update({
      where: { id: userId },
      data: { aiCredits: { increment: amount } },
    })
  }
  if (added) {
    await _logTransaction(userId, 'CREDIT', amount, description, undefined, entityType)
  }
}

// ── Public: refund credits on failed generation ───────────────────────────────

/**
 * Refund the exact cost of `action` back to the user and log a REFUND entry.
 *
 * Call this in the catch block of any route that deducts credits BEFORE doing
 * the AI work, so a failed generation never charges the user.
 *
 * IMPORTANT: only call when the credit was actually deducted. Unlimited-plan
 * users have creditsUsed === 0 — skip the refund for them (guard at call site):
 *
 *   const credit = await checkAndDeductCredits(userId, 'IMAGE_GENERATION')
 *   if (!credit.ok) return NextResponse.json(credit, { status: 402 })
 *   try { ...AI work... }
 *   catch (e) {
 *     if (credit.creditsUsed > 0) await refundCredits(userId, 'IMAGE_GENERATION')
 *     return NextResponse.json({ error: '...' }, { status: 500 })
 *   }
 *
 * Never throws — refund failure must not mask the original error.
 */
export async function refundCredits(
  userId: string,
  action: CreditAction,
  reason = 'Generation failed',
): Promise<CreditRefundResult> {
  const cost = CREDIT_COSTS[action]
  if (!cost) return { ok: true, status: 'noop' }
  try {
    // Some older routes still call this helper without passing the debit's
    // transactionId. When the grant wallet is enabled, incrementing only the
    // legacy scalar would create invisible balance (and the next wallet spend
    // would ignore it). Preserve those routes safely by minting a short-lived
    // REFUND grant as the documented interim fallback. Newer routes use
    // refundCreditsForTransaction for exact source restoration.
    if (isCreditWalletEnabled()) {
      await (prisma as any).$transaction(async (tx: any) => {
        const grantId = `refund:fallback:${userId}:${action}:${randomUUID()}`
        await tx.creditGrant.create({
          data: {
            userId,
            type: 'REFUND',
            status: 'ACTIVE',
            amount: cost,
            remaining: cost,
            // Interim refunds must not create a long-lived purchased-like pool.
            expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            source: grantId,
          },
        })
        await tx.user.update({
          where: { id: userId },
          data: { aiCredits: { increment: cost } },
        })
        await tx.creditTransaction.create({
          data: {
            userId,
            action: 'REFUND',
            amount: cost,
            creditCost: 0,
            status: 'SETTLED',
            settledAt: new Date(),
            description: `Refund — ${ACTION_LABELS[action] || action} (${reason})`,
            entityType: 'refund',
            pricingVersion: CURRENT_CREDIT_PRICING_VERSION,
          },
        })
      })
      return { ok: true, status: 'refunded' }
    }

    // The balance restoration and its audit ledger must commit together. A
    // partial scalar refund would otherwise be retried and could double-credit
    // the wallet when only the ledger write failed.
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { aiCredits: { increment: cost } },
      })
      await tx.creditTransaction.create({
        data: {
          userId,
          action: 'REFUND',
          amount: cost,
          creditCost: 0,
          status: 'SETTLED',
          settledAt: new Date(),
          description: `Refund — ${ACTION_LABELS[action] || action} (${reason})`,
          entityId: null,
          entityType: 'refund',
          pricingVersion: CURRENT_CREDIT_PRICING_VERSION,
        },
      })
    })
    return { ok: true, status: 'refunded' }
  } catch (e) {
    const error = (e as Error).message
    console.error('[refundCredits] failed (non-fatal):', error)
    return { ok: false, status: 'failed', error }
  }
}

// ── Public: allocation-aware refund-to-source (B1c-c-1 — wallet path) ──────────

/**
 * Refund a specific debit transaction back to the CreditGrant rows it drew from.
 *
 * This is the grant-wallet counterpart to `refundCredits`. Callers use it ONLY
 * when CREDIT_WALLET_ENABLED is ON and they hold the debit's `transactionId`
 * (returned by `checkAndDeductCredits`). Legacy scalar `refundCredits` is
 * unchanged and still used when the flag is OFF.
 *
 * Guarantees (all inside ONE transaction; the debit row is locked FOR UPDATE so
 * concurrent refunds of the SAME debit serialize):
 *   - Restores the exact per-grant amounts to still-active source grants (capped
 *     at each grant's original size); spillover/expired sources mint ONE new
 *     short-lived REFUND grant (14-day expiry) — never reviving an expired one.
 *   - Increments the User.aiCredits cache by the exact refunded total.
 *   - Writes a REFUND CreditTransaction linked to the debit
 *     (entityType='credit_transaction', entityId=debit.id).
 *   - Idempotent: if a REFUND already links this debit, it no-ops.
 *   - No-ops safely for a missing transaction, a non-debit (amount >= 0), or a
 *     transaction owned by another user. Never throws.
 *
 * No schema change: double-refund prevention reuses entityId/entityType.
 */
export async function refundCreditsForTransaction(
  args: {
    userId: string
    transactionId: string
    reason?: string
    /** Provider spend already incurred even though the customer is refunded. */
    providerEconomics?: CreditProviderEconomics
  },
): Promise<CreditRefundResult> {
  const { userId, transactionId, reason } = args
  const providerEconomics = normalizeProviderEconomics(args.providerEconomics)
  try {
    const outcome = await (prisma as any).$transaction(async (tx: any) => {
      // 1. Lock the debit row for the duration so two refunds of the same debit
      //    can't both proceed (the second sees the REFUND row and no-ops).
      const debitRows: Array<{
        id: string
        userId: string
        amount: number
        creditCost: number
        status: string
      }> =
        await tx.$queryRawUnsafe(
          `SELECT "id", "userId", "amount", "creditCost", "status"
             FROM "CreditTransaction" WHERE "id" = $1 FOR UPDATE`,
          transactionId,
        )
      const debit = debitRows[0]

      // A zero-amount unlimited reservation is still a billable AI operation.
      if (!debit || debit.userId !== userId || debit.amount > 0 || debit.creditCost <= 0) {
        return { status: 'noop' as const, wasSettled: false, creditCost: 0 }
      }
      if (debit.status === 'REFUNDED') {
        if (providerEconomics) {
          await tx.creditTransaction.update({
            where: { id: debit.id },
            data: providerEconomics,
          })
        }
        return { status: 'noop' as const, wasSettled: false, creditCost: 0 }
      }

      // 4. Double-refund guard — an existing REFUND linked to this debit.
      const already = await tx.creditTransaction.findFirst({
        where: { action: 'REFUND', entityType: 'credit_transaction', entityId: debit.id },
        select: { id: true },
      })
      if (already) {
        await tx.creditTransaction.update({
          where: { id: debit.id },
          data: {
            status: 'REFUNDED',
            refundedAt: new Date(),
            ...(providerEconomics ?? {}),
          },
        })
        return { status: 'noop' as const, wasSettled: false, creditCost: 0 }
      }

      // 5. Allocation rows for this debit.
      const allocs: RefundAllocationInput[] = await tx.creditTransactionGrantAllocation.findMany({
        where: { creditTransactionId: debit.id },
        select: { creditGrantId: true, amount: true },
      })

      const now = new Date()
      let refundTotal = 0
      let newRefundGrantAmount = 0

      if (allocs.length > 0) {
        // 6. Restore to source. Lock the involved grants so the cap stays exact
        //    under concurrent refunds touching the same grant.
        const grantIds = allocs.map((a) => a.creditGrantId)
        const grants: RefundSourceGrant[] = await tx.$queryRawUnsafe(
          `SELECT "id", "amount", "remaining", "status", "expiresAt"
             FROM "CreditGrant" WHERE "id" = ANY($1) FOR UPDATE`,
          grantIds,
        )
        const plan = planRefundToSource(allocs, grants, now)
        refundTotal = plan.refundTotal
        newRefundGrantAmount = plan.newRefundGrantAmount
        for (const r of plan.perGrantRestores) {
          await tx.creditGrant.update({
            where: { id: r.grantId },
            data: { remaining: { increment: r.amount } },
          })
        }
      } else {
        // 7. No allocations (e.g. an old/scalar debit) → refund the full amount
        //    into a fresh REFUND grant. Exact and safe.
        refundTotal = Math.abs(debit.amount)
        newRefundGrantAmount = refundTotal
      }

      // 8. Mint ONE new REFUND grant for the non-restorable portion.
      if (newRefundGrantAmount > 0) {
        await tx.creditGrant.create({
          data: {
            userId,
            type: 'REFUND',
            status: 'ACTIVE',
            amount: newRefundGrantAmount,
            remaining: newRefundGrantAmount,
            expiresAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
            source: `refund:credit_transaction:${debit.id}`,
          },
        })
      }

      if (refundTotal > 0 || debit.status === 'SETTLED') {
        // Keep the balance cache exact. A settled operation also removes the
        // successful-generation count because its output was ultimately voided.
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(refundTotal > 0 ? { aiCredits: { increment: refundTotal } } : {}),
            ...(debit.status === 'SETTLED' ? { monthlyGenerations: { decrement: 1 } } : {}),
          },
        })
      }

      await tx.creditTransaction.update({
        where: { id: debit.id },
        data: {
          status: 'REFUNDED',
          refundedAt: now,
          ...(providerEconomics ?? {}),
        },
      })
      await tx.creditTransaction.create({
        data: {
          userId,
          action: 'REFUND',
          amount: refundTotal,
          creditCost: 0,
          status: 'SETTLED',
          settledAt: now,
          description: reason ? `Refund — ${reason}` : 'Refund',
          entityId: debit.id,
          entityType: 'credit_transaction',
          pricingVersion: CURRENT_CREDIT_PRICING_VERSION,
        },
      })
      return {
        status: 'refunded' as const,
        wasSettled: debit.status === 'SETTLED',
        creditCost: debit.creditCost,
      }
    })
    if (outcome.wasSettled && outcome.creditCost > 0) {
      await _untrackUsage(userId, outcome.creditCost)
    }
    return { ok: true, status: outcome.status }
  } catch (e) {
    // 11. Never throw — return an explicit failure so reconciliation-capable
    // callers can keep the debit pending without masking the original error.
    const error = (e as Error).message
    console.error('[refundCreditsForTransaction] failed (non-fatal):', error)
    return { ok: false, status: 'failed', error }
  }
}

/**
 * The one refund entry point AI routes should use after a successful charge.
 * It prefers the exact debit transaction (idempotent and variable-cost safe),
 * while retaining a fixed-action fallback for legacy callers/tests that do not
 * yet expose a transaction id. Unlimited plans have creditsUsed=0 and no-op.
 */
export async function refundCreditDeduction(args: {
  userId: string
  action: CreditAction
  deduction: CreditDeductionOk | null | undefined
  reason: string
  /** Provider spend already incurred even though the customer is refunded. */
  providerEconomics?: CreditProviderEconomics
}): Promise<CreditRefundResult> {
  const { userId, action, deduction, reason, providerEconomics } = args
  if (!deduction) return { ok: true, status: 'noop' }
  if (deduction.transactionId) {
    return refundCreditsForTransaction({
      userId,
      transactionId: deduction.transactionId,
      reason,
      providerEconomics,
    })
  }
  if (deduction.creditsUsed <= 0) return { ok: true, status: 'noop' }
  return refundCredits(userId, action, reason)
}

// ── Public: daily image-generation cap ────────────────────────────────────────

export interface ImageCapResult {
  allowed: boolean
  used: number
  cap: number        // -1 = uncapped
  remaining: number  // -1 = uncapped
}

/**
 * Count non-failed image generations for a workspace since local midnight.
 * Failed (and refunded) generations are excluded so they don't burn the cap.
 */
export async function countImagesToday(workspaceId: string): Promise<number> {
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  return (prisma as any).generatedVisual
    .count({
      where: {
        workspaceId,
        createdAt: { gte: dayStart },
        status: { not: 'FAILED' },
      },
    })
    .catch(() => 0)
}

/**
 * Check whether a workspace may generate another image today under its plan cap.
 * Resolve `plan` from the user's subscriptionStatus. Unknown plans default to FREE.
 */
export async function checkDailyImageCap(
  workspaceId: string,
  plan: string | null | undefined,
): Promise<ImageCapResult> {
  const key = (plan || 'FREE').toUpperCase()
  const cap = DAILY_IMAGE_CAPS[key] ?? DAILY_IMAGE_CAPS.FREE
  if (cap === -1) return { allowed: true, used: 0, cap: -1, remaining: -1 }
  const used = await countImagesToday(workspaceId)
  const remaining = Math.max(0, cap - used)
  return { allowed: used < cap, used, cap, remaining }
}

/**
 * Fetch the credit transaction history for a user.
 */
export async function getCreditHistory(
  userId: string,
  limit = 50,
): Promise<Array<{
  id: string
  action: string
  description: string | null
  amount: number
  entityId: string | null
  entityType: string | null
  pricingVersion: string | null
  status: 'RESERVED' | 'SETTLED' | 'REFUNDED'
  creditCost: number
  reservedAt: Date | null
  settledAt: Date | null
  refundedAt: Date | null
  createdAt: Date
}>> {
  return (prisma as any).creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      action: true,
      description: true,
      amount: true,
      entityId: true,
      entityType: true,
      pricingVersion: true,
      status: true,
      creditCost: true,
      reservedAt: true,
      settledAt: true,
      refundedAt: true,
      createdAt: true,
    },
  })
}

// ── Public: real usage for dashboard + analytics ──────────────────────────────

export interface UsageSummary {
  generationsTotal: number
  generationsThisMonth: number
  creditsUsedThisMonth: number
}

/**
 * The SINGLE source of truth for "AI generations" and "credits used this month",
 * shared by /api/dashboard/stats and /api/analytics/overview so their numbers
 * always agree. Derived from the credit-transaction ledger (the same populated
 * source the billing credit-log uses) plus the always-incremented
 * `monthlyGenerations` counter.
 *
 * - generationsTotal: lifetime settled AI operations (monthlyGenerations is bumped on
 *   every settlement for both credit and unlimited plans; ledger operation count is a
 *   fallback floor).
 * - generationsThisMonth / creditsUsedThisMonth: from this month's ledger rows,
 *   counting only settled operations. `creditCost` records the economic usage
 *   even when an unlimited plan has a zero wallet debit. NEVER computed as (monthlyTotal - remaining), which
 *   underflows to 0 when rollover/granted credits exceed the plan quota.
 */
export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  const start = new Date()
  start.setDate(1)
  start.setHours(0, 0, 0, 0)
  const db = prisma as any
  try {
    const [user, debitCountTotal, monthTxns] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { monthlyGenerations: true } }),
      db.creditTransaction.count({ where: { userId, creditCost: { gt: 0 }, status: 'SETTLED' } }).catch(() => 0),
      db.creditTransaction.findMany({
        where: { userId, createdAt: { gte: start }, status: 'SETTLED', creditCost: { gt: 0 } },
        select: { creditCost: true },
      }).catch(() => []),
    ])

    let generationsThisMonth = 0
    let creditsUsedThisMonth = 0
    for (const t of monthTxns as Array<{ creditCost: number }>) {
      generationsThisMonth += 1
      creditsUsedThisMonth += Math.max(0, t.creditCost)
    }

    return {
      generationsTotal: Math.max(user?.monthlyGenerations ?? 0, (debitCountTotal as number) ?? 0),
      generationsThisMonth: Math.max(0, generationsThisMonth),
      creditsUsedThisMonth: Math.max(0, creditsUsedThisMonth),
    }
  } catch {
    return { generationsTotal: 0, generationsThisMonth: 0, creditsUsedThisMonth: 0 }
  }
}

/**
 * Per-month AI activity for the last `months` months, from the credit ledger —
 * the same populated source as getUsageSummary. Replaces the optional `usage`
 * table the analytics chart used to read (which can be empty in production).
 */
export async function getMonthlyActivity(
  userId: string,
  months = 6,
): Promise<Array<{ month: number; year: number; generations: number; creditsUsed: number }>> {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)
  const db = prisma as any
  const txns: Array<{ creditCost: number; createdAt: Date }> =
    await db.creditTransaction
      .findMany({
        where: { userId, createdAt: { gte: start }, status: 'SETTLED', creditCost: { gt: 0 } },
        select: { creditCost: true, createdAt: true },
      })
      .catch(() => [])

  const buckets = new Map<string, { generations: number; creditsUsed: number }>()
  for (const t of txns) {
    const d = new Date(t.createdAt)
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`
    const b = buckets.get(key) ?? { generations: 0, creditsUsed: 0 }
    b.generations += 1
    b.creditsUsed += Math.max(0, t.creditCost)
    buckets.set(key, b)
  }

  return Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
    const month = d.getMonth() + 1
    const year = d.getFullYear()
    const b = buckets.get(`${year}-${month}`) ?? { generations: 0, creditsUsed: 0 }
    return { month, year, generations: Math.max(0, b.generations), creditsUsed: Math.max(0, b.creditsUsed) }
  })
}

// ── Internal: credit transaction logger ───────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  RUN_FULL_STRATEGY: 'Run Full Strategy',
  CAMPAIGN_GENERATION: 'Campaign Generation',
  CREATIVE_BRIEF: 'Creative Brief',
  SENTINEL_REVIEW: 'Sentinel Review',
  IMAGE_GENERATION: 'Image Generation',
  VIDEO_GENERATION: 'Professional Video Ad',
  MOTION_DESIGN_VIDEO: 'Source-Locked Motion Design Ad',
  AD_COPY: 'Ad Copy Generation',
  PAID_EXECUTION_PLAN: 'Paid Execution Plan',
  CHAT_MESSAGE: 'AI Chat Message',
  AI_POST_REWRITE: 'AI Post Rewrite',
  CONTENT_PLAN_GENERATION: 'Content Plan Generation',
  CONTENT_AB_VARIANTS: 'A/B Caption Variants',
  PAID_PACK_GENERATE: 'Paid Campaign Pack',
  WEBSITE_SCAN: 'Website Intelligence Scan',
  CONTENT_ANALYSIS: 'Content Samples Analysis',
  MEDIA_INTELLIGENCE_ANALYSIS: 'Creative Media Intelligence',
  BRAND_EVIDENCE_ANALYSIS: 'Brand Evidence Analysis',
  CREDIT: 'Credits Added',
  REFUND: 'Refund',
  BONUS: 'Bonus Credits',
}

async function _logTransaction(
  userId: string,
  action: string,
  amount: number, // negative = spent, positive = earned
  description?: string,
  entityId?: string,
  entityType?: string,
): Promise<void> {
  await (prisma as any).creditTransaction
    .create({
      data: {
        userId,
        action,
        description: description || ACTION_LABELS[action] || action,
        amount,
        entityId: entityId ?? null,
        entityType: entityType ?? null,
        pricingVersion: CURRENT_CREDIT_PRICING_VERSION,
      },
    })
    .catch(() => {
      // Non-fatal — transaction log should never block AI generation
    })
}

// ── Internal: usage table tracking ────────────────────────────────────────────
// Updates the monthly usage table. Non-blocking on error — table may not exist
// in dev environments or early prod deploys.

async function _trackUsage(userId: string, creditsUsed: number): Promise<void> {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  await (prisma as any).usage
    .upsert({
      where: { userId_month_year: { userId, month, year } },
      create: { userId, month, year, aiCreditsUsed: creditsUsed, generationsCount: 1 },
      update: {
        aiCreditsUsed: { increment: creditsUsed },
        generationsCount: { increment: 1 },
      },
    })
    .catch(() => {
      // Non-fatal — usage tracking should never block AI generation
    })
}

async function _untrackUsage(userId: string, creditsUsed: number): Promise<void> {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  try {
    const usage = await (prisma as any).usage.findUnique({
      where: { userId_month_year: { userId, month, year } },
      select: { aiCreditsUsed: true, generationsCount: true },
    })
    if (!usage) return
    await (prisma as any).usage.update({
      where: { userId_month_year: { userId, month, year } },
      data: {
        aiCreditsUsed: Math.max(0, usage.aiCreditsUsed - creditsUsed),
        generationsCount: Math.max(0, usage.generationsCount - 1),
      },
    })
  } catch {
    // Ledger status remains the source of truth if the compatibility usage row
    // is temporarily unavailable.
  }
}
