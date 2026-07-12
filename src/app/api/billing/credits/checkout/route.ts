/**
 * POST /api/billing/credits/checkout
 * Creates a one-time Stripe Checkout Session for a trusted credit-pack ID.
 * Fulfilment happens only in the signed billing webhook.
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { prisma } from '@/lib/prisma'
import {
  billingNotConfiguredResponse,
  getConfiguredCreditPack,
  getStripeClient,
  isBillingConfigured,
} from '@/lib/stripe'
import { isCreditWalletEnabled } from '@/lib/credits/wallet'
import { checkoutRateLimit } from '@/lib/dbRateLimit'

function getBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
}

export async function POST(req: NextRequest) {
  try {
    if (!isBillingConfigured()) {
      return NextResponse.json(billingNotConfiguredResponse(), { status: 503 })
    }
    if (!isCreditWalletEnabled()) {
      return NextResponse.json({
        error: 'Credit packs are not available until the wallet ledger is enabled.',
        code: 'CREDIT_WALLET_DISABLED',
      }, { status: 503 })
    }

    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user }, error } = await adminClient.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!checkoutRateLimit(`credit-pack:${user.id}`)) {
      return NextResponse.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })
    }

    const body = await req.json().catch(() => null) as { packId?: unknown } | null
    const pack = getConfiguredCreditPack(body?.packId)
    if (!pack) {
      return NextResponse.json({ error: 'Unknown or unconfigured credit pack.' }, { status: 400 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { stripeCustomerId: true, email: true, name: true },
    })
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const stripe = getStripeClient()
    let customerId = dbUser.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: dbUser.email,
        name: dbUser.name ?? undefined,
        metadata: { userId: user.id },
      })
      customerId = customer.id
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      })
    }

    const baseUrl = getBaseUrl()
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [{ price: pack.priceId, quantity: 1 }],
      success_url: `${baseUrl}/billing?credits=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/billing?credits=cancelled`,
      metadata: {
        kind: 'credit_pack',
        userId: user.id,
        packId: pack.id,
      },
      billing_address_collection: 'auto',
      customer_update: { address: 'auto' },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[Credit Pack Checkout] Error:', error)
    return NextResponse.json({ error: 'Failed to create credit-pack checkout.' }, { status: 500 })
  }
}
