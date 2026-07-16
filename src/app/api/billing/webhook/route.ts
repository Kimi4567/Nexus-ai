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
// B1d-c-1 — create the cycle's MONTHLY CreditGrant in parallel with the existing
// aiCredits overwrite (flag-independent, additive; never read while the flag is OFF).
import {
  ensureMonthlyGrant,
  fulfilPurchasedCreditPack,
  syncCachedWalletBalance,
  voidMonthlyGrants,
} from '@/lib/credits/creditGrants'
import Stripe from 'stripe'

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
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  priceAmount: number | null,
  customerId: string
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

  const statusEnum = status === 'active' ? 'ACTIVE'
    : status === 'past_due' ? 'PAST_DUE'
    : status === 'canceled'  ? 'CANCELLED'
    : 'ACTIVE'

  const monthlyExports  = (p === 'agency' || p === 'business') ? 999999 : p === 'pro' ? 100 : 20
  const maxTeamMembers  = (p === 'agency' || p === 'business') ? 20     : p === 'pro' ? 5   : 1

  // Interactive transaction (B1d-c-1): the subscription upsert + the EXACT same
  // aiCredits overwrite as before, PLUS a parallel MONTHLY CreditGrant for the
  // billing cycle when the subscription is ACTIVE. The aiCredits behavior and the
  // ACTIVE-only condition are unchanged.
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
        cancelledAt:       null,
      },
    })
    await tx.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: statusEnum as 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED' | 'FREE',
        stripeCustomerId:   customerId,
        // Only top-up credits on active subscription
        ...(statusEnum === 'ACTIVE' && (!walletEnabled || credits === -1) && {
          aiCredits: credits === -1 ? 999999 : credits,
        }),
      },
    })
    // Parallel MONTHLY grant — only when the existing logic actually grants
    // credits (ACTIVE) and the allowance is a finite positive amount. Unlimited
    // (credits === -1) is left to the scalar aiCredits path; no MONTHLY grant.
    if (statusEnum === 'ACTIVE' && credits > 0) {
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
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Webhook] Signature verification failed:', msg)
    return NextResponse.json({ error: `Webhook error: ${msg}` }, { status: 400 })
  }

  console.log('[Webhook] Event received:', event.type, event.id)

  try {
    switch (event.type) {

      // ── New subscription created via Checkout ──────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === 'payment') {
          if (session.metadata?.kind === 'credit_wallet_purchase') {
            const userId = session.metadata.userId
            const quote = quoteCreditPurchase(session.metadata.credits)
            const metadataAmount = Number(session.metadata.amountCents)
            const valid = Boolean(
              userId &&
              quote &&
              session.client_reference_id === userId &&
              session.payment_status === 'paid' &&
              session.currency === 'usd' &&
              session.amount_subtotal === quote?.amountCents &&
              session.amount_total === quote?.amountCents &&
              metadataAmount === quote?.amountCents &&
              session.metadata.pricingVersion === quote?.pricingVersion,
            )

            if (!valid || !userId || !quote) {
              console.error('[Webhook] Refusing invalid credit wallet purchase', {
                sessionId: session.id,
                hasUserId: Boolean(userId),
                paymentStatus: session.payment_status,
                currency: session.currency,
                amountSubtotal: session.amount_subtotal,
                amountTotal: session.amount_total,
                pricingVersion: session.metadata.pricingVersion,
              })
              break
            }

            const fulfilled = await (prisma as any).$transaction((tx: any) =>
              fulfilPurchasedCreditPack({
                userId,
                checkoutSessionId: session.id,
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
            break
          }

          const fulfilled = await (prisma as any).$transaction((tx: any) =>
            fulfilPurchasedCreditPack({
              userId,
              checkoutSessionId: session.id,
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

        const subId = session.subscription as string
        const sub   = await stripe.subscriptions.retrieve(subId, {
          expand: ['items.data.price'],
        })

        const userId     = sub.metadata?.userId ?? session.metadata?.userId
        const planMeta   = sub.metadata?.plan   ?? session.metadata?.plan
        if (!userId) {
          console.error('[Webhook] checkout.session.completed: no userId in metadata', sub.id)
          break
        }

        const priceId    = sub.items.data[0]?.price?.id ?? ''
        const plan       = resolveStripeSubscriptionPlan(priceId, planMeta)
        if (!plan) {
          console.error('[Webhook] Refusing subscription with unknown or mismatched price/plan', {
            subscriptionId: sub.id,
            priceId,
            planMeta,
          })
          break
        }
        const priceAmt   = sub.items.data[0]?.price?.unit_amount ?? null
        const customerId = (typeof sub.customer === 'string' ? sub.customer : sub.customer?.id) ?? ''

        await provisionSubscription(
          userId, subId, plan, sub.status,
          new Date(sub.current_period_start * 1000),
          new Date(sub.current_period_end   * 1000),
          priceAmt, customerId
        )
        console.log(`[Webhook] Provisioned subscription for userId=${userId} plan=${plan}`)

        // Send upgrade confirmation email — non-blocking
        if (process.env.RESEND_API_KEY) {
          try {
            const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })
            if (user?.email) {
              const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1).toLowerCase()
              sendUpgradeConfirmationEmail(user.email, user.name || user.email.split('@')[0], planLabel)
                .catch((e: unknown) => console.error('[Webhook] Upgrade email error:', e))
            }
          } catch (e) {
            console.error('[Webhook] Could not send upgrade email:', e)
          }
        }
        break
      }

      // ── Subscription changed (upgrade / downgrade / renewal) ──────────
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.userId
        if (!userId) {
          console.warn('[Webhook] subscription.updated: no userId in metadata', sub.id)
          break
        }

        const priceId    = sub.items.data[0]?.price?.id ?? ''
        const plan       = resolveStripeSubscriptionPlan(priceId, sub.metadata?.plan)
        if (!plan) {
          console.error('[Webhook] Refusing subscription update with unknown or mismatched price/plan', {
            subscriptionId: sub.id,
            priceId,
            planMeta: sub.metadata?.plan,
          })
          break
        }
        const priceAmt   = sub.items.data[0]?.price?.unit_amount ?? null
        const customerId = (typeof sub.customer === 'string' ? sub.customer : sub.customer?.id) ?? ''

        await provisionSubscription(
          userId, sub.id, plan, sub.status,
          new Date(sub.current_period_start * 1000),
          new Date(sub.current_period_end   * 1000),
          priceAmt, customerId
        )
        console.log(`[Webhook] Updated subscription for userId=${userId} plan=${plan} status=${sub.status}`)
        break
      }

      // ── Subscription cancelled ────────────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub    = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.userId
        if (!userId) {
          console.warn('[Webhook] subscription.deleted: no userId in metadata', sub.id)
          break
        }

        // Cancellation voids subscription-cycle credit while leaving valid
        // independent grants (including purchased credit) intact. The scalar
        // cache is then rebuilt from the remaining eligible wallet grants.
        await (prisma as any).$transaction(async (tx: any) => {
          const walletEnabled = isCreditWalletEnabled()
          await tx.subscription.updateMany({
            where: { userId, stripeId: sub.id },
            data:  { status: 'CANCELLED', cancelledAt: new Date() },
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

      // ── Payment succeeded — renew monthly credits ─────────────────────
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        // Only handle subscription invoices
        if (!invoice.subscription) break

        const sub = await stripe.subscriptions.retrieve(invoice.subscription as string)
        const userId = sub.metadata?.userId
        if (!userId) break

        const priceId = sub.items.data[0]?.price?.id ?? ''
        const plan    = resolveStripeSubscriptionPlan(priceId, sub.metadata?.plan)
        if (!plan) {
          console.error('[Webhook] Refusing renewal with unknown or mismatched price/plan', {
            subscriptionId: sub.id,
            priceId,
            planMeta: sub.metadata?.plan,
          })
          break
        }
        const credits = creditsForPlan(plan)

        // B1d-c-2: only create a MONTHLY grant when the existing logic grants a
        // finite positive allowance AND the cycle dates are valid numbers. An
        // invalid/missing period must NOT throw or block the aiCredits update.
        const startSec = (sub as any).current_period_start
        const endSec   = (sub as any).current_period_end
        const periodValid =
          Number.isFinite(startSec) && Number.isFinite(endSec)
        const wantsGrant = credits > 0 && periodValid

        // Renewal creates exactly one MONTHLY grant for the new cycle, resets
        // prior subscription-cycle credit, and preserves eligible independent
        // grants. The scalar balance remains a derived compatibility cache.
        await (prisma as any).$transaction(async (tx: any) => {
          const walletEnabled = isCreditWalletEnabled()
          await tx.user.update({
            where: { id: userId },
            data:  {
              subscriptionStatus: 'ACTIVE',
              ...((!walletEnabled || credits === -1) && { aiCredits: credits === -1 ? 999999 : credits }),
            },
          })
          if (wantsGrant) {
            await ensureMonthlyGrant(
              userId,
              {
                stripeSubscriptionId: sub.id,
                currentPeriodStart: new Date(startSec * 1000),
                currentPeriodEnd: new Date(endSec * 1000),
                amount: credits,
              },
              tx,
            )
            if (walletEnabled) await syncCachedWalletBalance(userId, tx)
          }
        })
        console.log(`[Webhook] Credits renewed for userId=${userId} plan=${plan} credits=${credits}`)
        break
      }

      // ── Payment failed ────────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        if (!invoice.subscription) break

        const sub    = await stripe.subscriptions.retrieve(invoice.subscription as string)
        const userId = sub.metadata?.userId
        if (!userId) break

        await prisma.user.update({
          where: { id: userId },
          data:  { subscriptionStatus: 'PAST_DUE' },
        })
        await prisma.subscription.updateMany({
          where: { userId, stripeId: sub.id },
          data:  { status: 'PAST_DUE' },
        })
        console.warn(`[Webhook] Payment failed for userId=${userId}`)
        break
      }

      default:
        console.log('[Webhook] Unhandled event type:', event.type)
    }
  } catch (err) {
    console.error('[Webhook] Handler error for', event.type, err)
    // Billing fulfilment must be retryable. All handled writes use stable Stripe
    // IDs / grant sources, so returning 500 is safe and prevents paid purchases
    // or renewals from being silently acknowledged without fulfilment.
    return NextResponse.json({ received: false, error: 'Webhook processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
