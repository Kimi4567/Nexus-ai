import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe, PLANS, PlanKey } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

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
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

    // Get or create Stripe customer
    let stripeCustomerId: string | undefined
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } })

    if ((dbUser as any)?.stripeCustomerId) {
      stripeCustomerId = (dbUser as any).stripeCustomerId
    } else {
      const customer = await stripe.customers.create({
        email: user.email!,
        name: dbUser?.name || user.email!,
        metadata: { userId: user.id },
      })
      stripeCustomerId = customer.id
      await prisma.user.upsert({
        where: { id: user.id },
        create: { id: user.id, email: user.email!, ...(({ stripeCustomerId: customer.id }) as any) },
        update: { ...({ stripeCustomerId: customer.id } as any) },
      })
    }

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Nexus AI ${planConfig.name}`,
              description: planConfig.description,
            },
            unit_amount: planConfig.price,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${baseUrl}/billing?success=true&plan=${planKey.toLowerCase()}`,
      cancel_url: `${baseUrl}/billing?cancelled=true`,
      allow_promotion_codes: true,
      metadata: { userId: user.id, plan: planKey },
      subscription_data: { metadata: { userId: user.id, plan: planKey } },
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('[Billing checkout] Error:', err)
    return NextResponse.json({ error: err.message || 'Failed to create checkout session' }, { status: 500 })
  }
}
