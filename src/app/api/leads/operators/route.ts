import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { findPrimaryLeadWorkspace, listLeadOperators } from '@/lib/leadCrmAccess'
import { getLeadCrmDatabaseReadiness, isLeadCrmRequested, leadCrmUnavailableResponse } from '@/lib/leadCrmReadiness'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isLeadCrmRequested()) return NextResponse.json(leadCrmUnavailableResponse(), { status: 503 })
  const readiness = await getLeadCrmDatabaseReadiness()
  if (!readiness.ready) return NextResponse.json(leadCrmUnavailableResponse(readiness), { status: 503 })

  const workspace = await findPrimaryLeadWorkspace(userId)
  if (!workspace) return NextResponse.json({ operators: [] })
  const operators = await listLeadOperators(workspace.id, userId)
  return NextResponse.json({ operators }, { headers: { 'Cache-Control': 'private, no-store' } })
}
