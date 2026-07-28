/**
 * POST /api/billing/webhook
 * Stripe webhook handler — keeps our database in sync with Stripe events.
 *
 * Events handled:
 *   checkout.session.completed       → provision subscription
 *   customer.subscription.updated    → update plan / status
 *   customer.subscription.deleted    → cancel subscription
 *   invoice.payment_succeeded        → renew credits
 *   invoice.payment_failed           → mark past_due
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  billingNotConfiguredResponse,
  getStripeClient,
  isBillingConfigured,
  PLAN_CREDITS,
  resolveStripeSubscriptionPlan,
} from '@/lib/stripe'
import {
  getCreditPack,
  quoteCreditPurchase,
} from '@/lib/commercialPlans'
import { isCreditWalletEnabled } from '@/lib/credits/wallet'
import { sendUpgradeConfirmationEmail } from '@/lib/email/resend'
import { captureOperationalError } from '@/lib/observability/operationalError'
// B1d-c-1 — create the cycle's MONTHLY CreditGrant in parallel with the existing
// aiCredits overwrite (flag-independent, additive; never read while the flag is OFF).
import {
  ensureMonthlyGrant,
  fulfilPurchasedCreditPack,
  revokeMonthlyCreditsForStripeInvoiceRefund,
  revokePurchasedCreditsForStripeRefund,
  syncCachedWalletBalance,
  voidMonthlyGrants,
} from '@/lib/credits/creditGrants'
import Stripe from 'stripe'

type StoredSubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED'

const WEBHOOK_PROCESSING_LEASE_MS = 5 * 60 * 1000

function toStoredSubscriptionStatus(status: Stripe.Subscription.Status | string): StoredSubscriptionStatus {
  if (status === 'active' || status === 'trialing') return 'ACTIVE'
  if (status === 'canceled') return 'CANCELLED'
  if (status === 'incomplete_expired') return 'EXPIRED'
  // incomplete, past_due, unpaid, and paused must never provision paid access.
  return 'PAST_DUE'
}

function unixDate(value: unknown): Date | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? new Date(value * 1000)
    : null
}

function subscriptionPeriodDate(
  subscription: Stripe.Subscription,
  field: 'current_period_start' | 'current_period_end',
): Date | null {
  const rootValue = (subscription as unknown as Record<string, unknown>)[field]
  const firstItem = subscription.items?.data?.[0] as unknown as Record<string, unknown> | undefined
  return unixDate(rootValue) ?? unixDate(firstItem?.[field])
}

function subscriptionPeriodStart(subscription: Stripe.Subscription): Date | null {
  return subscriptionPeriodDate(subscription, 'current_period_start')
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription): Date | null {
  return subscriptionPeriodDate(subscription, 'current_period_end')
}

function subscriptionCancellationAt(subscription: Stripe.Subscription): Date | null {
  const cancelAt = unixDate(subscription.cancel_at)
  if (subscription.cancel_at_period_end) {
    return cancelAt ?? subscriptionPeriodEnd(subscription)
  }
  return subscription.status === 'canceled'
    ? unixDate(subscription.canceled_at) ?? cancelAt ?? new Date()
    : null
}

function stripeObjectId(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
    return value.id
  }
  return null
}

/**
 * A subscription invoice's root period is the invoice-item collection window,
 * not necessarily the service cycle being paid. The non-proration subscription
 * line owns the cycle that must key the monthly credit grant and any refund.
 */
function invoiceSubscriptionPeriod(
  invoice: Stripe.Invoice,
  subscriptionId: string,
): { start: Date | null; end: Date | null } {
  const lines = invoice.lines?.data ?? []
  const matchingLines = lines.filter((line) => (
    stripeObjectId(line.subscription) === subscriptionId
  ))
  const line = matchingLines.find((item) => item.type === 'subscription' && !item.proration)
    ?? matchingLines.find((item) => !item.proration)
    ?? matchingLines[0]
  return {
    start: unixDate(line?.period?.start) ?? unixDate(invoice.period_start),
    end: unixDate(line?.period?.end) ?? unixDate(invoice.period_end),
  }
}

