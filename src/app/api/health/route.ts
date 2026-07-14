import { NextRequest, NextResponse } from 'next/server'
import { cronAuthError } from '@/lib/cronAuth'
import { getRuntimeConfig } from '@/lib/runtimeConfig'

export const dynamic = 'force-dynamic'

/**
 * Liveness/readiness endpoint.
 *
 * The default response is intentionally tiny and public so load balancers can
 * probe it without receiving configuration details. `?detail=1` is restricted
 * with the same Bearer CRON_SECRET used by scheduled jobs and is suitable for
 * deployment checks and incident triage.
 */
export async function GET(req: NextRequest) {
  const now = new Date().toISOString()
  if (req.nextUrl.searchParams.get('detail') !== '1') {
    return NextResponse.json({ ok: true, service: 'nexus-ai', timestamp: now })
  }

  const authError = cronAuthError(req)
  if (authError) return authError

  const config = getRuntimeConfig()
  return NextResponse.json({
    ok: config.ready,
    service: 'nexus-ai',
    timestamp: now,
    config,
  }, { status: config.ready ? 200 : 503 })
}
