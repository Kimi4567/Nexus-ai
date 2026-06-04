/**
 * POST /api/billing/checkout
 * Creates a Stripe Checkout Session and returns the URL.
 *
 * Body: { plan: 'starter' | 'pro' | 'business' }
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { prisma } from '@/lib/prisma'
import {
  billingNotConfiguredResponse,
  getStripeClient,
  isBillingConfigured,
  STRIPE_PRICES,
} from '@/lib/stripe'
import { checkoutRateLimit } from '@/lib/dbRateLimit'

function getBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
}

export async function POST(req: NextRequest) {
  try {
    if (!isBillingConfigured()) {
      return NextResponse.json(billingNotConfiguredResponse(), { status: 503 })
    }

    // ── Authenticate ─────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await adminClient.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit: 5 checkout attempts per minute per user
    if (!checkoutRateLimit(user.id)) return NextResponse.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })

    // ── Parse body ──────────────────────────────────────────────────────────
    let plan: string
    try {
      const body = await req.json()
      plan = (body.plan as string)?.toLowerCase()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const priceId = STRIPE_PRICES[plan]
    if (!priceId) {
      return NextResponse.json(
        { error: `Unknown or unconfigured plan "${plan}". Valid configured plans: starter, pro, business` },
        { status: 400 }
      )
    }

    // ── Ensure Stripe customer ──────────────────────────────────────────────
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { stripeCustomerId: true, email: true, name: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    let customerId = dbUser.stripeCustomerId
    const stripe = getStripeClient()

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: dbUser.email,
        name:  dbUser.name ?? undefined,
        metadata: { userId: user.id },
      })
      customerId = customer.id
      await prisma.user.update({
        where: { id: user.id },
        data:  { stripeCustomerId: customerId },
      })
    }

    const baseUrl = getBaseUrl()

    // ── Create Checkout Session ─────────────────────────────────────────────
    const session = await stripe.checkout.sessions.create({
      customer:   customerId,
      mode:       'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${baseUrl}/billing?cancelled=1`,
      subscription_data: {
        metadata: { userId: user.id, plan },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      customer_update: { address: 'auto' },
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('[Billing Checkout] Error:', err?.message || err)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
