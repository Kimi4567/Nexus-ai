/**
 * Public commercial contract.
 *
 * Keep this module dependency-free and client-safe. Stripe price IDs stay in
 * server-only lib/stripe.ts; this file contains product names, allowances, and
 * the strict IDs accepted by checkout routes.
 */

export type PublicPaidPlanId = 'pro' | 'business'

// One bounded activation journey: Organic Light logic / 30 days (12) + quality
// review (3), capped to three strategy directions by FREE_TRIAL_POSTS. Content
// production is deliberately excluded from the free grant; this prevents
// disposable accounts from consuming the heaviest workflow while still letting
// a new customer validate the strategy and review experience.
export const FREE_TRIAL_CREDITS = 15
export const FREE_TRIAL_POSTS = 3

export interface PublicPaidPlan {
  id: PublicPaidPlanId
  slug: 'growth' | 'autopilot'
  name: 'Growth' | 'Autopilot'
  priceUsd: number
  monthlyCredits: number
  postsPerMonth: number
  postsPerCampaign: number
  videoSlotsPerMonth: number
  workspaces: number
  campaignLimit: number
}

export const PUBLIC_PAID_PLANS: readonly PublicPaidPlan[] = [
  {
    id: 'pro',
    slug: 'growth',
    name: 'Growth',
    priceUsd: 49,
    monthlyCredits: 60,
    postsPerMonth: 16,
    postsPerCampaign: 16,
    videoSlotsPerMonth: 2,
    workspaces: 2,
    campaignLimit: 4,
  },
  {
    id: 'business',
    slug: 'autopilot',
    name: 'Autopilot',
    priceUsd: 99,
    monthlyCredits: 180,
    postsPerMonth: 40,
    postsPerCampaign: 20,
    videoSlotsPerMonth: 5,
    workspaces: 5,
    campaignLimit: 12,
  },
] as const

/**
 * Translate public slugs and backwards-compatible internal IDs into the two
 * sellable Stripe plan IDs. Legacy Starter subscriptions remain supported by
 * webhook/status code, but new Starter checkouts are intentionally blocked.
 */
export function normalizePublicPaidPlan(value: unknown): PublicPaidPlanId | null {
  if (typeof value !== 'string') return null
  const plan = value.trim().toLowerCase()
  if (plan === 'growth' || plan === 'pro') return 'pro'
  if (plan === 'autopilot' || plan === 'business' || plan === 'agency') return 'business'
  return null
}

export function getPublicPaidPlan(value: unknown): PublicPaidPlan | null {
  const id = normalizePublicPaidPlan(value)
  return id ? (PUBLIC_PAID_PLANS.find((plan) => plan.id === id) ?? null) : null
}

/** Server-enforced workspace allowance, including legacy/internal statuses. */
export function getWorkspaceLimit(plan: unknown, role?: unknown): number {
  if (String(role).toUpperCase() === 'ADMIN') return 999
  const normalized = String(plan || 'FREE').toUpperCase()
  if (normalized === 'BUSINESS' || normalized === 'AGENCY') return PUBLIC_PAID_PLANS[1].workspaces
  if (normalized === 'PRO' || normalized === 'GROWTH' || normalized === 'ACTIVE') return PUBLIC_PAID_PLANS[0].workspaces
  return 1 // FREE + legacy STARTER
}

/** Monthly campaign creation allowance, including legacy/internal statuses. */
export function getCampaignLimit(plan: unknown, role?: unknown): number {
  if (String(role).toUpperCase() === 'ADMIN') return 999
  const normalized = String(plan || 'FREE').toUpperCase()
  if (normalized === 'BUSINESS' || normalized === 'AGENCY') return PUBLIC_PAID_PLANS[1].campaignLimit
  if (normalized === 'PRO' || normalized === 'GROWTH' || normalized === 'ACTIVE') return PUBLIC_PAID_PLANS[0].campaignLimit
  if (normalized === 'STARTER') return 2
  return 1
}

