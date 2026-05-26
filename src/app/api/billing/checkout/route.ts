import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PLANS, PlanKey, createCheckoutUrl } from '@/lib/lemonsqueezy'

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

    const { plan } = await req.json()
    const planKey = (plan as string)?.toUpperCase() as PlanKey

    if (!PLANS[planKey]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const planConfig = PLANS[planKey]
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    if (!planConfig.variantId) {
      console.error(`[Checkout] Missing LS_VARIANT_${planKey} env var`)
      return NextResponse.json({ error: 'Plan not configured' }, { status: 500 })
    }

    const checkoutUrl = await createCheckoutUrl(
      planConfig.variantId,
      user.email!,
      user.id,
      planKey,
      baseUrl
    )

    return NextResponse.json({ url: checkoutUrl })
  } catch (err: any) {
    console.error('[Billing checkout] Error:', err)
    return NextResponse.json({ error: err.message || 'Failed to create checkout session' }, { status: 500 })
  }
}
