/**
 * Public commercial contract.
 *
 * Keep this module dependency-free and client-safe. Stripe price IDs stay in
 * server-only lib/stripe.ts; this file contains product names, allowances, and
 * the strict IDs accepted by checkout routes.
 */

export type PublicPaidPlanId = 'pro' | 'business'

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
