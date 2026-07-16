/**
 * Nexus AI — Stripe client + Plan definitions
 *
 * Public pricing (July 2026): exactly two paid subscriptions.
 *   Trial     — $0      — 15 credits (one-time)
 *   Growth    — $49/mo  — 60 credits/month
 *   Autopilot — $99/mo  — 180 credits/month
 *
 * Internal IDs `pro` and `business` stay stable for Stripe and the database.
 * Legacy `starter` subscriptions remain supported but are no longer sold.
 *
 * Credit costs per action: see src/lib/credits.ts → CREDIT_COSTS
 * Referral bonus: +5 credits for both referrer and new user on signup
 */

import Stripe from 'stripe'
import {
  CREDIT_PURCHASE_POLICY,
  CREDIT_PACKS,
  FREE_TRIAL_CREDITS,
  FREE_TRIAL_POSTS,
  PUBLIC_PAID_PLANS,
  getCreditPack,
  getPublicPaidPlan,
  normalizePublicPaidPlan,
  type CreditPackId,
  type PublicPaidPlanId,
} from '@/lib/commercialPlans'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const billingFlag = process.env.NEXT_PUBLIC_BILLING_ENABLED

let stripeClient: Stripe | null = null

export function isBillingConfigured(): boolean {
  // Billing is an explicit opt-in.  A secret key alone must never make paid
  // checkout/webhooks live (for example while Stripe is being configured in a
  // preview environment).  Keep the default disabled until the operator sets
  // NEXT_PUBLIC_BILLING_ENABLED=true deliberately.
  // Require the webhook signing secret and both public subscription prices as
  // well.  A secret key by itself is not enough to run billing safely: without
  // the webhook Stripe payments cannot be reconciled, and without prices the
  // checkout route would advertise plans that can never be purchased.
  return billingFlag === 'true' && Boolean(stripeSecretKey) &&
    Boolean(process.env.STRIPE_WEBHOOK_SECRET) &&
    Boolean(process.env.STRIPE_PRICE_PRO) &&
    Boolean(process.env.STRIPE_PRICE_BUSINESS)
}

export function getBillingMode(): 'disabled' | 'sandbox' | 'live' {
  if (!isBillingConfigured()) return 'disabled'
  return stripeSecretKey?.includes('_test_') ? 'sandbox' : 'live'
}

export function getStripeClient(): Stripe {
  if (!stripeSecretKey) {
    throw new Error('Stripe billing is not configured. Missing STRIPE_SECRET_KEY.')
  }

  if (!stripeClient) {
    stripeClient = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      typescript: true,
    })
  }

  return stripeClient
}

export function billingNotConfiguredResponse() {
  return {
    error: 'Billing is not configured yet.',
    code: 'BILLING_NOT_CONFIGURED',
    billingEnabled: false,
  }
}

// ── Plan definitions ───────────────────────────────────────────────────────────

export interface PlanDefinition {
  id: string
  name: string
  displayName: string     // Human-facing name (Growth, Autopilot)
  price: number
  credits: number
  postsPerMonth: number   // Commercial monthly content allowance
  stripePriceEnvKey: string
  features: string[]
  highlight?: string
  cta: string
  researchNote?: string   // Why this post count was chosen
}

