/**
 * Nexus AI — Stripe client + Plan definitions
 *
 * Public pricing (July 2026): exactly two paid subscriptions.
 *   Trial     — $0      — 12 credits (one-time, 14 days)
 *   Growth    — $49/mo  — 150 credits/month
 *   Autopilot — $99/mo  — 500 credits/month
 *
 * Internal IDs `pro` and `business` stay stable for Stripe and the database.
 * Legacy `starter` subscriptions remain supported but are no longer sold.
 *
 * Credit costs per action: see src/lib/credits.ts → CREDIT_COSTS
 * Referral bonus: +20 credits for both referrer and new user on signup
 */

import Stripe from 'stripe'
import {
  CREDIT_PURCHASE_POLICY,
  CREDIT_PACKS,
  FREE_TRIAL_CREDITS,
  FREE_TRIAL_POSTS,
  PUBLIC_PAID_PLANS,
  getCreditPack,
  type CreditPackId,
} from '@/lib/commercialPlans'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const billingFlag = process.env.NEXT_PUBLIC_BILLING_ENABLED

let stripeClient: Stripe | null = null

export function isBillingConfigured(): boolean {
  return billingFlag !== 'false' && Boolean(stripeSecretKey)
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
  postsPerMonth: number   // Research-backed content volume
  stripePriceEnvKey: string
  features: string[]
  highlight?: string
  cta: string
  researchNote?: string   // Why this post count was chosen
}

