import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import {
  getLeadCrmDatabaseReadiness,
  isLeadCrmRequested,
} from '@/lib/leadCrmReadiness'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isLeadCrmRequested()) {
    return NextResponse.json({
      enabled: false,
      ready: false,
      state: 'disabled',
      migrationRequired: false,
      outreachAutomation: false,
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  }

  const database = await getLeadCrmDatabaseReadiness()
  return NextResponse.json({
    enabled: true,
    ready: database.ready,
    state: database.state,
    migrationRequired: database.state === 'migration_required',
    schema: {
      leads: database.leads,
      activities: database.activities,
      tasks: database.tasks,
      captureForms: database.captureForms,
      outcomeMeasurement: database.outcomeMeasurement,
    },
    outreachAutomation: false,
  }, {
    status: database.ready ? 200 : 503,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
