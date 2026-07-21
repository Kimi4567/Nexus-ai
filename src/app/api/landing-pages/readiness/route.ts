import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import {
  getLandingPageDatabaseReadiness,
  isLandingPagesRequested,
  isLandingPagesRuntimeConfigured,
} from '@/lib/landingPageReadiness'
import { getLeadCrmDatabaseReadiness } from '@/lib/leadCrmReadiness'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const requested = isLandingPagesRequested()
  const runtimeConfigured = isLandingPagesRuntimeConfigured()
  const [database, leadCrm] = requested && runtimeConfigured
    ? await Promise.all([getLandingPageDatabaseReadiness(), getLeadCrmDatabaseReadiness()])
    : [null, null]
  const ready = requested && runtimeConfigured && database?.ready === true && leadCrm?.ready === true

  return NextResponse.json({
    ready,
    requested,
    runtimeConfigured,
    databaseState: database?.state ?? 'not_checked',
    leadCrmState: leadCrm?.state ?? 'not_checked',
    schema: {
      landingPages: database?.landingPages ?? null,
      revisions: database?.revisions ?? null,
      conversionEvents: database?.conversionEvents ?? null,
    },
    conversionTruth: {
      pageViews: 'CLIENT_REPORTED',
      ctaClicks: 'CLIENT_REPORTED',
      formSubmissions: 'SERVER_CONFIRMED',
      wonOutcomes: 'MANUAL_CONFIRMED',
      revenueTracking: 'MANUAL_CONFIRMED',
      platformPermissionsRequired: false,
    },
  }, {
    status: requested && !ready ? 503 : 200,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
