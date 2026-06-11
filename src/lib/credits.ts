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
   * Revenue @ Agency: 5 × $0.198 = $0.990 | Margin: ~99%
   * Revenue @ Starter: 5 × $0.380 = $1.900 | Margin: ~99%
   */
  CAMPAIGN_GENERATION: 5,

  /**
   * Run Full Strategy — fires the Strategist agent (orchestrator, strategy-only path)
   * Routes: /api/agents/run, /api/strategy/run-full, /api/campaigns/[id]/engine
   * Model: gpt-4o (strategist.ts — Content Director runs separately via CONTENT_PLAN_GENERATION)
   * Input: ~3,000–5,000 tokens (brief + brand context) | Output: ~6,500 tokens (max_tokens cap)
   * API cost: ~$0.075–$0.090 (gpt-4o @ $2.50/M in, $10/M out)
   * Revenue @ Agency: 8 × $0.198 = $1.584 | Margin: ~94–95%
   * Revenue @ Starter: 8 × $0.380 = $3.040 | Margin: ~97%
   */
  RUN_FULL_STRATEGY: 8,

  /**
   * Creative Brief — visual direction: asset analysis + concept generation
   * Route: /api/campaigns/[id]/creative-brief (POST)
   * Model: gpt-4o (visual-director.ts — two sequential calls: analyzeAssets + generateVisualConcepts)
   * Input: ~2,000–3,000 tokens | Output: ~900–2,000 tokens per call
   * API cost: ~$0.025–$0.045 (two gpt-4o calls)
   * Revenue @ Agency: 3 × $0.198 = $0.594 | Margin: ~92–96%
   * Revenue @ Starter: 3 × $0.380 = $1.140 | Margin: ~96–98%
   */
  CREATIVE_BRIEF: 3,

  /**
   * Sentinel Review — AI quality + risk + Brand Voice gate for a campaign
   * Route: /api/campaigns/[id]/sentinel-review (POST)
   * Model: gpt-4o (sentinel-reviewer.ts — NOT gpt-4o-mini; uses full reasoning capability)
   * Input: ~2,000–3,000 tokens | Output: ~2,000 tokens (max_tokens: 2000)
   * API cost: ~$0.025 (gpt-4o @ $2.50/M in, $10/M out)
   * Revenue @ Agency: 2 × $0.198 = $0.396 | Margin: ~94%
   * Revenue @ Starter: 2 × $0.380 = $0.760 | Margin: ~97%
   */
  SENTINEL_REVIEW: 2,

  /**
   * Image generation — gpt-image-1 at high quality (platform-native sizing)
   * Routes: /api/visuals/generate, /api/campaigns/[id]/generate-content-plan/generate
   * Model: gpt-image-1, quality: 'high' (upgraded from DALL-E 3 in Sprint IQ)
   * Sizes: 1024×1024 (square), 1024×1536 (portrait), 1536×1024 (landscape — default)
   * API cost: verify exact rate at platform.openai.com/usage — estimated $0.040–$0.080/image
   * ⚠️  NOTE: 1536×1024 landscape (default) costs MORE than 1024×1024. Confirm rate.
   * Revenue @ Agency: 3 × $0.198 = $0.594 | Margin: ~85–93% (depends on verified rate)
   * Revenue @ Starter: 3 × $0.380 = $1.140 | Margin: ~93–96%
   * Fallback: fal.ai Flux 1.1 Pro Ultra when FAL_KEY is set (~$0.06/image)
   */
  IMAGE_GENERATION: 3,

  /**
   * Ad copy generation — gpt-4o-mini ad concepts and copy variants
   * Routes: /api/campaigns/suggest, /api/brand/suggest, /api/ai/generate,
   *         /api/ad-campaigns/[id]/generate-strategy, /api/ad-campaigns/[id]/generate-copy,
   *         /api/campaigns/[id]/paid-pack/learn
   * Model: gpt-4o-mini (campaign-manager.ts, max_tokens: 1500)
   * Input: ~800 tokens | Output: ~1,500 tokens
   * API cost: ~$0.001 (gpt-4o-mini @ $0.15/M in, $0.60/M out)
   * Revenue @ Agency: 2 × $0.198 = $0.396 | Margin: ~99%
   */
  AD_COPY: 2,

  /**
   * Chat message — streaming assistant with campaign/brand context injection
   * Route: /api/chat
   * Model: gpt-4o-mini (context-aware; cost grows with conversation history length)
   * Estimated cost: ~$0.001–$0.005 (early msg vs long conversation history)
   * Revenue @ Agency: 1 × $0.198 = $0.198 | Margin: ~97–99%
   */
  CHAT_MESSAGE: 1,

  /**
   * AI Post Rewrite — rewrites a single content hub post with style variation
   * Route: /api/campaigns/[id]/content-plan/[postId]/rewrite
   * Model: gpt-4o-mini (via lib/ai/openai.ts helper, max_tokens: ~500)
   * API cost: ~$0.001 (gpt-4o-mini)
   * Revenue @ Agency: 1 × $0.198 = $0.198 | Margin: ~99%
   */
  AI_POST_REWRITE: 1,

  /**
   * Content plan generation — gpt-4o writes all post captions + scheduling for a full month
   * Route: /api/campaigns/[id]/generate-content-plan
   * Model: gpt-4o (content-director.ts — NOT gpt-4o-mini)
   * Output tokens scale with plan quota (postsPerMonth × 150 + 800, capped at 8,000):
   *   Starter (10 posts): ~2,500 out → cost ~$0.033
   *   Growth  (25 posts): ~4,550 out → cost ~$0.053
   *   Agency  (60 posts): ~8,000 out → cost ~$0.088
   * Revenue @ Agency: 2 × $0.198 = $0.396 | Margin: ~78%   ← lowest margin action
   * Revenue @ Starter: 2 × $0.380 = $0.760 | Margin: ~96%
   * ⚠️  Consider raising to 3 credits for Agency plan users if COGS grows.
   */
  CONTENT_PLAN_GENERATION: 2,

  /**
   * Paid campaign pack — gpt-4o writes audience targeting, copy variants, budget plan
   * Route: /api/campaigns/[id]/paid-pack/generate
   * Model: gpt-4o (max_tokens: ~4,000)
   * Input: ~2,500 tokens | Output: ~4,000 tokens
   * API cost: ~$0.046–$0.050 (gpt-4o @ $2.50/M in, $10/M out)
   * Revenue @ Agency: 6 × $0.198 = $1.188 | Margin: ~96%
   * Revenue @ Starter: 6 × $0.380 = $2.280 | Margin: ~98%
   */
  PAID_PACK_GENERATE: 6,

  /**
   * Website Intelligence Scanner — fetches + parses brand website, gpt-4o extracts brand DNA
   * Route: /api/brand/scan-website
   * Model: gpt-4o (deep extraction + structured Brand Brain update)
   * Input: ~3,000 tokens (fetched page text) | Output: ~5,000 tokens
   * API cost: ~$0.055–$0.065 (gpt-4o @ $2.50/M in, $10/M out)
   * Revenue @ Agency: 3 × $0.198 = $0.594 | Margin: ~89–91%
   * Revenue @ Starter: 3 × $0.380 = $1.140 | Margin: ~94–95%
   */
  WEBSITE_SCAN: 3,

  /**
   * Content Samples Analyzer — gpt-4o extracts hooks, angles, and tone from pasted samples
   * Route: /api/brand/analyze-content
   * Model: gpt-4o (structured extraction → Brand Brain update)
   * Input: ~2,000 tokens (samples) | Output: ~2,000 tokens
   * API cost: ~$0.025 (gpt-4o @ $2.50/M in, $10/M out)
   * Revenue @ Agency: 2 × $0.198 = $0.396 | Margin: ~94%
   * Revenue @ Starter: 2 × $0.380 = $0.760 | Margin: ~97%
   */
  CONTENT_ANALYSIS: 2,

} as const

