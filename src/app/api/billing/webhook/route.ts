/**
 * POST /api/billing/webhook
 * Lemon Squeezy webhook handler
 * Events: subscription_created, subscription_updated, subscription_cancelled, order_created
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyWebhookSignature } from '@/lib/lemonsqueezy'
import { sendUpgradeConfirmationEmail } from '@/lib/email/resend'

export async function GET() {
  return NextResponse.json({ status: 'Webhook endpoint active' })
}

const PLAN_CREDITS: Record<string, number> = {
  STARTER: 50,
  PRO: 200,
  AGENCY: -1,
}

const PLAN_BY_VARIANT: Record<string, string> = {
  [process.env.LS_VARIANT_STARTER || 'starter']: 'STARTER',
  [process.env.LS_VARIANT_PRO || 'pro']: 'PRO',
  [process.env.LS_VARIANT_AGENCY || 'agency']: 'AGENCY',
}

function getPlanFromVariant(variantId: string | number): string {
  return PLAN_BY_VARIANT[String(variantId)] || 'STARTER'
}

async function handleSubscriptionActive(data: any) {
  const userId = data.attributes?.custom_data?.user_id || data.meta?.custom_data?.user_id
  if (!userId) {
    console.error('[Webhook] No userId in custom_data:', JSON.stringify(data).slice(0, 300))
    return
  }

  const variantId = data.attributes?.variant_id
  const plan = getPlanFromVariant(variantId)
  const status = data.attributes?.status === 'active' ? 'ACTIVE'
    : data.attributes?.status === 'past_due' ? 'PAST_DUE'
    : data.attributes?.status === 'cancelled' ? 'CANCELLED'
    : 'FREE'

  const credits = PLAN_CREDITS[plan] ?? 50

  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionStatus: status as any,
      subscriptionId: String(data.id),
      aiCredits: credits,
    },
  }).catch(e => console.error('[Webhook] User update error:', e))

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      plan: plan as any,
      status: status as any,
      stripeId: String(data.id),
      customerId: String(data.attributes?.customer_id || ''),
      monthlyCredits: credits,
      monthlyExports: plan === 'AGENCY' ? 9999 : plan === 'PRO' ? 50 : 10,
      maxTeamMembers: plan === 'AGENCY' ? 50 : plan === 'PRO' ? 5 : 1,
      currentPeriodStart: data.attributes?.created_at ? new Date(data.attributes.created_at) : new Date(),
      currentPeriodEnd: data.attributes?.renews_at ? new Date(data.attributes.renews_at) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    update: {
      plan: plan as any,
      status: status as any,
      stripeId: String(data.id),
      currentPeriodStart: data.attributes?.created_at ? new Date(data.attributes.created_at) : new Date(),
      currentPeriodEnd: data.attributes?.renews_at ? new Date(data.attributes.renews_at) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  }).catch(e => console.error('[Webhook] Subscription upsert error:', e))

  console.log(`[Webhook] Subscription activated: userId=${userId} plan=${plan}`)
}

async function handleSubscriptionCancelled(data: any) {
  const userId = data.attributes?.custom_data?.user_id || data.meta?.custom_data?.user_id
  if (!userId) return

  await prisma.user.update({
    where: { id: userId },
    data: { subscriptionStatus: 'CANCELLED', aiCredits: 0 },
  }).catch(() => {})

  await prisma.subscription.updateMany({
    where: { userId },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  }).catch(() => {})

  console.log(`[Webhook] Subscription cancelled: userId=${userId}`)
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('x-signature') || ''
  const webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET || ''

  // Verify signature in production
  if (webhookSecret && signature) {
    const valid = await verifyWebhookSignature(body, signature, webhookSecret)
    if (!valid) {
      console.error('[Webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }
  }

  let event: any
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventName = event.meta?.event_name
  console.log('[Webhook] Event:', eventName)

  try {
    switch (eventName) {
      case 'subscription_created':
      case 'subscription_updated':
      case 'subscription_resumed':
      case 'subscription_unpaused': {
        await handleSubscriptionActive(event.data)

        // Send upgrade confirmation email on new subscription
        if (eventName === 'subscription_created') {
          const userId = event.data?.attributes?.custom_data?.user_id || event.meta?.custom_data?.user_id
          if (userId && process.env.RESEND_API_KEY) {
            const dbUser = await prisma.user.findUnique({ where: { id: userId } }).catch(() => null)
            if (dbUser?.email) {
              const plan = getPlanFromVariant(event.data?.attributes?.variant_id)
              const planLabel = plan.charAt(0) + plan.slice(1).toLowerCase()
              sendUpgradeConfirmationEmail(dbUser.email, dbUser.name || dbUser.email.split('@')[0], planLabel)
                .catch(e => console.error('[Webhook] Upgrade email error:', e))
            }
          }
        }
        break
      }

      case 'subscription_cancelled':
      case 'subscription_expired': {
        await handleSubscriptionCancelled(event.data)
        break
      }

      case 'order_created': {
        console.log('[Webhook] Order created:', event.data?.id)
        break
      }

      default:
        console.log('[Webhook] Unhandled event:', eventName)
    }
  } catch (err) {
    console.error('[Webhook] Handler error:', err)
  }

  return NextResponse.json({ received: true })
}