export const PLANS: PlanDefinition[] = [
  {
    id: 'free',
    name: 'Trial',
    displayName: 'Trial',
    price: 0,
    credits: FREE_TRIAL_CREDITS,
    postsPerMonth: FREE_TRIAL_POSTS,
    stripePriceEnvKey: '',
    cta: 'Get Started Free',
    researchNote: 'A bounded activation journey for validating the workflow before purchase.',
    features: [
      `${FREE_TRIAL_CREDITS} one-time AI trial credits`,
      '1 workspace',
      '1 campaign maximum',
      '3 AI posts to try',
      'Reviewed strategy draft',
      'Printable HTML + JSON export where available',
    ],
  },
  {
    id: 'pro',
    name: 'Growth',
    displayName: 'Growth',
    price: PUBLIC_PAID_PLANS[0].priceUsd,
    credits: PUBLIC_PAID_PLANS[0].monthlyCredits,
    postsPerMonth: PUBLIC_PAID_PLANS[0].postsPerMonth,
    stripePriceEnvKey: 'STRIPE_PRICE_PRO',
    highlight: 'Core plan',
    cta: 'Start Growth — $49/mo',
    researchNote: 'Built for a founder or small team running a reviewed content operation.',
    features: [
      `${PUBLIC_PAID_PLANS[0].monthlyCredits} AI credits / month (refreshes monthly)`,
      'Separate copy, media, scheduling, and publishing approvals',
      `Up to ${PUBLIC_PAID_PLANS[0].campaignLimit} campaign workspaces / month; AI operations use credits`,
      'Capacity example: 1 Full Standard workflow to drafts or 4 reviewed Organic Light strategies',
      `${PUBLIC_PAID_PLANS[0].postsPerMonth} planned posts / month`,
      'Supported platforms based on connected provider access',
      'Campaign Memory — reviewed signals across campaigns',
      'Media uploads + Brand overlays',
      'A/B Testing + AI Rewrite',
      'Verified platform analytics when eligible evidence is available',
      'Printable HTML + JSON export',
      'Human approval controls before publishing',
    ],
  },
  {
    id: 'business',
    name: 'Autopilot',
    displayName: 'Autopilot',
    price: PUBLIC_PAID_PLANS[1].priceUsd,
    credits: PUBLIC_PAID_PLANS[1].monthlyCredits,
    postsPerMonth: PUBLIC_PAID_PLANS[1].postsPerMonth,
    stripePriceEnvKey: 'STRIPE_PRICE_BUSINESS',
    cta: 'Start Autopilot — $99/mo',
    researchNote: 'Built for operators who need monitoring and higher execution capacity.',
    features: [
      `${PUBLIC_PAID_PLANS[1].monthlyCredits} AI credits / month (refreshes monthly)`,
      'Operations center with scheduled state and incident monitoring',
      `Up to ${PUBLIC_PAID_PLANS[1].campaignLimit} campaign workspaces / month; AI operations use credits`,
      'Capacity example: 3 Full Standard workflows to drafts or 12 reviewed Organic Light strategies',
      `${PUBLIC_PAID_PLANS[1].postsPerMonth} AI posts / month`,
      'Supported platform publishing when provider access allows',
      'Human approval queue before execution',
      'Printable HTML + JSON export',
      'Evidence-backed performance analytics',
      'Scheduled monitoring and evidence-backed action queue',
      'Provenance trail for performance recommendations',
    ],
  },
]

// ── Monthly video slot quota per plan ─────────────────────────────────────────
// Video slots = how many user-supplied video posts can be scheduled per month.
// Legacy plan keys remain for existing subscriptions; only Growth and Autopilot
// are offered to new customers.

export const PLAN_VIDEO_QUOTA: Record<string, number> = {
  FREE:     0,
  STARTER:  0,
  PRO:      2,
  BUSINESS: 5,
  free:     0,
  starter:  0,
  pro:      2,
  business: 5,
  agency:   5,
  ACTIVE:   2,
  // Admin / founder accounts — unlimited
  ADMIN:    999,
  admin:    999,
}

// ── Campaign count limit per plan (per month) ──────────────────────────────────
// Aligned with the commercial allowances above. Legacy plan keys remain for
// compatibility with already-created subscriptions and webhook records.

export const PLAN_CAMPAIGN_LIMIT: Record<string, number> = {
  FREE:     1,
  STARTER:  2,    // legacy plan; no longer sold
  PRO:      4,
  GROWTH:   4,    // Alias for PRO display name
  BUSINESS: 12,
  AGENCY:   12,
  ADMIN:    999,  // Admin / founder — unlimited
  free:     1,
  starter:  2,
  pro:      4,
  growth:   4,
  business: 12,
  agency:   12,
  admin:    999,
  ACTIVE:   4,    // Fallback for active subscriptions without explicit plan
}

// ── Stripe Price ID mapping ────────────────────────────────────────────────────

export const STRIPE_PRICES: Record<string, string> = {
  starter:  process.env.STRIPE_PRICE_STARTER  || '',
  pro:      process.env.STRIPE_PRICE_PRO      || '',
  business: process.env.STRIPE_PRICE_BUSINESS || '',
  // Aliases
  agency:   process.env.STRIPE_PRICE_BUSINESS || '',
}