export type CreditAction = keyof typeof CREDIT_COSTS

// ── Free plan starter credits ──────────────────────────────────────────────────
// Granted on first AI action to brand-new FREE accounts.
// 15 credits = 3× CAMPAIGN_GENERATION or 3× RUN_FULL_STRATEGY, or a mix of actions.
// Adjust here to change the free tier without touching any route.

export const FREE_STARTER_CREDITS = 10

// ── Monthly credit totals per plan ─────────────────────────────────────────────
// Used by the dashboard credit progress bar.
// Must stay in sync with PLAN_CREDITS in src/lib/stripe.ts.
// Free=10 (one-time), Starter=50/mo, Growth(PRO)=150/mo, Agency(BUSINESS)=500/mo

export const PLANS_CREDITS: Record<string, number> = {
  FREE:      FREE_STARTER_CREDITS, // 10 (one-time, never refreshes)
  STARTER:   50,
  PRO:       150,  // Growth plan
  GROWTH:    150,  // alias
  BUSINESS:  500,  // Agency plan
  AGENCY:    500,  // alias
  // Stripe subscription status aliases (subscriptionStatus field values)
  ACTIVE:    150,  // Stripe active = Growth tier
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
}

export interface InsufficientCreditsError {
  ok: false
  error: 'INSUFFICIENT_CREDITS'
  message: string
  requiredCredits: number
  currentCredits: number
  upgradeUrl: string
}

