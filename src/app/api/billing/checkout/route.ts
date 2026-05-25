import { NextResponse } from 'next/server'
import { createCustomer, createSubscription, PRICING } from '@/lib/stripe'
import { getServerUserId } from '@/lib/apiAuth'

async function getUserId(req: Request) {
  return getServerUserId(req)
}

export async function POST(req: Request) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { plan } = body
  if (!plan) return NextResponse.json({ error: 'plan required' }, { status: 400 })

  try {
    const pricing = PRICING[plan as keyof typeof PRICING]
    if (!pricing) return NextResponse.json({ error: 'invalid plan' }, { status: 400 })

    // In mock mode, return a fake checkout URL
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ url: `/billing/mock/checkout?plan=${plan}` })
    }

    // Live mode: create Stripe customer and subscription
    const customer = await createCustomer('customer@example.com')
    const subscription = await createSubscription(customer.id, pricing.priceId as string)
    return NextResponse.json({ subscription })
  } catch (err) {
    console.error('Checkout error', err)
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 })
  }
}
