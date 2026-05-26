import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'

export const config = { api: { bodyParser: false } }

// Health check — Stripe and browsers may hit this with GET
export async function GET() {
  return NextResponse.json({ status: 'Webhook endpoint active' })
}

const PLAN_CREDITS: Record<string, number> = {
  STARTER: 50,
  PRO: 200,
  AGENCY: -1,
}

async function handleSubscriptionUpsert(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId
  const plan = sub.metadata?.plan || 'STARTER'
  if (!userId) return

  const status = sub.status === 'active' ? 'ACTIVE'
    : sub.status === 'past_due' ? 'PAST_DUE'
    : sub.status === 'canceled' ? 'CANCELLED'
    : 'FREE'

  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionStatus: status as any,
      subscriptionId: sub.id,
      aiCredits: PLAN_CREDITS[plan] ?? 50,
    },
  }).catch(() => {})

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      plan: plan as any,
      status: status as any,
      stripeId: sub.id,
      customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      monthlyCredits: PLAN_CREDITS[plan] ?? 50,
      monthlyExports: plan === 'AGENCY' ? 9999 : plan === 'PRO' ? 50 : 10,
      maxTeamMembers: plan === 'AGENCY' ? 50 : plan === 'PRO' ? 5 : 1,
      currentPeriodStart: new Date((sub as any).current_period_start * 1000),
      currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
    },
    update: {
      plan: plan as any,
      status: status as any,
      stripeId: sub.id,
      currentPeriodStart: new Date((sub as any).current_period_start * 1000),
      currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
    },
  }).catch(() => {})
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  let event: Stripe.Event

  try {
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
    } else {
      // No webhook secret configured — parse directly (dev mode only)
      event = JSON.parse(body)
    }
  } catch (err: any) {
    console.error('[Webhook] Signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  console.log('[Webhook] Event:', event.type)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === 'subscription' && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string)
          // Attach userId metadata if missing
          if (!sub.metadata?.userId && session.metadata?.userId) {
            await stripe.subscriptions.update(sub.id, {
              metadata: { userId: session.metadata.userId, plan: session.metadata.plan || 'STARTER' }
            })
            sub.metadata = { ...sub.metadata, userId: session.metadata.userId, plan: session.metadata.plan || 'STARTER' }
          }
          await handleSubscriptionUpsert(sub)
        }
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription
        await handleSubscriptionUpsert(sub)
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.userId
        if (userId) {
          await prisma.user.update({
            where: { id: userId },
            data: { subscriptionStatus: 'CANCELLED', aiCredits: 0 },
          }).catch(() => {})
          await prisma.subscription.updateMany({
            where: { userId },
            data: { status: 'CANCELLED', cancelledAt: new Date() },
          }).catch(() => {})
        }
        break
      }
      default:
        console.log('[Webhook] Unhandled event type:', event.type)
    }
  } catch (err) {
    console.error('[Webhook] Handler error:', err)
  }

  return NextResponse.json({ received: true })
}