/** Monthly AI-planned post allowance; manual user-authored posts are excluded. */
export function getPlannedPostLimit(plan: unknown, role?: unknown): number {
  if (String(role).toUpperCase() === 'ADMIN') return 999
  const normalized = String(plan || 'FREE').toUpperCase()
  if (normalized === 'BUSINESS' || normalized === 'AGENCY') return PUBLIC_PAID_PLANS[1].postsPerMonth
  if (normalized === 'PRO' || normalized === 'GROWTH' || normalized === 'ACTIVE') return PUBLIC_PAID_PLANS[0].postsPerMonth
  if (normalized === 'STARTER') return 10
  return 3
}

// ── One-time credit wallet purchases ────────────────────────────────────────

/**
 * Versioned, server-enforced pricing policy for one-time wallet purchases.
 * Progressive blocks keep the total monotonic: buying one more block can never
 * make the whole purchase cheaper. Wallet credit is intentionally more
 * expensive than the lowest subscription unit price so top-ups cannot undercut
 * the recurring plans. The minimum also keeps fixed payment fees from eroding
 * small-purchase margin.
 */
export const CREDIT_PURCHASE_POLICY = {
  version: '2026-07-16-v2',
  currency: 'usd',
  minimum: 20,
  maximum: 500,
  step: 5,
  validityMonths: 12,
  tiers: [
    { upTo: 50, unitAmountCents: 100 },
    { upTo: 150, unitAmountCents: 90 },
    { upTo: 300, unitAmountCents: 80 },
    { upTo: 500, unitAmountCents: 70 },
  ],
} as const

export interface CreditPurchaseQuote {
  credits: number
  amountCents: number
  amountUsd: number
  effectiveUnitAmountCents: number
  validityMonths: number
  pricingVersion: string
}

/** Returns null for fractional, out-of-range, or off-step quantities. */
export function quoteCreditPurchase(value: unknown): CreditPurchaseQuote | null {
  const credits = typeof value === 'number' ? value : Number(value)
  if (
    !Number.isSafeInteger(credits) ||
    credits < CREDIT_PURCHASE_POLICY.minimum ||
    credits > CREDIT_PURCHASE_POLICY.maximum ||
    credits % CREDIT_PURCHASE_POLICY.step !== 0
  ) {
    return null
  }

  let amountCents = 0
  let pricedThrough = 0
  for (const tier of CREDIT_PURCHASE_POLICY.tiers) {
    const creditsInTier = Math.max(0, Math.min(credits, tier.upTo) - pricedThrough)
    amountCents += creditsInTier * tier.unitAmountCents
    pricedThrough = tier.upTo
    if (credits <= tier.upTo) break
  }

  return {
    credits,
    amountCents,
    amountUsd: amountCents / 100,
    effectiveUnitAmountCents: Math.round(amountCents / credits),
    validityMonths: CREDIT_PURCHASE_POLICY.validityMonths,
    pricingVersion: CREDIT_PURCHASE_POLICY.version,
  }
}

/** @deprecated Kept only to fulfil any pre-deployment Stripe Checkout session. */
export type CreditPackId = 'boost-100' | 'scale-300'

export interface CreditPackDefinition {
  id: CreditPackId
  credits: number
  priceUsd: number
  validityMonths: 12
  stripePriceEnvKey: 'STRIPE_PRICE_CREDITS_100' | 'STRIPE_PRICE_CREDITS_300'
}

export const CREDIT_PACKS: readonly CreditPackDefinition[] = [
  {
    id: 'boost-100',
    credits: 100,
    priceUsd: 29,
    validityMonths: 12,
    stripePriceEnvKey: 'STRIPE_PRICE_CREDITS_100',
  },
  {
    id: 'scale-300',
    credits: 300,
    priceUsd: 69,
    validityMonths: 12,
    stripePriceEnvKey: 'STRIPE_PRICE_CREDITS_300',
  },
] as const

export function getCreditPack(value: unknown): CreditPackDefinition | null {
  if (typeof value !== 'string') return null
  return CREDIT_PACKS.find((pack) => pack.id === value) ?? null
}
