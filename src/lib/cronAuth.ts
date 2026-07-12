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
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
