/**
 * POST /api/billing/credits/checkout
 * Creates a one-time Stripe Checkout Session for a server-priced credit amount.
 * Fulfilment happens only in the signed billing webhook.
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { prisma } from '@/lib/prisma'
import {
  billingNotConfiguredResponse,
  getCreditWalletLineItems,
  getStripeClient,
  isBillingConfigured,
  isCreditWalletPurchaseConfigured,
  validateCreditWalletStripePrices,
} from '@/lib/stripe'
import { isCreditWalletEnabled } from '@/lib/credits/wallet'
import { checkoutRateLimit } from '@/lib/dbRateLimit'
import { CREDIT_PURCHASE_POLICY, quoteCreditPurchase } from '@/lib/commercialPlans'
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
    const billingDatabase = await getBillingDatabaseReadiness()
    if (!billingDatabase.ready) {
      return NextResponse.json(billingDatabaseUnavailableResponse(billingDatabase), { status: 503 })
    }
    if (!checkoutRateLimit(`credit-pack:${user.id}`)) {
      return NextResponse.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })
    }

    if (!isCreditWalletPurchaseConfigured()) {
      return NextResponse.json({
        error: 'Credit wallet purchasing is not configured.',
        code: 'CREDIT_PURCHASE_NOT_CONFIGURED',
      }, { status: 503 })
    }

    const body = await req.json().catch(() => null) as {
      credits?: unknown
      requestId?: unknown
    } | null
    const quote = quoteCreditPurchase(body?.credits)
    if (!quote) {
      return NextResponse.json({
        error: `Choose between ${CREDIT_PURCHASE_POLICY.minimum} and ${CREDIT_PURCHASE_POLICY.maximum} credits in increments of ${CREDIT_PURCHASE_POLICY.step}.`,
        code: 'INVALID_CREDIT_QUANTITY',
      }, { status: 400 })
    }
    const requestId = typeof body?.requestId === 'string' ? body.requestId : ''
    if (!/^[A-Za-z0-9_-]{16,80}$/.test(requestId)) {
      return NextResponse.json({
        error: 'A valid checkout request ID is required.',
        code: 'INVALID_CHECKOUT_REQUEST_ID',
      }, { status: 400 })
    }
    const lineItems = getCreditWalletLineItems(quote.credits)
    if (!lineItems) {
      return NextResponse.json({
        error: 'Credit wallet pricing is incomplete.',
        code: 'CREDIT_PURCHASE_NOT_CONFIGURED',
      }, { status: 503 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { stripeCustomerId: true, email: true, name: true },
    })
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const stripe = getStripeClient()
    if (!await validateCreditWalletStripePrices(stripe)) {
      return NextResponse.json({
        error: 'Credit wallet prices do not match the current commercial schedule. Rotate the Stripe tier Price IDs before enabling purchases.',
        code: 'CREDIT_PRICE_VERSION_MISMATCH',
      }, { status: 503 })
    }
    let customerId = dbUser.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          email: dbUser.email,
          name: dbUser.name ?? undefined,
          metadata: { userId: user.id },
        },
        { idempotencyKey: `billing-customer:${user.id}` },
      )
      customerId = customer.id
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      })
    }

    const baseUrl = getRequestBaseUrl(req)
    const metadata = {
      kind: 'credit_wallet_purchase',
      userId: user.id,
      credits: String(quote.credits),
      amountCents: String(quote.amountCents),
      pricingVersion: quote.pricingVersion,
    }
    const session = await stripe.checkout.sessions.create(
      {
        customer: customerId,
        client_reference_id: user.id,
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: lineItems,
        success_url: `${baseUrl}/billing?credits=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/billing?credits=cancelled`,
        metadata,
        payment_intent_data: { metadata },
        billing_address_collection: 'auto',
        customer_update: { address: 'auto', name: 'auto' },
        submit_type: 'pay',
      },
      { idempotencyKey: `credit-wallet:${user.id}:${requestId}` },
    )

    return NextResponse.json({ url: session.url, quote })
  } catch (error) {
    console.error('[Credit Wallet Checkout] Error:', error)
    return NextResponse.json({ error: 'Failed to create credit wallet checkout.' }, { status: 500 })
  }
}
