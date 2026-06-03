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
import { stripe, PLAN_CREDITS, planFromPriceId } from '@/lib/stripe'
import { sendUpgradeConfirmationEmail } from '@/lib/email/resend'
import Stripe from 'stripe'

/** Credits allocated by plan name */
function creditsForPlan(plan: string): number {
  return PLAN_CREDITS[plan.toLowerCase()] ?? 15
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

  await prisma.$transaction([
    prisma.subscription.upsert({
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
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: statusEnum as 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED' | 'FREE',
        stripeCustomerId:   customerId,
        // Only top-up credits on active subscription
        ...(statusEnum === 'ACTIVE' && {
          aiCredits: credits === -1 ? 999999 : credits,
        }),
      },
    }),
  ])
}

export async function POST(req: NextRequest) {
  const sig    = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !secret) {
    console.error('[Webhook] Missing stripe-signature or STRIPE_WEBHOOK_SECRET')
    return NextResponse.json({ error: 'Webhook misconfigured' }, { status: 400 })
  }

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
        const plan       = planMeta ?? planFromPriceId(priceId)
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
        const plan       = sub.metadata?.plan ?? planFromPriceId(priceId)
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

        await prisma.$transaction([
          prisma.subscription.updateMany({
            where: { userId, stripeId: sub.id },
            data:  { status: 'CANCELLED', cancelledAt: new Date() },
          }),
          prisma.user.update({
            where: { id: userId },
            data:  { subscriptionStatus: 'CANCELLED', aiCredits: 0 },
          }),
        ])
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
        const plan    = sub.metadata?.plan ?? planFromPriceId(priceId)
        const credits = creditsForPlan(plan)

        await prisma.user.update({
          where: { id: userId },
          data:  {
            subscriptionStatus: 'ACTIVE',
            aiCredits: credits === -1 ? 999999 : credits,
          },
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
    // Return 200 so Stripe doesn't retry — log the error on our end
    return NextResponse.json({ received: true, warning: 'Handler error logged' })
  }

  return NextResponse.json({ received: true })
}
