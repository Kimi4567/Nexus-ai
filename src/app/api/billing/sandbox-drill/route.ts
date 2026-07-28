import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { adminClient } from '@/lib/supabaseAuth'
import { prisma } from '@/lib/prisma'
import { getBillingMode, getStripeClient } from '@/lib/stripe'
import { POST as processBillingWebhook } from '@/app/api/billing/webhook/route'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const CONFIRMATION = 'RUN_STRIPE_SANDBOX_DRILL'
const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
}
const REPLAYED_EVENT_TYPES = new Set([
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'charge.refunded',
])

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS })
}

function sandboxDrillEnabled(): boolean {
  return process.env.VERCEL_ENV === 'preview'
    && process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview'
    && process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') === true
    && getBillingMode() === 'sandbox'
}

function objectId(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
    return value.id
  }
  return null
}

function eventBelongsToCustomer(
  event: Stripe.Event,
  customerId: string,
  subscriptionId: string,
): boolean {
  const object = event.data.object as unknown as Record<string, unknown>
  return objectId(object.customer) === customerId
    || objectId(object.subscription) === subscriptionId
    || (object.object === 'subscription' && objectId(object) === subscriptionId)
}

function eventReplayPriority(type: string): number {
  if (type === 'checkout.session.completed') return 0
  if (type === 'invoice.paid') return 1
  if (type === 'invoice.payment_succeeded') return 2
  if (type === 'customer.subscription.updated') return 3
  if (type === 'charge.refunded') return 4
  if (type === 'customer.subscription.deleted') return 5
  return 10
}

async function waitForClock(
  stripe: Stripe,
  clockId: string,
  attempts = 60,
): Promise<Stripe.TestHelpers.TestClock> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const clock = await stripe.testHelpers.testClocks.retrieve(clockId)
    if (clock.status === 'ready') return clock
    if (clock.status === 'internal_failure') {
      throw new Error(`Stripe Test Clock ${clockId} entered internal_failure`)
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000))
  }
  throw new Error(`Stripe Test Clock ${clockId} did not become ready in time`)
}

async function paidInvoices(
  stripe: Stripe,
  customerId: string,
  subscriptionId: string,
): Promise<Stripe.Invoice[]> {
  const invoices = await stripe.invoices.list({
    customer: customerId,
    subscription: subscriptionId,
    status: 'paid',
    limit: 10,
    expand: ['data.charge', 'data.payment_intent'],
  })
  return [...invoices.data].sort((left, right) => left.created - right.created)
}

async function subscriptionInvoices(
  stripe: Stripe,
  customerId: string,
  subscriptionId: string,
): Promise<Stripe.Invoice[]> {
  const invoices = await stripe.invoices.list({
    customer: customerId,
    subscription: subscriptionId,
    limit: 10,
  })
  return [...invoices.data].sort((left, right) => left.created - right.created)
}

async function replayStripeEvents(
  stripe: Stripe,
  req: NextRequest,
  input: {
    customerId: string
    subscriptionId: string
    createdAfter: number
    replayNamespace?: string
  },
) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret?.startsWith('whsec_')) {
    throw new Error('Stripe webhook signing secret is missing in Preview')
  }

  const listed = await stripe.events.list({ limit: 100 })
  const selected = listed.data
    .filter((event) => (
      event.created >= input.createdAfter
      && REPLAYED_EVENT_TYPES.has(event.type)
      && eventBelongsToCustomer(event, input.customerId, input.subscriptionId)
    ))
    .sort((left, right) => (
      left.created - right.created
      || eventReplayPriority(left.type) - eventReplayPriority(right.type)
      || left.id.localeCompare(right.id)
    ))

  const results: Array<{
    id: string
    sourceId: string
    type: string
    status: number
    processed: boolean
  }> = []
  for (const event of selected) {
    const replayedEvent = input.replayNamespace
      ? { ...event, id: `evt_preview_${input.replayNamespace}_${event.id.slice(-8)}` }
      : event
    const payload = JSON.stringify(replayedEvent)
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret })
    const replayRequest = new NextRequest(
      new URL('/api/billing/webhook', req.url),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': signature,
        },
        body: payload,
      },
    )
    const response = await processBillingWebhook(replayRequest)
    results.push({
      id: replayedEvent.id,
      sourceId: event.id,
      type: event.type,
      status: response.status,
      processed: response.ok,
    })
  }
  return results
}

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return null
  const { data: { user }, error } = await adminClient.auth.getUser(token)
  return error ? null : user
}

