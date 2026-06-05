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
   * Campaign generation — full strategy + ad concepts
   * Routes: /api/generate, /api/generate/preview
   * API cost: ~$0.028 (GPT-4o, ~3,500 tokens). Margin @ Pro: 94%
   */
  CAMPAIGN_GENERATION: 5,

  /**
   * Run Full Strategy — triggers full agency orchestration (all agents)
   * Routes: /api/agents/run, /api/strategy/run-full
   * API cost: ~$0.053 (GPT-4o, ~6,500 tokens). Margin @ Pro: 93%
   */
  RUN_FULL_STRATEGY: 8,

  /**
   * Creative Brief — visual direction via asset analysis or concept generation
   * Route: /api/campaigns/[id]/creative-brief (POST)
   * API cost: ~$0.017 (GPT-4o, ~2,000 tokens). Margin @ Pro: 94%
   */
  CREATIVE_BRIEF: 3,

  /**
   * Sentinel Review — AI quality + risk gate for a campaign
   * Route: /api/campaigns/[id]/sentinel-review (POST)
   * API cost: ~$0.001 (GPT-4o-mini). Margin @ Pro: 99%
   */
  SENTINEL_REVIEW: 2,

  /**
   * Image generation — DALL-E 3 via /api/images/generate
   * API cost: $0.040 per image (DALL-E 3 standard). Margin @ Pro: 87%
   */
  IMAGE_GENERATION: 3,

  /**
   * Ad copy generation (VEX) — GPT-4o-mini ad concepts
   * Route: /api/vex/generate
   * API cost: ~$0.001 (GPT-4o-mini). Margin @ Pro: 99%
   */
  AD_COPY: 2,

  /**
   * Chat message — GPT-4o-mini assistant response
   * Route: /api/chat
   * API cost: ~$0.0003. Margin @ Pro: 99%
   */
  CHAT_MESSAGE: 1,

  /**
   * AI Post Rewrite — GPT-4o-mini rewrites a single content hub post
   * Route: /api/campaigns/[id]/content-plan/[postId]/rewrite
   * API cost: ~$0.0003. Margin @ Pro: 99%
   */
  AI_POST_REWRITE: 1,

  /**
   * Content plan generation — GPT-4o-mini writes all post captions + image prompts
   * Route: /api/campaigns/[id]/generate-content-plan
   * API cost: ~$0.002 (GPT-4o-mini, ~3,000 tokens). Charged per-plan not per-post.
   * Actual charge = max(2, ceil(postsPerMonth / 5)) — scales with plan size.
   */
  CONTENT_PLAN_GENERATION: 2,

  /**
   * Paid campaign pack generation — GPT-4o writes full audience targeting, copy
   * variants, budget insights, and platform-by-platform launch guides.
   * Route: /api/campaigns/[id]/paid-pack/generate
   * API cost: ~$0.06 (GPT-4o, ~4,000 tokens). Margin @ Pro: 90%
   */
  PAID_PACK_GENERATE: 6,

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
