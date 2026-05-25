import { NextResponse } from 'next/server'
import { buffer } from 'node:stream/consumers'

export async function POST(req: Request) {
  // Stub for Stripe webhook handling. In live mode you must verify signatures.
  try {
    const body = await req.text()
    console.log('Webhook received (stub):', body.slice(0, 200))
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook error', err)
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 })
  }
}
