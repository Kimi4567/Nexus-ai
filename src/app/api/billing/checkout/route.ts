/**
 * POST /api/billing/checkout
 * Creates a Stripe Checkout Session and returns the URL.
 *
 * Body: { plan: 'growth' | 'autopilot' | 'pro' | 'business' }
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { prisma } from '@/lib/prisma'
import {
  billingNotConfiguredResponse,
  getStripeClient,
  isBillingConfigured,
  STRIPE_PRICES,
  validateSubscriptionStripePrice,
} from '@/lib/stripe'
import { checkoutRateLimit } from '@/lib/dbRateLimit'
import { normalizePublicPaidPlan } from '@/lib/commercialPlans'
import { getRequestBaseUrl } from '@/lib/requestBaseUrl'
import {
  billingDatabaseUnavailableResponse,
  getBillingDatabaseReadiness,
} from '@/lib/billingDatabaseReadiness'

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

    const billingDatabase = await getBillingDatabaseReadiness()
    if (!billingDatabase.ready) {
      return NextResponse.json(billingDatabaseUnavailableResponse(billingDatabase), { status: 503 })
    }

    // Rate limit: 5 checkout attempts per minute per user
    if (!checkoutRateLimit(user.id)) return NextResponse.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })

    // ── Parse body ──────────────────────────────────────────────────────────
    let requestedPlan: unknown
    let requestId = ''
    try {
      const body = await req.json()
      requestedPlan = body.plan
      requestId = typeof body.requestId === 'string' ? body.requestId : ''
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    if (!/^[A-Za-z0-9_-]{16,80}$/.test(requestId)) {
      return NextResponse.json({
        error: 'A valid checkout request ID is required.',
        code: 'INVALID_CHECKOUT_REQUEST_ID',
      }, { status: 400 })
    }

    const plan = normalizePublicPaidPlan(requestedPlan)
    if (!plan) {
      return NextResponse.json(
        { error: 'Unknown plan. Available paid plans: growth and autopilot.' },
        { status: 400 },
      )
    }

    const priceId = STRIPE_PRICES[plan]
    if (!priceId) {
      return NextResponse.json(
        { error: `The ${plan === 'pro' ? 'Growth' : 'Autopilot'} Stripe price is not configured.` },
        { status: 400 }
      )
    }

    const stripe = getStripeClient()
    if (!await validateSubscriptionStripePrice(stripe, plan)) {
      return NextResponse.json({
        error: 'The configured Stripe price does not match the current subscription schedule.',
        code: 'SUBSCRIPTION_PRICE_MISMATCH',
      }, { status: 503 })
    }

    // ── Ensure Stripe customer ──────────────────────────────────────────────
    const [dbUser, existingSubscription] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: { stripeCustomerId: true, email: true, name: true },
      }),
      prisma.subscription.findUnique({
        where: { userId: user.id },
        select: { stripeId: true, status: true },
      }),
    ])

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (
      existingSubscription?.stripeId &&
      ['ACTIVE', 'PAST_DUE'].includes(String(existingSubscription.status))
    ) {
      return NextResponse.json({
        error: 'Manage or change the existing subscription in the billing portal.',
        code: 'MANAGE_EXISTING_SUBSCRIPTION',
      }, { status: 409 })
    }

    let customerId = dbUser.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          email: dbUser.email,
          name:  dbUser.name ?? undefined,
          metadata: { userId: user.id },
        },
        { idempotencyKey: `billing-customer:${user.id}` },
      )
      customerId = customer.id
      await prisma.user.update({
        where: { id: user.id },
        data:  { stripeCustomerId: customerId },
      })
    }

    const baseUrl = getRequestBaseUrl(req)

    // ── Create Checkout Session ─────────────────────────────────────────────
    const metadata = { userId: user.id, plan }
    const session = await stripe.checkout.sessions.create(
      {
        customer: customerId,
        client_reference_id: user.id,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/billing?cancelled=1`,
        metadata,
        subscription_data: { metadata },
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
        customer_update: { address: 'auto' },
      },
      { idempotencyKey: `subscription-checkout:${user.id}:${plan}:${requestId}` },
    )

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('[Billing Checkout] Error:', err?.message || err)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
