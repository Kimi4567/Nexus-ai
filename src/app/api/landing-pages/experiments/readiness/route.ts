import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { getLandingPageGate } from '@/lib/landingPageAccess'
import {
  getLandingExperimentDatabaseReadiness,
  isLandingPageExperimentsRequested,
} from '@/lib/landingPageExperimentReadiness'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const requested = isLandingPageExperimentsRequested()
  const landingPages = requested ? await getLandingPageGate() : null
  const database = requested && landingPages?.ready
    ? await getLandingExperimentDatabaseReadiness()
    : null
  const ready = requested && landingPages?.ready === true && database?.ready === true

  return NextResponse.json({
    ready,
    requested,
    landingPagesReady: landingPages?.ready ?? null,
    databaseState: database?.state ?? 'not_checked',
    schema: { experiments: database?.experiments ?? null, assignments: database?.assignments ?? null },
    truth: {
      successMetric: 'SERVER_CONFIRMED_FORM_SUBMISSION',
      pageViews: 'CLIENT_REPORTED',
      decision: 'HUMAN_REVIEW_AFTER_MINIMUM_EVIDENCE',
      statisticalWinnerClaimed: false,
      revenueTracking: false,
    },
  }, {
    status: requested && !ready ? 503 : 200,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
