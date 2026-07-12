import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { getWorkspaceExecutionTruth } from '@/lib/executionTruthService'

export async function GET(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const campaignId = req.nextUrl.searchParams.get('campaignId')
    const truth = await getWorkspaceExecutionTruth(userId, { campaignId })
    return NextResponse.json({ truth })
  } catch (error) {
    console.error('[execution/queue]', error)
    return NextResponse.json({ error: 'Failed to load execution queue' }, { status: 500 })
  }
}
