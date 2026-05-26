import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import { getCustomerPortalUrl } from '@/lib/lemonsqueezy'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
    const subscription = await prisma.subscription.findUnique({ where: { userId: user.id } })

    if (!subscription?.stripeId) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
    }

    const portalUrl = await getCustomerPortalUrl(subscription.stripeId)
    return NextResponse.json({ url: portalUrl })
  } catch (err: any) {
    console.error('[Billing portal] Error:', err)
    return NextResponse.json({ error: err.message || 'Failed to open billing portal' }, { status: 500 })
  }
}