async function resolveBillingUserId(subscription: Stripe.Subscription): Promise<string | null> {
  const metadataUserId = subscription.metadata?.userId?.trim()
  if (metadataUserId) return metadataUserId

  const savedSubscription = await (prisma as any).subscription.findUnique({
    where: { stripeId: subscription.id },
    select: { userId: true },
  })
  if (savedSubscription?.userId) return savedSubscription.userId

  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id
  if (!customerId) return null
  const savedUser = await (prisma as any).user.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  })
  return savedUser?.id ?? null
}

async function resolveRefundedChargeInvoice(
  charge: Stripe.Charge,
  stripe: Stripe,
): Promise<Stripe.Invoice | null> {
  let invoice = charge.invoice

  // Some Stripe webhook payload versions omit Charge.invoice even for invoice
  // payments. The originating PaymentIntent still carries the invoice link, so
  // resolve it before deciding that this refund is unrelated to a subscription.
  if (!invoice && charge.payment_intent) {
    const paymentIntent = typeof charge.payment_intent === 'string'
      ? await stripe.paymentIntents.retrieve(charge.payment_intent)
      : charge.payment_intent
    invoice = paymentIntent.invoice
  }

  if (!invoice) return null
  return typeof invoice === 'string'
    ? stripe.invoices.retrieve(invoice)
    : invoice
}

type BillingWebhookClaim = 'claimed' | 'processed' | 'processing'

async function claimBillingWebhookEvent(event: Stripe.Event): Promise<BillingWebhookClaim> {
  const db = (prisma as any).billingWebhookEvent
  const created = await db.createMany({
    data: [{
      id: event.id,
      type: event.type,
      status: 'PROCESSING',
      eventCreatedAt: unixDate(event.created),
    }],
    skipDuplicates: true,
  })
  if ((created?.count ?? 0) > 0) return 'claimed'

  const existing = await db.findUnique({ where: { id: event.id } })
  if (existing?.status === 'PROCESSED') return 'processed'

  const staleBefore = new Date(Date.now() - WEBHOOK_PROCESSING_LEASE_MS)
  const reclaimed = await db.updateMany({
    where: {
      id: event.id,
      OR: [
        { status: 'FAILED' },
        { status: 'PROCESSING', updatedAt: { lte: staleBefore } },
      ],
    },
    data: {
      status: 'PROCESSING',
      error: null,
      processedAt: null,
      attemptCount: { increment: 1 },
    },
  })
  return (reclaimed?.count ?? 0) > 0 ? 'claimed' : 'processing'
}

async function completeBillingWebhookEvent(eventId: string): Promise<void> {
  await (prisma as any).billingWebhookEvent.update({
    where: { id: eventId },
    data: { status: 'PROCESSED', processedAt: new Date(), error: null },
  })
}

async function failBillingWebhookEvent(eventId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)
  await (prisma as any).billingWebhookEvent.updateMany({
    where: { id: eventId, status: 'PROCESSING' },
    data: { status: 'FAILED', error: message.slice(0, 500) },
  })
}

/** Credits allocated by plan name */
function creditsForPlan(plan: string): number {
  return PLAN_CREDITS[plan.toLowerCase()] ?? 0
}