/** Legacy fixed packs, retained only for already-created Checkout sessions. */
export const STRIPE_CREDIT_PACK_PRICES: Record<CreditPackId, string> = {
  'boost-100': process.env.STRIPE_PRICE_CREDITS_100 || '',
  'scale-300': process.env.STRIPE_PRICE_CREDITS_300 || '',
}

export function getConfiguredCreditPack(packId: unknown) {
  const pack = getCreditPack(packId)
  if (!pack) return null
  const priceId = STRIPE_CREDIT_PACK_PRICES[pack.id]
  return priceId ? { ...pack, priceId } : null
}

export function areCreditPacksConfigured(): boolean {
  return isCreditWalletPurchaseConfigured()
}

/**
 * Immutable one-time Stripe prices for each progressive wallet block. The
 * server splits a requested quantity across these prices, avoiding both client-
 * supplied amounts and one-off Price object creation on every checkout.
 */
export const STRIPE_CREDIT_WALLET_TIER_PRICES = [
  process.env.STRIPE_PRICE_CREDIT_WALLET_TIER_1 || '',
  process.env.STRIPE_PRICE_CREDIT_WALLET_TIER_2 || '',
  process.env.STRIPE_PRICE_CREDIT_WALLET_TIER_3 || '',
  process.env.STRIPE_PRICE_CREDIT_WALLET_TIER_4 || '',
] as const

export function isCreditWalletPurchaseConfigured(): boolean {
  return STRIPE_CREDIT_WALLET_TIER_PRICES.every(Boolean)
}

export function getCreditWalletLineItems(credits: number): Array<{ price: string; quantity: number }> | null {
  if (!isCreditWalletPurchaseConfigured()) return null
  const lineItems: Array<{ price: string; quantity: number }> = []
  let pricedThrough = 0

  for (let index = 0; index < CREDIT_PURCHASE_POLICY.tiers.length; index++) {
    const tier = CREDIT_PURCHASE_POLICY.tiers[index]
    const quantity = Math.max(0, Math.min(credits, tier.upTo) - pricedThrough)
    if (quantity > 0) {
      lineItems.push({ price: STRIPE_CREDIT_WALLET_TIER_PRICES[index], quantity })
    }
    pricedThrough = tier.upTo
    if (credits <= tier.upTo) break
  }

  return lineItems.length > 0 ? lineItems : null
}

/**
 * Stripe Price objects are immutable. When the commercial schedule changes,
 * stale environment IDs must fail closed instead of silently charging the old
 * unit amounts. This check is deliberately server-side and runs before a
 * Checkout Session is created.
 */
export async function validateCreditWalletStripePrices(stripe: Stripe): Promise<boolean> {
  if (!isCreditWalletPurchaseConfigured()) return false
  const prices = await Promise.all(
    STRIPE_CREDIT_WALLET_TIER_PRICES.map((priceId) => stripe.prices.retrieve(priceId)),
  )
  return prices.every((price, index) => (
    price.active === true
    && price.currency.toLowerCase() === CREDIT_PURCHASE_POLICY.currency
    && price.unit_amount === CREDIT_PURCHASE_POLICY.tiers[index].unitAmountCents
  ))
}

/**
 * Subscription Price IDs are configuration, not commercial truth. Verify the
 * immutable Stripe object before checkout so a stale/wrong ID cannot sell the
 * right plan name at the wrong amount, currency, or billing interval.
 */
export async function validateSubscriptionStripePrice(
  stripe: Stripe,
  planId: PublicPaidPlanId,
): Promise<boolean> {
  const priceId = STRIPE_PRICES[planId]
  const plan = getPublicPaidPlan(planId)
  if (!priceId || !plan) return false

  const price = await stripe.prices.retrieve(priceId)
  return price.active === true
    && price.currency.toLowerCase() === 'usd'
    && price.unit_amount === plan.priceUsd * 100
    && price.type === 'recurring'
    && price.recurring?.interval === 'month'
    && (price.recurring.interval_count ?? 1) === 1
}

// ── Plan → monthly credit allocation ──────────────────────────────────────────
// Matches PLANS array exactly. Credits refresh monthly on paid plans.
// Free credits are one-time (never refresh) — creates upgrade pressure.

