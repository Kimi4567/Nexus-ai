/**
 * POST /api/billing/checkout
 * Creates a Stripe Checkout Session and returns the URL.
 *
 * Body: { plan: 'starter' | 'pro' | 'agency' }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import { stripe, STRIPE_PRICES } from '@/lib/stripe'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function getBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
}

export async function POST(req: NextRequest) {
  // ── Authenticate ─────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
      { error: `Unknown plan "${plan}". Valid: starter, pro, agency` },
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
}
