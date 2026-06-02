/**
 * Nexus AI — Stripe client + Plan definitions
 *
 * Pricing (as of Sprint AH):
 *   Free     — $0      — 10 credits/month   — brand brain + strategy only
 *   Pro      — $29/mo  — 150 credits/month  — everything: autopilot, publishing, analytics
 *   Business — $79/mo  — 600 credits/month  — everything Pro + 3 workspaces + priority
 *
 * Credit costs per action: see src/lib/credits.ts → CREDIT_COSTS
 * Referral bonus: +20 credits for both referrer and new user on signup
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
    credits: 10,
    stripePriceEnvKey: '',
    cta: 'Get Started Free',
    features: [
      '10 AI credits / month',
      '1 active campaign',
      'Brand Brain (core fields)',
      'AI Strategy generation',
      'Content calendar view',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 29,
    credits: 150,
    stripePriceEnvKey: 'STRIPE_PRICE_PRO',
    highlight: 'Most Popular',
    cta: 'Start Pro — $29/mo',
    features: [
      '150 AI credits / month',
      'Unlimited campaigns',
      'Full Brand Brain',
      'All AI agents (Strategist, Sentinel, Visual Director)',
      'Social publishing — Facebook, Instagram, LinkedIn, TikTok',
      'Autopilot — set & forget for 4 weeks',
      'Analytics dashboard',
      'Weekly Intelligence Brief email',
      'Export campaigns (PDF + DOCX)',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    price: 79,
    credits: 600,
    stripePriceEnvKey: 'STRIPE_PRICE_BUSINESS',
    cta: 'Start Business — $79/mo',
    features: [
      '600 AI credits / month',
      'Everything in Pro',
      '3 workspaces (for agencies / teams)',
      'Priority email support',
      'Advanced analytics',
      'White-label PDF exports',
    ],
  },
]

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
  FREE:     10,
  PRO:      150,
  BUSINESS: 600,
  free:     10,
  pro:      150,
  business: 600,
  starter:  150,
  agency:   600,
  ACTIVE:   150,
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