export type CreditCheckResult = CreditDeductionOk | InsufficientCreditsError

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
 */
export async function checkAndDeductCredits(
  userId: string,
  action: CreditAction,
): Promise<CreditCheckResult> {
  const cost = CREDIT_COSTS[action]

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
    // Track usage but do not touch the credit balance
    await prisma.user.update({
      where: { id: userId },
      data: { monthlyGenerations: { increment: 1 } },
    })
    await _trackUsage(userId, cost)
    return { ok: true, creditsRemaining: -1, creditsUsed: 0, isUnlimited: true }
  }

  // ── First-time FREE user: grant starter credits ────────────────────────────
  const isFree = user.subscriptionStatus === 'FREE'
  if (isFree && user.aiCredits === 0 && user.monthlyGenerations === 0) {
    user = await prisma.user.update({
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
  }

  const currentCredits = user.aiCredits

  // ── Insufficient credits ───────────────────────────────────────────────────
  if (currentCredits < cost) {
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

  // ── Atomic deduction ──────────────────────────────────────────────────────
  // Use updateMany with a conditional WHERE to avoid race conditions.
  // Postgres executes the WHERE check and UPDATE in a single statement —
  // if two requests arrive simultaneously, only one will see count === 1.
  const deducted = await prisma.user.updateMany({
    where: { id: userId, aiCredits: { gte: cost } },
    data: {
      aiCredits: { decrement: cost },
      monthlyGenerations: { increment: 1 },
    },
  })

  if (deducted.count === 0) {
    // Lost the race — credits were already consumed by a concurrent request
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

  const newCredits = Math.max(0, currentCredits - cost)

  // ── Track usage (non-blocking) ─────────────────────────────────────────────
  await _trackUsage(userId, cost)

  // ── Log transaction (non-blocking) ────────────────────────────────────────
  _logTransaction(userId, action, -cost).catch(() => {})

  // ── Low-credits warning email ──────────────────────────────────────────────
  // Fire when balance drops below threshold (e.g. can't afford another generation).
  if (newCredits < LOW_CREDITS_THRESHOLD && user.email) {
    sendCreditsLowEmail(
      user.email,
      user.name || user.email.split('@')[0],
      newCredits,
    ).catch((e: Error) => console.error('[Credits low email]', e.message))
  }

  return { ok: true, creditsRemaining: newCredits, creditsUsed: cost, isUnlimited: false }
}

// ── Public: add credits (refunds, bonuses, admin top-up) ──────────────────────

/**
 * Add credits to a user's balance and log the transaction.
 * Used for refunds, referral bonuses, and admin top-ups.
 */
export async function addCredits(
  userId: string,
  amount: number,
  description: string,
  entityType = 'bonus',
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { aiCredits: { increment: amount } },
  })
  await _logTransaction(userId, 'CREDIT', amount, description, undefined, entityType)
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
  entityType: string | null
  createdAt: Date
}>> {
  return (prisma as any).creditTransaction
    .findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        action: true,
        description: true,
        amount: true,
        entityType: true,
        createdAt: true,
      },
    })
    .catch(() => [])
}

// ── Internal: credit transaction logger ───────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  RUN_FULL_STRATEGY: 'Run Full Strategy',
  CAMPAIGN_GENERATION: 'Campaign Generation',
  CREATIVE_BRIEF: 'Creative Brief',
  SENTINEL_REVIEW: 'Sentinel Review',
  IMAGE_GENERATION: 'Image Generation',
  AD_COPY: 'Ad Copy Generation',
  CHAT_MESSAGE: 'AI Chat Message',
  AI_POST_REWRITE: 'AI Post Rewrite',
  CONTENT_PLAN_GENERATION: 'Content Plan Generation',
  PAID_PACK_GENERATE: 'Paid Campaign Pack',
  WEBSITE_SCAN: 'Website Intelligence Scan',
  CONTENT_ANALYSIS: 'Content Samples Analysis',
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
