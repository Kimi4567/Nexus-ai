/**
 * POST /api/billing/portal
 * Creates a Stripe Customer Portal session and returns the URL.
 * Allows users to manage their subscription, update payment method, cancel, etc.
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { prisma } from '@/lib/prisma'
import {
  billingNotConfiguredResponse,
  getStripeClient,
  isBillingConfigured,
} from '@/lib/stripe'
import { getRequestBaseUrl } from '@/lib/requestBaseUrl'

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

    // ── Resolve Stripe customer ─────────────────────────────────────────────
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { stripeCustomerId: true },
    })

    if (!dbUser?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No billing account found. Subscribe to a plan first.' },
        { status: 400 }
      )
    }

    const baseUrl = getRequestBaseUrl(req)
    const stripe = getStripeClient()

    // ── Create portal session ───────────────────────────────────────────────
    const portalSession = await stripe.billingPortal.sessions.create({
      customer:   dbUser.stripeCustomerId,
      return_url: `${baseUrl}/billing`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (err: any) {
    console.error('[Billing Portal] Error:', err?.message || err)
    return NextResponse.json({ error: 'Failed to open billing portal' }, { status: 500 })
  }
}
