/**
 * Nexus AI — Stripe client + Plan definitions
 *
 * Pricing:
 *   Free     — $0       — 20 credits (one-time)  — 1 workspace, 2 campaigns, 0 videos
 *   Starter  — $29/mo   — 150 credits/month       — 2 workspaces, 8 campaigns, 2 videos/mo
 *   Pro      — $79/mo   — 300 credits/month       — 3 workspaces, 20 campaigns, 5 videos/mo
 *   Business — $199/mo  — 1,000 credits/month     — 10 workspaces, 60 campaigns, 20 videos/mo
 *
 * Credit costs per action: see src/lib/credits.ts → CREDIT_COSTS
 * Video generation: separate monthly quota (NOT credits) — see PLAN_VIDEO_QUOTA
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
  price: number
  credits: number
  stripePriceEnvKey: string
  features: string[]
  highlight?: string
  cta: string
}

export const PLANS: PlanDefinition[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    credits: 20,
    stripePriceEnvKey: '',
    cta: 'Get Started Free',
    features: [
      '20 AI credits — one-time (never refreshes)',
      '1 workspace',
      '2 campaigns maximum',
      '2 social platforms',
      'No video generation',
      'Watermarked exports',
      'Community support',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 29,
    credits: 150,
    stripePriceEnvKey: 'STRIPE_PRICE_STARTER',
    cta: 'Start Starter — $29/mo',
    features: [
      '150 AI credits / month (refreshes monthly)',
      '2 workspaces',
      '8 campaigns / month',
      '50 posts / month',
      '3 social platforms',
      '2 AI videos / month',
      'Full Brand Brain + all AI agents',
      'No-watermark exports',
      'Email support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 79,
    credits: 300,
    stripePriceEnvKey: 'STRIPE_PRICE_PRO',
    highlight: 'Most Popular',
    cta: 'Start Pro — $79/mo',
    features: [
      '300 AI credits / month (refreshes monthly)',
      '3 workspaces',
      '20 campaigns / month',
      '100 posts / month',
      'All 5 social platforms',
      '5 AI videos / month (Replicate)',
      'Full Brand Brain + all AI agents',
      'Analytics dashboard',
      'Export campaigns (PDF + DOCX)',
      'Email support',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    price: 199,
    credits: 1000,
    stripePriceEnvKey: 'STRIPE_PRICE_BUSINESS',
    cta: 'Start Business — $199/mo',
    features: [
      '1,000 AI credits / month (refreshes monthly)',
      '10 workspaces',
      '60 campaigns / month',
      'Unlimited posts',
      'All 5 social platforms',
      '20 AI videos / month',
      'Team collaboration (3 seats)',
      'White-label PDF exports',
      'Advanced analytics',
      'Priority support',
    ],
  },
]

// ── Monthly video generation quota per plan ────────────────────────────────────
// Video generation costs $0.30–$1.00/video via Replicate — too expensive to gate
// behind credits alone. These hard monthly limits protect margins regardless of
// how many credits a user has.

export const PLAN_VIDEO_QUOTA: Record<string, number> = {
  FREE:     0,
  STARTER:  2,
  PRO:      5,
  BUSINESS: 20,
  free:     0,
  starter:  2,
  pro:      5,
  business: 20,
  agency:   20,
  ACTIVE:   5,
  // Admin / founder accounts — unlimited video
  ADMIN:    999,
  admin:    999,
}

// ── Campaign count limit per plan (per month) ──────────────────────────────────
export const PLAN_CAMPAIGN_LIMIT: Record<string, number> = {
  FREE:     2,
  STARTER:  8,
  PRO:      20,
  BUSINESS: 60,
  free:     2,
  starter:  8,
  pro:      20,
  business: 60,
  agency:   60,
  ACTIVE:   20,
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

export const PLAN_CREDITS: Record<string, number> = {
  FREE:     20,
  STARTER:  150,
  PRO:      300,
  BUSINESS: 1000,
  free:     20,
  starter:  150,
  pro:      300,
  business: 1000,
  agency:   1000,
  ACTIVE:   300,
}

// ── Content Hub: monthly post + video quotas ──────────────────────────────────
// Posts cost ~$0.05 each (GPT-4o-mini text + gpt-image-1). Videos cost ~$0.50
// each (Replicate). Margins: 93-94% across all paid tiers.
// Videos are the cost driver — gate them hard. Posts are cheap — be generous.

export interface PlanQuota {
  postsPerMonth: number   // image posts — auto-generated by AI (~$0.05 each)
  videoSlotsPerMonth: number  // video post slots — user uploads their own video (no AI cost)
}

export const PLAN_QUOTAS: Record<string, PlanQuota> = {
  FREE:     { postsPerMonth: 5,   videoSlotsPerMonth: 0  },
  STARTER:  { postsPerMonth: 20,  videoSlotsPerMonth: 2  },
  PRO:      { postsPerMonth: 50,  videoSlotsPerMonth: 5  },
  BUSINESS: { postsPerMonth: 120, videoSlotsPerMonth: 15 },
  free:     { postsPerMonth: 5,   videoSlotsPerMonth: 0  },
  starter:  { postsPerMonth: 20,  videoSlotsPerMonth: 2  },
  pro:      { postsPerMonth: 50,  videoSlotsPerMonth: 5  },
  business: { postsPerMonth: 120, videoSlotsPerMonth: 15 },
  agency:   { postsPerMonth: 120, videoSlotsPerMonth: 15 },
  ACTIVE:   { postsPerMonth: 50,  videoSlotsPerMonth: 5  },
  ADMIN:    { postsPerMonth: 500, videoSlotsPerMonth: 50 },
  admin:    { postsPerMonth: 500, videoSlotsPerMonth: 50 },
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
