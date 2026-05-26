import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [dbUser, subscription] = await Promise.all([
      prisma.user.findUnique({ where: { id: user.id } }),
      prisma.subscription.findUnique({ where: { userId: user.id } }),
    ])

    return NextResponse.json({
      status: dbUser?.subscriptionStatus || 'FREE',
      plan: subscription?.plan || 'FREE',
      credits: dbUser?.aiCredits || 0,
      currentPeriodEnd: subscription?.currentPeriodEnd || null,
      hasStripeCustomer: !!(dbUser as any)?.stripeCustomerId,
    })
  } catch (err: any) {
    console.error('[Billing status] Error:', err)
    return NextResponse.json({ error: 'Failed to get billing status' }, { status: 500 })
  }
}
