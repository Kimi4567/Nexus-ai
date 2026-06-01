/**
 * Nexus AI — Stripe client singleton
 * Always import from here, never `new Stripe(...)` inline.
 */
import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY env var is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  typescript: true,
})

// ── Plan → Stripe Price ID mapping ────────────────────────────────────────────
// Set these in Vercel → Environment Variables after creating products in Stripe Dashboard.

export const STRIPE_PRICES: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER || '',
  pro:     process.env.STRIPE_PRICE_PRO     || '',
  agency:  process.env.STRIPE_PRICE_AGENCY  || '',
}

// ── Plan → monthly credit allocation ──────────────────────────────────────────
// -1 = unlimited (Agency)

export const PLAN_CREDITS: Record<string, number> = {
  starter: 50,
  pro:     200,
  agency:  -1,
}

// ── Price ID → plan name (reverse lookup for webhooks) ────────────────────────

export function planFromPriceId(priceId: string): string {
  for (const [plan, pid] of Object.entries(STRIPE_PRICES)) {
    if (pid && pid === priceId) return plan
  }
  return 'starter'
}
