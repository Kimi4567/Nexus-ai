/**
 * Nexus AI — Stripe client + Plan definitions
 *
 * Pricing (as of Sprint AI — professional cost-based repricing):
 *   Free     — $0      — 20 credits (one-time)  — 1 workspace, 2 campaigns, 0 videos
 *   Pro      — $49/mo  — 300 credits/month       — 3 workspaces, 20 campaigns, 5 videos/mo
 *   Business — $99/mo  — 1,000 credits/month     — 10 workspaces, 60 campaigns, 20 videos/mo
 *
 * Credit costs per action: see src/lib/credits.ts → CREDIT_COSTS
 * Video generation: separate monthly quota (NOT credits) — see PLAN_VIDEO_QUOTA
 * Referral bonus: +20 credits for both referrer and new user on signup
 *
 * Margin model (Pro, $49):
 *   Average user (5 videos + mixed text): ~$5.50 API cost → 88.8% gross margin
 *   Worst case (5 videos + 100 images):   ~$6.50 API cost → 86.7% gross margin
 */

import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY env var is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  typescript: true,
})

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
    id: 'pro',
    name: 'Pro',
    price: 49,
    credits: 300,
    stripePriceEnvKey: 'STRIPE_PRICE_PRO',
    highlight: 'Most Popular',
    cta: 'Start Pro — $49/mo',
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
    price: 99,
    credits: 1000,
    stripePriceEnvKey: 'STRIPE_PRICE_BUSINESS',
    cta: 'Start Business — $99/mo',
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
  PRO:      5,
  BUSINESS: 20,
  free:     0,
  pro:      5,
  business: 20,
  starter:  5,
  agency:   20,
  ACTIVE:   5,
  // Admin / founder accounts — unlimited video
  ADMIN:    999,
  admin:    999,
}

// ── Campaign count limit per plan (per month) ──────────────────────────────────
export const PLAN_CAMPAIGN_LIMIT: Record<string, number> = {
  FREE:     2,
  PRO:      20,
  BUSINESS: 60,
  free:     2,
  pro:      20,
  business: 60,
  starter:  20,
  agency:   60,
  ACTIVE:   20,
}

// ── Stripe Price ID mapping ────────────────────────────────────────────────────

export const STRIPE_PRICES: Record<string, string> = {
  pro:      process.env.STRIPE_PRICE_PRO      || '',
  business: process.env.STRIPE_PRICE_BUSINESS || '',
  // Legacy aliases
  starter:  process.env.STRIPE_PRICE_PRO      || '',
  agency:   process.env.STRIPE_PRICE_BUSINESS || '',
}

// ── Plan → monthly credit allocation ──────────────────────────────────────────

export const PLAN_CREDITS: Record<string, number> = {
  FREE:     20,
  PRO:      300,
  BUSINESS: 1000,
  free:     20,
  pro:      300,
  business: 1000,
  starter:  300,
  agency:   1000,
  ACTIVE:   300,
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
  if (normalized === 'PRO' || normalized === 'STARTER' || normalized === 'ACTIVE') return PLANS[1]
  return PLANS[0]
}