/** Upsert Subscription row + update User row atomically */
async function provisionSubscription(
  userId: string,
  stripeSubId: string,
  plan: string,
  status: string,
  currentPeriodStart: Date | null,
  currentPeriodEnd: Date | null,
  priceAmount: number | null,
  customerId: string,
  cancelledAt: Date | null,
  grantPaidAllowance: boolean,
) {
  const credits = creditsForPlan(plan)

  // Map plan name → PricingPlan enum (only STARTER | PRO | AGENCY exist in DB)
  // 'business' is our product name but maps to AGENCY tier in the enum
  const p = plan.toLowerCase()
  const planEnum: 'STARTER' | 'PRO' | 'AGENCY' =
    p === 'pro'      ? 'PRO'     :
    p === 'business' ? 'AGENCY'  :
    p === 'agency'   ? 'AGENCY'  :
    'STARTER'

  const statusEnum = toStoredSubscriptionStatus(status)

  const monthlyExports  = (p === 'agency' || p === 'business') ? 999999 : p === 'pro' ? 100 : 20
  const maxTeamMembers  = (p === 'agency' || p === 'business') ? 20     : p === 'pro' ? 5   : 1

  // Interactive transaction (B1d-c-1): every subscription event synchronizes
  // entitlement state, but only verified paid Checkout/invoice events may grant
  // the cycle allowance. A metadata or cancellation-schedule update must never
  // resurrect credits revoked by a refund.
  await (prisma as any).$transaction(async (tx: any) => {
    const walletEnabled = isCreditWalletEnabled()
    await tx.subscription.upsert({
      where:  { userId },
      create: {
        userId,
        plan:              planEnum,
        status:            statusEnum as 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED' | 'FREE',
        stripeId:          stripeSubId,
        customerId,
        amount:            priceAmount,
        currency:          'usd',
        monthlyCredits:    credits === -1 ? 999999 : credits,
        monthlyExports,
        maxTeamMembers,
        currentPeriodStart,
        currentPeriodEnd,
        cancelledAt,
      },
      update: {
        plan:              planEnum,
        status:            statusEnum as 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED' | 'FREE',
        stripeId:          stripeSubId,
        customerId,
        amount:            priceAmount,
        monthlyCredits:    credits === -1 ? 999999 : credits,
        monthlyExports,
        maxTeamMembers,
        currentPeriodStart,
        currentPeriodEnd,
        cancelledAt,
      },
    })
    await tx.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: statusEnum as 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED' | 'FREE',
        stripeCustomerId:   customerId,
        // Only top-up credits on active subscription
        ...(grantPaidAllowance && statusEnum === 'ACTIVE' && (!walletEnabled || credits === -1) && {
          aiCredits: credits === -1 ? 999999 : credits,
        }),
      },
    })
    // Parallel MONTHLY grant — only when the existing logic actually grants
    // credits (ACTIVE) and the allowance is a finite positive amount. Unlimited
    // (credits === -1) is left to the scalar aiCredits path; no MONTHLY grant.
    if (
      grantPaidAllowance
      && statusEnum === 'ACTIVE'
      && credits > 0
      && currentPeriodStart
      && currentPeriodEnd
    ) {
      await ensureMonthlyGrant(
        userId,
        {
          stripeSubscriptionId: stripeSubId,
          currentPeriodStart,
          currentPeriodEnd,
          amount: credits,
        },
        tx,
      )
      if (walletEnabled) await syncCachedWalletBalance(userId, tx)
    }
    if (statusEnum === 'CANCELLED' || statusEnum === 'EXPIRED') {
      await voidMonthlyGrants(userId, tx)
      if (walletEnabled) await syncCachedWalletBalance(userId, tx)
    }
  })
}

