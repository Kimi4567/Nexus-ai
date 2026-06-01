/**
 * POST /api/billing/portal
 * Creates a Stripe Customer Portal session and returns the URL.
 * Allows users to manage their subscription, update payment method, cancel, etc.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

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

  const baseUrl = getBaseUrl()

  // ── Create portal session ───────────────────────────────────────────────
  const portalSession = await stripe.billingPortal.sessions.create({
    customer:   dbUser.stripeCustomerId,
    return_url: `${baseUrl}/billing`,
  })

  return NextResponse.json({ url: portalSession.url })
}
