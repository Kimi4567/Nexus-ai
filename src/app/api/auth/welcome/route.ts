/**
 * POST /api/auth/welcome
 * Sends welcome email after new user registration.
 * Called client-side immediately after signup.
 */
import { NextRequest, NextResponse } from 'next/server'
import { sendWelcomeEmail } from '@/lib/email/resend'

// Simple in-memory dedup — prevents double sends on re-renders
const sentEmails = new Set<string>()

export async function POST(req: NextRequest) {
  try {
    const { email, name } = await req.json()
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    // Dedup check
    if (sentEmails.has(email)) {
      return NextResponse.json({ ok: true, skipped: true })
    }
    sentEmails.add(email)
    // Clear after 1 hour
    setTimeout(() => sentEmails.delete(email), 3_600_000)

    if (!process.env.RESEND_API_KEY) {
      console.warn('[Welcome email] RESEND_API_KEY not set — skipping')
      return NextResponse.json({ ok: true, skipped: true })
    }

    await sendWelcomeEmail(email, name || email.split('@')[0])
    console.log('[Welcome email] Sent to', email)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    // Never block registration on email failure
    console.error('[Welcome email] Error:', err?.message)
    return NextResponse.json({ ok: true, error: err?.message })
  }
}