export async function POST(req: NextRequest) {
  if (!sandboxDrillEnabled()) {
    return privateJson({ error: 'Not found' }, 404)
  }

  const user = await authenticate(req)
  if (!user) return privateJson({ error: 'Unauthorized' }, 401)

  let body: { action?: unknown; confirm?: unknown }
  try {
    body = await req.json()
  } catch {
    return privateJson({ error: 'Invalid request body' }, 400)
  }
  if (body.confirm !== CONFIRMATION) {
    return privateJson({ error: 'Explicit sandbox confirmation is required' }, 400)
  }

  const stripe = getStripeClient()
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      stripeCustomerId: true,
      subscriptionStatus: true,
    },
  })
  if (!dbUser) return privateJson({ error: 'User not found' }, 404)

  try {
    if (body.action === 'setup') {
      const existingSubscription = await prisma.subscription.findUnique({
        where: { userId: user.id },
        select: { stripeId: true, status: true },
      })
      if (
        existingSubscription?.stripeId
        && ['ACTIVE', 'PAST_DUE'].includes(String(existingSubscription.status))
      ) {
        return privateJson({
          error: 'Cancel the existing sandbox subscription before creating a new clock.',
          code: 'ACTIVE_SANDBOX_SUBSCRIPTION',
        }, 409)
      }

      if (dbUser.stripeCustomerId) {
        const currentCustomer = await stripe.customers.retrieve(dbUser.stripeCustomerId)
        if (!currentCustomer.deleted && objectId(currentCustomer.test_clock)) {
          return privateJson({
            ready: true,
            reused: true,
            customerId: currentCustomer.id,
            testClockId: objectId(currentCustomer.test_clock),
          })
        }
      }

      const clock = await stripe.testHelpers.testClocks.create({
        frozen_time: Math.floor(Date.now() / 1000),
        name: `NEXUS checkout drill ${user.id.slice(0, 8)}`,
      })
      const customer = await stripe.customers.create({
        email: dbUser.email,
        name: dbUser.name ?? undefined,
        test_clock: clock.id,
        metadata: {
          userId: user.id,
          nexusSandboxDrill: 'true',
        },
      })
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customer.id },
      })

      return privateJson({
        ready: true,
        reused: false,
        customerId: customer.id,
        testClockId: clock.id,
      })
    }

    if (body.action === 'resync') {
      if (!dbUser.stripeCustomerId) {
        return privateJson({ error: 'Sandbox customer is missing', code: 'SETUP_REQUIRED' }, 409)
      }
      const subscriptions = await stripe.subscriptions.list({
        customer: dbUser.stripeCustomerId,
        status: 'all',
        limit: 10,
      })
      const subscription = subscriptions.data
        .sort((left, right) => right.created - left.created)[0]
      if (!subscription) {
        return privateJson({ error: 'Sandbox subscription is missing', code: 'CHECKOUT_REQUIRED' }, 409)
      }

      await stripe.subscriptions.update(subscription.id, {
        metadata: {
          ...subscription.metadata,
          sandboxDrillVerifiedAt: String(Date.now()),
        },
      })
      await new Promise((resolve) => setTimeout(resolve, 2_000))
      const replayedEvents = await replayStripeEvents(stripe, req, {
        customerId: dbUser.stripeCustomerId,
        subscriptionId: subscription.id,
        // Reconcile the complete customer lifecycle in chronological order.
        // Paid events grant the allowance and later refund events revoke it;
        // subscription.updated events only synchronize entitlement state.
        createdAfter: 0,
        replayNamespace: `period_sync_${Date.now()}`,
      })
      const database = await prisma.subscription.findUnique({
        where: { userId: user.id },
        select: {
          stripeId: true,
          status: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          cancelledAt: true,
        },
      })
      return privateJson({
        completed: replayedEvents.some((event) => (
          event.type === 'customer.subscription.updated' && event.processed
        )),
        subscriptionId: subscription.id,
        webhookReplay: replayedEvents,
        database,
      })
    }

    if (body.action !== 'run') {
      return privateJson({ error: 'Unknown sandbox drill action' }, 400)
    }
    if (!dbUser.stripeCustomerId) {
      return privateJson({ error: 'Run setup before Checkout', code: 'SETUP_REQUIRED' }, 409)
    }

    const customer = await stripe.customers.retrieve(dbUser.stripeCustomerId)
    if (customer.deleted) {
      return privateJson({ error: 'Sandbox customer was deleted', code: 'SETUP_REQUIRED' }, 409)
    }
    const testClockId = objectId(customer.test_clock)
    if (!testClockId) {
      return privateJson({ error: 'Sandbox customer has no Test Clock', code: 'SETUP_REQUIRED' }, 409)
    }
    const clockBefore = await stripe.testHelpers.testClocks.retrieve(testClockId)
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all',
      limit: 10,
      expand: ['data.latest_invoice'],
    })
    const subscription = subscriptions.data
      .filter((item) => !['canceled', 'incomplete_expired'].includes(item.status))
      .sort((left, right) => right.created - left.created)[0]
    if (!subscription) {
      return privateJson({
        error: 'Complete Stripe Checkout before running the lifecycle drill.',
        code: 'CHECKOUT_REQUIRED',
      }, 409)
    }

    let invoices = await paidInvoices(stripe, customer.id, subscription.id)
    if (invoices.length < 1) {
      return privateJson({
        error: 'The initial Checkout invoice is not paid yet.',
        code: 'INITIAL_INVOICE_PENDING',
      }, 409)
    }
    const initialInvoice = invoices[0]

    let allInvoices = await subscriptionInvoices(stripe, customer.id, subscription.id)
    if (allInvoices.length < 2) {
      await stripe.testHelpers.testClocks.advance(testClockId, {
        frozen_time: subscription.current_period_end + 60,
      })
      await waitForClock(stripe, testClockId)
      allInvoices = await subscriptionInvoices(stripe, customer.id, subscription.id)
    }

    // Stripe first creates the renewal invoice in draft/open state. Test Clock
    // time must also cross the invoice-finalization window before payment is
    // attempted; advancing only to the period boundary is not a renewal proof.
    invoices = await paidInvoices(stripe, customer.id, subscription.id)
    if (invoices.length < 2 && allInvoices.length >= 2) {
      const clockAtRenewalBoundary = await stripe.testHelpers.testClocks.retrieve(testClockId)
      await stripe.testHelpers.testClocks.advance(testClockId, {
        frozen_time: clockAtRenewalBoundary.frozen_time + (2 * 60 * 60),
      })
      await waitForClock(stripe, testClockId)
    }

    for (let attempt = 0; attempt < 30 && invoices.length < 2; attempt += 1) {
      invoices = await paidInvoices(stripe, customer.id, subscription.id)
      if (invoices.length >= 2) break
      await new Promise((resolve) => setTimeout(resolve, 2_000))
    }
    if (invoices.length < 2) {
      throw new Error('Stripe did not create a paid renewal invoice after advancing the Test Clock')
    }
    const renewalInvoice = invoices[invoices.length - 1]

    const cancelledSubscription = await stripe.subscriptions.update(
      subscription.id,
      { cancel_at_period_end: true },
      { idempotencyKey: `sandbox-drill-cancel:${subscription.id}` },
    )

    const initialChargeId = objectId(initialInvoice.charge)
    const renewalChargeId = objectId(renewalInvoice.charge)
    if (!initialChargeId || !renewalChargeId) {
      throw new Error('Paid sandbox invoices do not expose refundable charges')
    }
    const [initialCharge, renewalCharge] = await Promise.all([
      stripe.charges.retrieve(initialChargeId),
      stripe.charges.retrieve(renewalChargeId),
    ])

    let partialRefund: Stripe.Refund | null = null
    if (initialCharge.amount_refunded < 490) {
      partialRefund = await stripe.refunds.create(
        { charge: initialChargeId, amount: 490 },
        { idempotencyKey: `sandbox-drill-partial:${initialChargeId}:490` },
      )
    }

    let fullRefund: Stripe.Refund | null = null
    if (!renewalCharge.refunded) {
      fullRefund = await stripe.refunds.create(
        { charge: renewalChargeId },
        { idempotencyKey: `sandbox-drill-full:${renewalChargeId}` },
      )
    }

    await new Promise((resolve) => setTimeout(resolve, 2_000))
    const replayedEvents = await replayStripeEvents(stripe, req, {
      customerId: customer.id,
      subscriptionId: subscription.id,
      createdAfter: clockBefore.created - 60,
    })
    const [clockAfter, subscriptionAfter, dbUserState, dbSubscriptionState] = await Promise.all([
      stripe.testHelpers.testClocks.retrieve(testClockId),
      stripe.subscriptions.retrieve(subscription.id),
      prisma.user.findUnique({
        where: { id: user.id },
        select: {
          subscriptionStatus: true,
          aiCredits: true,
        },
      }),
      prisma.subscription.findUnique({
        where: { userId: user.id },
        select: {
          stripeId: true,
          status: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          cancelledAt: true,
        },
      }),
    ])

    return privateJson({
      completed: true,
      testClock: {
        id: testClockId,
        before: clockBefore.frozen_time,
        after: clockAfter.frozen_time,
        status: clockAfter.status,
      },
      customerId: customer.id,
      subscription: {
        id: subscription.id,
        status: subscriptionAfter.status,
        cancelAtPeriodEnd: subscriptionAfter.cancel_at_period_end,
        cancelAt: subscriptionAfter.cancel_at,
      },
      checkout: {
        invoiceId: initialInvoice.id,
        chargeId: initialChargeId,
        amountPaid: initialInvoice.amount_paid,
      },
      renewal: {
        invoiceId: renewalInvoice.id,
        chargeId: renewalChargeId,
        amountPaid: renewalInvoice.amount_paid,
      },
      refunds: {
        partial: {
          refundId: partialRefund?.id ?? 'already_applied',
          chargeId: initialChargeId,
          amount: 490,
        },
        full: {
          refundId: fullRefund?.id ?? 'already_applied',
          chargeId: renewalChargeId,
          amount: renewalInvoice.amount_paid,
        },
      },
      webhookReplay: replayedEvents,
      database: {
        user: dbUserState,
        subscription: dbSubscriptionState,
      },
    })
  } catch (error) {
    console.error('[Stripe Sandbox Drill] Failed', error)
    return privateJson({
      error: error instanceof Error ? error.message : 'Stripe sandbox drill failed',
    }, 500)
  }
}
