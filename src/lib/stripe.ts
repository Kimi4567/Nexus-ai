/**
 * Nexus AI — Stripe client + Plan definitions
 *
 * Pricing (Research-backed — June 2025):
 *   Free    — $0      — 10 credits (one-time) — 1 workspace, 1 campaign, 3 posts
 *   Starter — $19/mo  — 50 credits/month      — 1 workspace, 2 campaigns, 10 posts/mo
 *   Growth  — $49/mo  — 150 credits/month     — 3 workspaces, 5 campaigns, 25 posts/mo  ← crosses 16+ post threshold
 *   Agency  — $99/mo  — 500 credits/month     — 10 workspaces, unlimited campaigns, 60 posts/mo
 *
 * Research basis:
 *   - 16+ posts/month = 4.5x more leads (HubSpot State of Marketing)
 *   - Starter is deliberately below this threshold → natural upgrade pressure to Growth
 *   - Growth (25 posts) crosses the 16+ threshold for 2-3 active platforms
 *   - Agency (60 posts) covers 3-4 clients at the 16-20/mo optimal level each
 *
 * Display names: Starter (id: starter), Growth (id: pro), Agency (id: business)
 * Plan IDs kept backward compatible for Stripe price ID lookups.
 *
 * Credit costs per action: see src/lib/credits.ts → CREDIT_COSTS
 * Referral bonus: +20 credits for both referrer and new user on signup
 */

import Stripe from 'stripe'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const billingFlag = process.env.NEXT_PUBLIC_BILLING_ENABLED

let stripeClient: Stripe | null = null

export function isBillingConfigured(): boolean {
  return billingFlag !== 'false' && Boolean(stripeSecretKey)
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
  displayName: string     // Human-facing name (Growth, Agency)
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
    credits: 10,
    postsPerMonth: 3,
    stripePriceEnvKey: '',
    cta: 'Get Started Free',
    researchNote: 'Enough to experience the product — not enough for real marketing results',
    features: [
      '10 AI credits — one-time (never refreshes)',
      '1 workspace',
      '1 campaign maximum',
      '3 AI posts to try',
      '1 social platform',
      'Watermarked exports',
      'Community support',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    displayName: 'Starter',
    price: 19,
    credits: 50,
    postsPerMonth: 10,
    stripePriceEnvKey: 'STRIPE_PRICE_STARTER',
    cta: 'Start Starter — $19/mo',
    researchNote: '10 posts/mo = consistent presence on 1-2 platforms. Below the lead-gen threshold by design.',
    features: [
      '50 AI credits / month (refreshes monthly)',
      '1 workspace (1 brand)',
      '2 campaigns / month',
      '10 AI posts / month',
      '2 social platforms',
      'Full Campaign Wizard',
      'Brand Brain (memory across campaigns)',
      'No-watermark exports',
      'Email support',
    ],
  },
  {
    id: 'pro',
    name: 'Growth',
    displayName: 'Growth',
    price: 49,
    credits: 150,
    postsPerMonth: 25,
    stripePriceEnvKey: 'STRIPE_PRICE_PRO',
    highlight: 'Most Popular',
    cta: 'Start Growth — $49/mo',
    researchNote: '25 posts/mo crosses the research-proven 16+ threshold = 4.5x more leads (HubSpot)',
    features: [
      '150 AI credits / month (refreshes monthly)',
      '3 workspaces (3 brands)',
      '5 campaigns / month',
      '25 AI posts / month — crosses the 16+ leads threshold',
      'All social platforms (unlimited)',
      'Campaign Memory — AI learns your brand',
      'Media uploads + Brand overlays',
      'A/B Testing + AI Rewrite',
      'Analytics + ROI Dashboard',
      'PDF + DOCX export',
      'Priority email support',
    ],
  },
  {
    id: 'business',
    name: 'Agency',
    displayName: 'Agency',
    price: 99,
    credits: 500,
    postsPerMonth: 60,
    stripePriceEnvKey: 'STRIPE_PRICE_BUSINESS',
    cta: 'Start Agency — $99/mo',
    researchNote: '60 posts/mo = 3-4 clients each at the optimal 16-20 posts/month level',
    features: [
      '500 AI credits / month (refreshes monthly)',
      '10 workspaces (10 brands / clients)',
      'Unlimited campaigns / month',
      '60 AI posts / month',
      'All social platforms + multi-account publishing',
      '2 team seats included (+$19/extra)',
      'White-label reports (your logo)',
      'API access',
      'Advanced analytics',
      'Dedicated Slack support + onboarding call',
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
  FREE:     3,    // Raised to 3 — users need room to test the product
  STARTER:  5,
  PRO:      10,
  GROWTH:   10,   // Alias for PRO display name
  BUSINESS: 999,
  AGENCY:   999,
  ADMIN:    999,  // Admin / founder — unlimited
  free:     3,
  starter:  5,
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

// ── Plan → monthly credit allocation ──────────────────────────────────────────
// Matches PLANS array exactly. Credits refresh monthly on paid plans.
// Free credits are one-time (never refresh) — creates upgrade pressure.

export const PLAN_CREDITS: Record<string, number> = {
  FREE:     10,
  STARTER:  50,
  PRO:      150,
  BUSINESS: 500,
  free:     10,
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
  FREE:     { postsPerMonth: 3,   videoSlotsPerMonth: 0,  postsPerCampaign: 8  },
  STARTER:  { postsPerMonth: 10,  videoSlotsPerMonth: 0,  postsPerCampaign: 12 },
  PRO:      { postsPerMonth: 25,  videoSlotsPerMonth: 2,  postsPerCampaign: 16 },
  BUSINESS: { postsPerMonth: 60,  videoSlotsPerMonth: 5,  postsPerCampaign: 20 },
  free:     { postsPerMonth: 3,   videoSlotsPerMonth: 0,  postsPerCampaign: 8  },
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
  if (normalized === 'BUSINESS' || normalized === 'AGENCY') return PLANS[3]
  if (normalized === 'PRO' || normalized === 'ACTIVE') return PLANS[2]
  if (normalized === 'STARTER') return PLANS[1]
  return PLANS[0]
}
