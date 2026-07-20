import { NextResponse } from 'next/server'

/**
 * Every scheduled route fails closed in every environment. Local execution must
 * set CRON_SECRET and send the same Vercel-compatible Bearer header as
 * production, so development never exercises a weaker security path.
 */
export function cronAuthError(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  // Preview/test environments often use short fixtures, but production must
  // never accept a placeholder or trivially guessable cron credential.
  if (
    process.env.NODE_ENV === 'production' &&
    (secret.trim().length < 32 || /^generate[-_]/i.test(secret.trim()) || /^your[-_]/i.test(secret.trim()))
  ) {
    return NextResponse.json({ error: 'CRON_SECRET is too weak for production' }, { status: 500 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

/**
 * Boolean form for trusted server-to-server delegation. The same fail-closed
 * production rules as public cron routes apply; callers must never implement a
 * second, weaker comparison for internal workers.
 */
export function isCronRequestAuthorized(req: Request): boolean {
  return cronAuthError(req) === null
}
