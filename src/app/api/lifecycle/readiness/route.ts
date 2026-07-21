import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import {
  getLifecycleDatabaseReadiness,
  isLifecycleMessagingRequested,
  isLifecycleRuntimeConfigured,
} from '@/lib/lifecycleReadiness'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const requested = isLifecycleMessagingRequested()
  const runtimeConfigured = isLifecycleRuntimeConfigured()
  const database = requested && runtimeConfigured ? await getLifecycleDatabaseReadiness() : null
  return NextResponse.json({
    ready: requested && runtimeConfigured && database?.ready === true,
    requested,
    runtimeConfigured,
    databaseState: database?.state ?? 'not_checked',
    deliveryProvider: 'NOT_CONNECTED',
    sendsEnabled: false,
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}