export async function POST(req: NextRequest) {
  const sig    = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!isBillingConfigured()) {
    console.error('[Webhook] Stripe billing is not configured')
    return NextResponse.json(billingNotConfiguredResponse(), { status: 503 })
  }

  if (!sig || !secret) {
    console.error('[Webhook] Missing stripe-signature or STRIPE_WEBHOOK_SECRET')
    return NextResponse.json({ error: 'Webhook misconfigured' }, { status: 400 })
  }

  const stripe = getStripeClient()

  // ── Verify signature ────────────────────────────────────────────────────
  let event: Stripe.Event
  try {
    const rawBody = await req.text()
    event = stripe.webhooks.constructEvent(rawBody, sig, secret)
  } catch (err) {
    console.warn('[Webhook] Signature verification failed')
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  console.log('[Webhook] Event received:', event.type, event.id)

  let eventClaimed = false
  let upgradeEmail: { userId: string; planLabel: string } | null = null
  try {
    const claim = await claimBillingWebhookEvent(event)
    if (claim === 'processed') {
      return NextResponse.json({ received: true, duplicate: true })
    }
    if (claim === 'processing') {
      return NextResponse.json(
        { received: false, retry: true, error: 'Webhook event is already processing' },
        { status: 503 },
      )
    }
    eventClaimed = true

    switch (event.type) {

      // ── New subscription created via Checkout ──────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === 'payment') {
          if (session.metadata?.kind === 'credit_wallet_purchase') {
            const userId = session.metadata.userId
            const quote = quoteCreditPurchase(session.metadata.credits)
            const metadataAmount = Number(session.metadata.amountCents)
            const paymentIntentId = typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id
            const valid = Boolean(
              userId &&
              quote &&
              session.client_reference_id === userId &&
              session.payment_status === 'paid' &&
              session.currency === 'usd' &&
              session.amount_subtotal === quote?.amountCents &&
              session.amount_total === quote?.amountCents &&
              metadataAmount === quote?.amountCents &&
              session.metadata.pricingVersion === quote?.pricingVersion &&
              paymentIntentId,
            )

            if (!valid || !userId || !quote || !paymentIntentId) {
              console.error('[Webhook] Refusing invalid credit wallet purchase', {
                sessionId: session.id,
                hasUserId: Boolean(userId),
                paymentStatus: session.payment_status,
                currency: session.currency,
                amountSubtotal: session.amount_subtotal,
                amountTotal: session.amount_total,
                pricingVersion: session.metadata.pricingVersion,
              })
              throw new Error(`Invalid paid credit-wallet checkout ${session.id}`)
            }

            const fulfilled = await (prisma as any).$transaction((tx: any) =>
              fulfilPurchasedCreditPack({
                userId,
                checkoutSessionId: session.id,
                paymentIntentId,
                credits: quote.credits,
                purchasedAt: new Date(session.created * 1000),
              }, tx),
            )
            console.log(
              `[Webhook] Credit wallet purchase fulfilled session=${session.id} ` +
              `credits=${quote.credits} created=${fulfilled.created}`,
            )
            break
          }

          // Backwards compatibility for fixed-pack Checkout sessions created
          // before the custom-quantity wallet was deployed.
          const pack = getCreditPack(session.metadata?.packId)
          const userId = session.metadata?.userId
          const isPaid = session.payment_status === 'paid'
          const expectedSubtotal = pack ? pack.priceUsd * 100 : null
          const amountMatches = expectedSubtotal !== null && session.amount_subtotal === expectedSubtotal

          if (session.metadata?.kind !== 'credit_pack' || !pack || !userId || !isPaid || !amountMatches) {
            console.error('[Webhook] Refusing invalid credit-pack checkout', {
              sessionId: session.id,
              hasUserId: Boolean(userId),
              packId: session.metadata?.packId,
              paymentStatus: session.payment_status,
              amountSubtotal: session.amount_subtotal,
            })
            throw new Error(`Invalid paid legacy credit-pack checkout ${session.id}`)
          }

          const fulfilled = await (prisma as any).$transaction((tx: any) =>
            fulfilPurchasedCreditPack({
              userId,
              checkoutSessionId: session.id,
              paymentIntentId: typeof session.payment_intent === 'string'
                ? session.payment_intent
                : session.payment_intent?.id,
              credits: pack.credits,
              purchasedAt: new Date(session.created * 1000),
            }, tx),
          )
          console.log(
            `[Webhook] Credit pack fulfilled session=${session.id} userId=${userId} ` +
            `credits=${pack.credits} created=${fulfilled.created}`,
          )
          break
        }

        if (session.mode !== 'subscription') break

        const subId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id
        if (!subId) throw new Error(`Subscription Checkout ${session.id} has no subscription id`)
        const sub   = await stripe.subscriptions.retrieve(subId, {
          expand: ['items.data.price'],
        })

        const userId     = await resolveBillingUserId(sub) ?? session.metadata?.userId
        const planMeta   = sub.metadata?.plan   ?? session.metadata?.plan
        if (!userId) {
          throw new Error(`Subscription ${sub.id} cannot be linked to a user`)
        }
        if (session.client_reference_id && session.client_reference_id !== userId) {
          throw new Error(`Subscription Checkout ${session.id} user reference mismatch`)
        }

        const priceId    = sub.items.data[0]?.price?.id ?? ''
        const plan       = resolveStripeSubscriptionPlan(priceId, planMeta)
        if (!plan) {
          console.error('[Webhook] Refusing subscription with unknown or mismatched price/plan', {
            subscriptionId: sub.id,
            priceId,
            planMeta,
          })
          throw new Error(`Subscription ${sub.id} uses an unknown or mismatched price`)
        }
        const priceAmt   = sub.items.data[0]?.price?.unit_amount ?? null
        const customerId = (typeof sub.customer === 'string' ? sub.customer : sub.customer?.id) ?? ''

        await provisionSubscription(
          userId, subId, plan, sub.status,
          subscriptionPeriodStart(sub),
          subscriptionPeriodEnd(sub),
          priceAmt, customerId, subscriptionCancellationAt(sub), false,
        )
        console.log(
          `[Webhook] Synchronized Checkout subscription for userId=${userId} plan=${plan}; ` +
          'monthly credits wait for the paid invoice event',
        )

        upgradeEmail = {
          userId,
          planLabel: plan.charAt(0).toUpperCase() + plan.slice(1).toLowerCase(),
        }
        break
      }

      // ── Refunded one-time credit purchase ──────────────────────────────
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        const kind = charge.metadata?.kind
        if (kind === 'credit_wallet_purchase' || kind === 'credit_pack') {

          const userId = charge.metadata?.userId
          const paymentIntentId = typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : charge.payment_intent?.id
          const quote = kind === 'credit_wallet_purchase'
            ? quoteCreditPurchase(charge.metadata?.credits)
            : getCreditPack(charge.metadata?.packId)
          const expectedAmount = quote
            ? ('amountCents' in quote ? quote.amountCents : quote.priceUsd * 100)
            : null
          const metadataAmount = kind === 'credit_wallet_purchase'
            ? Number(charge.metadata?.amountCents)
            : expectedAmount
          const valid = Boolean(
            userId &&
            paymentIntentId &&
            quote &&
            charge.currency === 'usd' &&
            expectedAmount === charge.amount &&
            metadataAmount === expectedAmount &&
            Number.isInteger(charge.amount_refunded) &&
            charge.amount_refunded > 0 &&
            (kind !== 'credit_wallet_purchase' || charge.metadata?.pricingVersion === (quote as any)?.pricingVersion),
          )
          if (!valid || !userId || !paymentIntentId || !quote || expectedAmount === null) {
            throw new Error(`Invalid refunded credit purchase charge ${charge.id}`)
          }

          const refund = await (prisma as any).$transaction((tx: any) =>
            revokePurchasedCreditsForStripeRefund({
              userId,
              paymentIntentId,
              stripeChargeId: charge.id,
              stripeEventId: event.id,
              purchasedCredits: quote.credits,
              originalAmountCents: expectedAmount,
              refundedAmountCents: charge.amount_refunded,
            }, tx),
          )
          if (refund.unrecovered > 0) {
            console.warn('[Webhook] Refunded credit purchase had already-spent credits', {
              chargeId: charge.id,
              userId,
              unrecoveredCredits: refund.unrecovered,
            })
          }
          console.log(
            `[Webhook] Credit purchase refund reconciled charge=${charge.id} ` +
            `revoked=${refund.revoked} unrecovered=${refund.unrecovered}`,
          )
          break
        }

        // Subscription invoice refunds carry no credit-pack metadata. Resolve
        // the invoice and revoke only this billing cycle's MONTHLY allowance;
        // the subscription itself remains active unless Stripe sends a separate
        // subscription status event.
        const invoice = await resolveRefundedChargeInvoice(charge, stripe)
        if (!invoice) break
        const subscriptionId = typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription?.id
        if (!subscriptionId) break

        const invoicePeriod = invoiceSubscriptionPeriod(invoice, subscriptionId)
        const periodStart = invoicePeriod.start
        const originalAmountCents = Number(invoice.amount_paid)
        const validSubscriptionRefund = Boolean(
          periodStart &&
          charge.currency === invoice.currency &&
          Number.isInteger(originalAmountCents) &&
          originalAmountCents > 0 &&
          Number.isInteger(charge.amount) &&
          charge.amount > 0 &&
          charge.amount <= originalAmountCents &&
          Number.isInteger(charge.amount_refunded) &&
          charge.amount_refunded > 0 &&
          charge.amount_refunded <= charge.amount,
        )
        if (!validSubscriptionRefund || !periodStart) {
          throw new Error(`Invalid refunded subscription invoice charge ${charge.id}`)
        }

        const sub = await stripe.subscriptions.retrieve(subscriptionId)
        const userId = await resolveBillingUserId(sub)
        if (!userId) {
          throw new Error(`Refunded invoice ${invoice.id} cannot be linked to a user`)
        }
        const refund = await (prisma as any).$transaction((tx: any) =>
          revokeMonthlyCreditsForStripeInvoiceRefund({
            userId,
            stripeSubscriptionId: subscriptionId,
            invoicePeriodStart: periodStart,
            stripeInvoiceId: invoice.id,
            stripeChargeId: charge.id,
            stripeEventId: event.id,
            originalAmountCents,
            refundedAmountCents: charge.amount_refunded,
          }, tx),
        )
        if (refund.unrecovered > 0) {
          console.warn('[Webhook] Refunded subscription invoice had already-spent monthly credits', {
            invoiceId: invoice.id,
            chargeId: charge.id,
            userId,
            unrecoveredCredits: refund.unrecovered,
          })
        }
        console.log(
          `[Webhook] Subscription invoice refund reconciled invoice=${invoice.id} ` +
          `revoked=${refund.revoked} unrecovered=${refund.unrecovered}`,
        )
        break
      }

      // ── Subscription changed (upgrade / downgrade / renewal) ──────────
      case 'customer.subscription.updated': {
        const eventSubscription = event.data.object as Stripe.Subscription
        // Some Stripe event snapshots omit billing-period boundaries even
        // though a direct Subscription retrieve includes them. Do not erase
        // valid database dates with a partial webhook payload.
        const sub = (
          subscriptionPeriodStart(eventSubscription)
          && subscriptionPeriodEnd(eventSubscription)
        )
          ? eventSubscription
          : await stripe.subscriptions.retrieve(eventSubscription.id, {
              expand: ['items.data.price'],
            })
        const userId = await resolveBillingUserId(sub)
        if (!userId) {
          throw new Error(`Subscription ${sub.id} update cannot be linked to a user`)
        }

        const priceId    = sub.items.data[0]?.price?.id ?? ''
        const plan       = resolveStripeSubscriptionPlan(priceId, sub.metadata?.plan)
        if (!plan) {
          console.error('[Webhook] Refusing subscription update with unknown or mismatched price/plan', {
            subscriptionId: sub.id,
            priceId,
            planMeta: sub.metadata?.plan,
          })
          throw new Error(`Subscription ${sub.id} update uses an unknown or mismatched price`)
        }
        const priceAmt   = sub.items.data[0]?.price?.unit_amount ?? null
        const customerId = (typeof sub.customer === 'string' ? sub.customer : sub.customer?.id) ?? ''

        await provisionSubscription(
          userId, sub.id, plan, sub.status,
          subscriptionPeriodStart(sub),
          subscriptionPeriodEnd(sub),
          priceAmt, customerId, subscriptionCancellationAt(sub), false,
        )
        console.log(`[Webhook] Updated subscription for userId=${userId} plan=${plan} status=${sub.status}`)
        break
      }

      // ── Subscription cancelled ────────────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub    = event.data.object as Stripe.Subscription
        const userId = await resolveBillingUserId(sub)
        if (!userId) {
          throw new Error(`Deleted subscription ${sub.id} cannot be linked to a user`)
        }

        // Cancellation voids subscription-cycle credit while leaving valid
        // independent grants (including purchased credit) intact. The scalar
        // cache is then rebuilt from the remaining eligible wallet grants.
        await (prisma as any).$transaction(async (tx: any) => {
          const walletEnabled = isCreditWalletEnabled()
          await tx.subscription.updateMany({
            where: { userId, stripeId: sub.id },
            data:  { status: 'CANCELLED', cancelledAt: subscriptionCancellationAt(sub) ?? new Date() },
          })
          await tx.user.update({
            where: { id: userId },
            data:  {
              subscriptionStatus: 'CANCELLED',
              ...(!walletEnabled && { aiCredits: 0 }),
            },
          })
          await voidMonthlyGrants(userId, tx)
          if (walletEnabled) await syncCachedWalletBalance(userId, tx)
        })
        console.log(`[Webhook] Subscription cancelled for userId=${userId}`)
        break
      }

      // ── Paid invoice — provision/renew only from verified paid state ───
      // invoice.paid is Stripe's current provisioning signal. Keep the older
      // payment_succeeded snapshot event for existing endpoint configurations;
      // the monthly grant source makes the pair idempotent for the same cycle.
      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        if (!invoice.subscription) break

        const subscriptionId = typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription.id
        const sub = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ['items.data.price'],
        })
        const userId = await resolveBillingUserId(sub)
        if (!userId) throw new Error(`Paid invoice ${invoice.id} cannot be linked to a user`)

        const priceId = sub.items.data[0]?.price?.id ?? ''
        const plan    = resolveStripeSubscriptionPlan(priceId, sub.metadata?.plan)
        if (!plan) {
          console.error('[Webhook] Refusing renewal with unknown or mismatched price/plan', {
            subscriptionId: sub.id,
            priceId,
            planMeta: sub.metadata?.plan,
          })
          throw new Error(`Paid invoice ${invoice.id} uses an unknown or mismatched subscription price`)
        }
        const priceAmount = sub.items.data[0]?.price?.unit_amount ?? null
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? ''
        const invoicePeriod = invoiceSubscriptionPeriod(invoice, subscriptionId)
        await provisionSubscription(
          userId,
          sub.id,
          plan,
          sub.status,
          // The subscription invoice line owns the paid service cycle. Its
          // period remains stable when a historical webhook is retried after
          // the Subscription object has advanced to a newer cycle.
          invoicePeriod.start ?? subscriptionPeriodStart(sub),
          invoicePeriod.end ?? subscriptionPeriodEnd(sub),
          priceAmount,
          customerId,
          subscriptionCancellationAt(sub),
          true,
        )
        console.log(`[Webhook] Paid invoice reconciled for userId=${userId} plan=${plan}`)
        break
      }

      // ── Payment failed ────────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        if (!invoice.subscription) break

        const sub    = await stripe.subscriptions.retrieve(invoice.subscription as string)
        const userId = await resolveBillingUserId(sub)
        if (!userId) throw new Error(`Failed invoice ${invoice.id} cannot be linked to a user`)

        await (prisma as any).$transaction(async (tx: any) => {
          await tx.user.update({
            where: { id: userId },
            data:  { subscriptionStatus: 'PAST_DUE' },
          })
          await tx.subscription.updateMany({
            where: { userId, stripeId: sub.id },
            data:  { status: 'PAST_DUE' },
          })
        })
        console.warn(`[Webhook] Payment failed for userId=${userId}`)
        break
      }

      default:
        console.log('[Webhook] Unhandled event type:', event.type)
    }

    await completeBillingWebhookEvent(event.id)

    // Email is deliberately outside the financial processing claim. A mail
    // provider outage must never make Stripe repeat a fulfilled payment.
    if (upgradeEmail && process.env.RESEND_API_KEY) {
      const { userId, planLabel } = upgradeEmail
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, name: true },
        })
        if (user?.email) {
          sendUpgradeConfirmationEmail(
            user.email,
            user.name || user.email.split('@')[0],
            planLabel,
          ).catch((mailError: unknown) => console.error('[Webhook] Upgrade email error:', mailError))
        }
      } catch (mailError) {
        console.error('[Webhook] Could not send upgrade email:', mailError)
      }
    }
  } catch (err) {
    if (eventClaimed) {
      try {
        await failBillingWebhookEvent(event.id, err)
      } catch (claimError) {
        console.error('[Webhook] Could not mark failed event:', claimError)
      }
    }
    await captureOperationalError(err, {
      operation: 'billing.webhook.process',
      route: '/api/billing/webhook',
      component: 'billing',
      method: 'POST',
      requestId: req.headers?.get?.('x-vercel-id') ?? null,
      statusCode: 500,
      retryable: true,
    })
    // Billing fulfilment must be retryable. All handled writes use stable Stripe
    // IDs / grant sources, so returning 500 is safe and prevents paid purchases
    // or renewals from being silently acknowledged without fulfilment.
    return NextResponse.json({ received: false, error: 'Webhook processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
