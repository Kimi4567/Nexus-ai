/**
 * POST /api/auth/welcome
 * Sends a welcome email only to the authenticated Supabase user's own address.
 */
import { NextRequest, NextResponse } from 'next/server'
import { sendWelcomeEmail } from '@/lib/email/resend'
import { getAuthUser } from '@/lib/apiAuth'
import { dbRateLimit } from '@/lib/dbRateLimit'

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user?.id || !user.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const requestedEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!requestedEmail || requestedEmail !== user.email.toLowerCase()) {
      return NextResponse.json({ error: 'Email must match the authenticated account' }, { status: 403 })
    }

    const rateLimit = await dbRateLimit(`welcome:${user.id}`, { limit: 1, windowMs: 24 * 60 * 60_000 })
    if (!rateLimit.ok) return NextResponse.json({ ok: true, skipped: true })
    if (!process.env.RESEND_API_KEY) return NextResponse.json({ ok: true, skipped: true })

    const name = typeof body.name === 'string' && body.name.trim()
      ? body.name.trim().slice(0, 100)
      : user.email.split('@')[0]
    await sendWelcomeEmail(user.email, name)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Welcome email] Error:', error)
    // Email failure must not undo registration, but remains observable.
    return NextResponse.json({ ok: false, error: 'Welcome email failed' }, { status: 502 })
  }
}
