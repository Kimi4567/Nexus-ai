/**
 * POST /api/auth/welcome
 * Sends welcome email after new user registration.
 * Called client-side immediately after signup.
 *
 * Security: Rate-limited per IP (3 requests/hour) + per email (once/24h).
 * The email dedup prevents spam to arbitrary addresses from re-renders or bots.
 */
import { NextRequest, NextResponse } from 'next/server'
import { sendWelcomeEmail } from '@/lib/email/resend'

// ── In-memory dedup (resets on deploy — acceptable for welcome email) ─────────
// emailSent: each address can only receive 1 welcome email per 24h
// ipHits: IP can trigger at most IP_LIMIT sends per hour
const emailSent  = new Map<string, number>()  // email → timestamp
const ipHits     = new Map<string, { count: number; resetAt: number }>()

const EMAIL_TTL_MS = 24 * 60 * 60 * 1000  // 24 hours
const IP_LIMIT     = 3                      // max 3 welcome emails per IP per hour
const IP_WINDOW_MS = 60 * 60 * 1000        // 1 hour

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

function checkIpLimit(ip: string): boolean {
  const now   = Date.now()
  const entry = ipHits.get(ip)
  if (!entry || now > entry.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + IP_WINDOW_MS })
    return true
  }
  if (entry.count >= IP_LIMIT) return false
  entry.count++
  return true
}

// Basic email format validation — blocks obvious spam targets
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length < 256
}

export async function POST(req: NextRequest) {
  try {
    const { email, name } = await req.json()
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }

    const ip  = getClientIp(req)
    const now = Date.now()

    // IP rate limit
    if (!checkIpLimit(ip)) {
      return NextResponse.json({ ok: true, skipped: true })  // silent — never block signup
    }

    // Per-email dedup (24h)
    const lastSent = emailSent.get(email)
    if (lastSent && now - lastSent < EMAIL_TTL_MS) {
      return NextResponse.json({ ok: true, skipped: true })
    }
    emailSent.set(email, now)
    // Clean up old entries to prevent memory leak
    if (emailSent.size > 5000) {
      const cutoff = now - EMAIL_TTL_MS
      for (const [k, v] of emailSent.entries()) {
        if (v < cutoff) emailSent.delete(k)
      }
    }

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