export const PLAN_CREDITS: Record<string, number> = {
  FREE:     FREE_TRIAL_CREDITS,
  STARTER:  50,
  PRO:      60,
  BUSINESS: 180,
  free:     FREE_TRIAL_CREDITS,
  starter:  50,
  pro:      60,
  business: 180,
  agency:   180,
  ACTIVE:   60,
  ADMIN:    9999,
  admin:    9999,
}

// ── Content Hub: monthly post + video quotas ──────────────────────────────────
// These are product allowances, not promises about posting frequency,
// performance, generation cost, or margin. Legacy keys remain for compatibility.

export interface PlanQuota {
  postsPerMonth: number        // monthly generated-content allowance
  videoSlotsPerMonth: number   // scheduled slots for user-supplied video
  postsPerCampaign: number     // how many posts to generate per content plan run
}

export const PLAN_QUOTAS: Record<string, PlanQuota> = {
  FREE:     { postsPerMonth: FREE_TRIAL_POSTS, videoSlotsPerMonth: 0, postsPerCampaign: FREE_TRIAL_POSTS },
  STARTER:  { postsPerMonth: 10,  videoSlotsPerMonth: 0,  postsPerCampaign: 12 },
  PRO:      { postsPerMonth: 16,  videoSlotsPerMonth: 2,  postsPerCampaign: 16 },
  BUSINESS: { postsPerMonth: 40,  videoSlotsPerMonth: 5,  postsPerCampaign: 20 },
  free:     { postsPerMonth: FREE_TRIAL_POSTS, videoSlotsPerMonth: 0, postsPerCampaign: FREE_TRIAL_POSTS },
  starter:  { postsPerMonth: 10,  videoSlotsPerMonth: 0,  postsPerCampaign: 12 },
  pro:      { postsPerMonth: 16,  videoSlotsPerMonth: 2,  postsPerCampaign: 16 },
  business: { postsPerMonth: 40,  videoSlotsPerMonth: 5,  postsPerCampaign: 20 },
  agency:   { postsPerMonth: 40,  videoSlotsPerMonth: 5,  postsPerCampaign: 20 },
  ACTIVE:   { postsPerMonth: 16,  videoSlotsPerMonth: 2,  postsPerCampaign: 16 },
  ADMIN:    { postsPerMonth: 999, videoSlotsPerMonth: 99, postsPerCampaign: 16 },
  admin:    { postsPerMonth: 999, videoSlotsPerMonth: 99, postsPerCampaign: 16 },
}

// ── Referral bonus credits ─────────────────────────────────────────────────────

export const REFERRAL_BONUS_CREDITS = 5

// ── Price ID → plan name (reverse lookup for webhooks) ────────────────────────

export type StripeSubscriptionPlan = 'starter' | PublicPaidPlanId

function canonicalSubscriptionPlan(value: unknown): StripeSubscriptionPlan | null {
  if (typeof value !== 'string') return null
  if (value.trim().toLowerCase() === 'starter') return 'starter'
  return normalizePublicPaidPlan(value)
}

export function planFromPriceId(priceId: string): StripeSubscriptionPlan | null {
  for (const [plan, pid] of Object.entries(STRIPE_PRICES)) {
    if (pid && pid === priceId) return canonicalSubscriptionPlan(plan)
  }
  return null
}

/** Price ID is authoritative; optional metadata must agree with it. */
export function resolveStripeSubscriptionPlan(
  priceId: string,
  metadataPlan?: unknown,
): StripeSubscriptionPlan | null {
  const pricePlan = planFromPriceId(priceId)
  if (!pricePlan) return null
  if (metadataPlan === undefined || metadataPlan === null || metadataPlan === '') return pricePlan
  const declaredPlan = canonicalSubscriptionPlan(metadataPlan)
  return declaredPlan === pricePlan ? pricePlan : null
}

// ── Plan from subscription status ─────────────────────────────────────────────

export function planFromStatus(status: string): PlanDefinition {
  const normalized = status?.toUpperCase()
  if (normalized === 'BUSINESS' || normalized === 'AGENCY') return PLANS[2]
  if (normalized === 'PRO' || normalized === 'ACTIVE' || normalized === 'STARTER') return PLANS[1]
  return PLANS[0]
}