export const PLANS: PlanDefinition[] = [
  {
    id: 'free',
    name: 'Free',
    displayName: 'Free',
    price: 0,
    credits: FREE_TRIAL_CREDITS,
    postsPerMonth: FREE_TRIAL_POSTS,
    stripePriceEnvKey: '',
    cta: 'Get Started Free',
    researchNote: 'Enough to experience the product — not enough for real marketing results',
    features: [
      `${FREE_TRIAL_CREDITS} AI credits — 14-day trial`,
      '1 workspace',
      '1 campaign maximum',
      '3 AI posts to try',
      '1 social platform',
      'Watermarked exports',
      'Community support',
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
    highlight: 'Most Popular',
    cta: 'Start Growth — $49/mo',
    researchNote: 'Built for a founder or small team operating up to three brands.',
    features: [
      '150 AI credits / month (refreshes monthly)',
      '3 workspaces (3 brands)',
      '10 campaigns / month',
      '25 planned posts / month',
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
    researchNote: 'Built for multi-brand operators who need monitoring and higher execution capacity.',
    features: [
      '500 AI credits / month (refreshes monthly)',
      '10 workspaces (10 brands / clients)',
      'Unlimited campaigns / month',
      '60 AI posts / month',
      'Supported platform publishing when provider access allows',
      'Human approval queue before execution',
      'Printable HTML + JSON export',
      'Evidence-backed performance analytics',
      'Always-on scheduled monitoring and action queue',
      'Provenance trail for performance recommendations',
    ],
  },
]

// ── Monthly video slot quota per plan ─────────────────────────────────────────
// Video slots = how many video posts a user can schedule per month.
// Free/Starter: no video (AI image posts only — keeps COGS near zero).
// Growth: 2 video slots (enough for 1 short-form/platform on 2 platforms).
// Agency: 5 video slots (covers 1 video per client per month).

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
// Aligned with PLANS array research notes.
// Free: 1 (taste the product). Starter: 2 (1 brand, 2 concurrent campaigns).
// Growth: 5 (3 brands × 1-2 campaigns each). Agency: unlimited (10 clients).

export const PLAN_CAMPAIGN_LIMIT: Record<string, number> = {
  FREE:     1,
  STARTER:  2,    // legacy plan; no longer sold
  PRO:      10,
  GROWTH:   10,   // Alias for PRO display name
  BUSINESS: 999,
  AGENCY:   999,
  ADMIN:    999,  // Admin / founder — unlimited
  free:     1,
  starter:  2,
  pro:      10,
  growth:   10,
  business: 999,
  agency:   999,
  admin:    999,
  ACTIVE:   10,   // Fallback for active subscriptions without explicit plan
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

// ── Plan → monthly credit allocation ──────────────────────────────────────────
// Matches PLANS array exactly. Credits refresh monthly on paid plans.
// Free credits are one-time (never refresh) — creates upgrade pressure.

export const PLAN_CREDITS: Record<string, number> = {
  FREE:     FREE_TRIAL_CREDITS,
  STARTER:  50,
  PRO:      150,
  BUSINESS: 500,
  free:     FREE_TRIAL_CREDITS,
  starter:  50,
  pro:      150,
  business: 500,
  agency:   500,
  ACTIVE:   150,
  ADMIN:    9999,
  admin:    9999,
}

// ── Content Hub: monthly post + video quotas ──────────────────────────────────
// Research basis (HubSpot / SproutSocial / Hootsuite 2024):
//   Free    →  3 posts/mo  — taste the product only
//   Starter → 10 posts/mo  — consistent presence, BELOW the 16+ lead-gen threshold (by design)
//   Growth  → 25 posts/mo  — crosses the research-proven 16+ threshold (+4.5x leads)
//   Agency  → 60 posts/mo  — 3-4 clients at 16-20/mo each (optimal agency load)
// Post COGS: ~$0.05 each (GPT-4o-mini + gpt-image-1). Margins: 96%+.

export interface PlanQuota {
  postsPerMonth: number        // AI-generated image/caption posts (~$0.05 each)
  videoSlotsPerMonth: number   // scheduled video post slots (user uploads own video — $0 COGS)
  postsPerCampaign: number     // how many posts to generate per content plan run
}

export const PLAN_QUOTAS: Record<string, PlanQuota> = {
  FREE:     { postsPerMonth: FREE_TRIAL_POSTS, videoSlotsPerMonth: 0, postsPerCampaign: FREE_TRIAL_POSTS },
  STARTER:  { postsPerMonth: 10,  videoSlotsPerMonth: 0,  postsPerCampaign: 12 },
  PRO:      { postsPerMonth: 25,  videoSlotsPerMonth: 2,  postsPerCampaign: 16 },
  BUSINESS: { postsPerMonth: 60,  videoSlotsPerMonth: 5,  postsPerCampaign: 20 },
  free:     { postsPerMonth: FREE_TRIAL_POSTS, videoSlotsPerMonth: 0, postsPerCampaign: FREE_TRIAL_POSTS },
  starter:  { postsPerMonth: 10,  videoSlotsPerMonth: 0,  postsPerCampaign: 12 },
  pro:      { postsPerMonth: 25,  videoSlotsPerMonth: 2,  postsPerCampaign: 16 },
  business: { postsPerMonth: 60,  videoSlotsPerMonth: 5,  postsPerCampaign: 20 },
  agency:   { postsPerMonth: 60,  videoSlotsPerMonth: 5,  postsPerCampaign: 20 },
  ACTIVE:   { postsPerMonth: 25,  videoSlotsPerMonth: 2,  postsPerCampaign: 16 },
  ADMIN:    { postsPerMonth: 999, videoSlotsPerMonth: 99, postsPerCampaign: 16 },
  admin:    { postsPerMonth: 999, videoSlotsPerMonth: 99, postsPerCampaign: 16 },
}

// ── Referral bonus credits ─────────────────────────────────────────────────────

export const REFERRAL_BONUS_CREDITS = 20

// ── Price ID → plan name (reverse lookup for webhooks) ────────────────────────

export function planFromPriceId(priceId: string): string {
  for (const [plan, pid] of Object.entries(STRIPE_PRICES)) {
    if (pid && pid === priceId) return plan
  }
  return 'pro'
}

// ── Plan from subscription status ─────────────────────────────────────────────

export function planFromStatus(status: string): PlanDefinition {
  const normalized = status?.toUpperCase()
  if (normalized === 'BUSINESS' || normalized === 'AGENCY') return PLANS[2]
  if (normalized === 'PRO' || normalized === 'ACTIVE' || normalized === 'STARTER') return PLANS[1]
  return PLANS[0]
}
