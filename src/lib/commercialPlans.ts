/**
 * Public commercial contract.
 *
 * Keep this module dependency-free and client-safe. Stripe price IDs stay in
 * server-only lib/stripe.ts; this file contains product names, allowances, and
 * the strict IDs accepted by checkout routes.
 */

export type PublicPaidPlanId = 'pro' | 'business'

// One complete activation journey: strategy (8) + quality review (2) +
// Content Hub plan (2). Keep the post sample deliberately small.
export const FREE_TRIAL_CREDITS = 12
export const FREE_TRIAL_POSTS = 3

export interface PublicPaidPlan {
  id: PublicPaidPlanId
  slug: 'growth' | 'autopilot'
  name: 'Growth' | 'Autopilot'
  priceUsd: number
  monthlyCredits: number
  postsPerMonth: number
  workspaces: number
  campaignLimit: number
}

export const PUBLIC_PAID_PLANS: readonly PublicPaidPlan[] = [
  {
    id: 'pro',
    slug: 'growth',
    name: 'Growth',
    priceUsd: 49,
    monthlyCredits: 150,
    postsPerMonth: 25,
    workspaces: 3,
    campaignLimit: 10,
  },
  {
    id: 'business',
    slug: 'autopilot',
    name: 'Autopilot',
    priceUsd: 99,
    monthlyCredits: 500,
    postsPerMonth: 60,
    workspaces: 10,
    campaignLimit: 999,
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
  if (normalized === 'BUSINESS' || normalized === 'AGENCY') return 10
  if (normalized === 'PRO' || normalized === 'GROWTH' || normalized === 'ACTIVE') return 3
  return 1 // FREE + legacy STARTER
}

/** Monthly campaign creation allowance, including legacy/internal statuses. */
export function getCampaignLimit(plan: unknown, role?: unknown): number {
  if (String(role).toUpperCase() === 'ADMIN') return 999
  const normalized = String(plan || 'FREE').toUpperCase()
  if (normalized === 'BUSINESS' || normalized === 'AGENCY') return 999
  if (normalized === 'PRO' || normalized === 'GROWTH' || normalized === 'ACTIVE') return 10
  if (normalized === 'STARTER') return 2
  return 1
}

/** Monthly AI-planned post allowance; manual user-authored posts are excluded. */
export function getPlannedPostLimit(plan: unknown, role?: unknown): number {
  if (String(role).toUpperCase() === 'ADMIN') return 999
  const normalized = String(plan || 'FREE').toUpperCase()
  if (normalized === 'BUSINESS' || normalized === 'AGENCY') return 60
  if (normalized === 'PRO' || normalized === 'GROWTH' || normalized === 'ACTIVE') return 25
  if (normalized === 'STARTER') return 10
  return 3
}

// ── One-time credit wallet purchases ────────────────────────────────────────

/**
 * Versioned, server-enforced pricing policy for one-time wallet purchases.
 * Progressive blocks keep the total monotonic: buying one more block can never
 * make the whole purchase cheaper. The 100/300 reference points preserve the
 * original $29/$69 commercial offer while allowing any 10-credit increment.
 */
export const CREDIT_PURCHASE_POLICY = {
  version: '2026-07-v1',
  currency: 'usd',
  minimum: 50,
  maximum: 5_000,
  step: 10,
  validityMonths: 12,
  tiers: [
    { upTo: 100, unitAmountCents: 29 },
    { upTo: 300, unitAmountCents: 20 },
    { upTo: 1_000, unitAmountCents: 17 },
    { upTo: 5_000, unitAmountCents: 14 },
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
