import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { getCanonicalApprovalInbox } from '@/lib/approvalInboxService'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const inbox = await getCanonicalApprovalInbox(userId)
    return NextResponse.json({ inbox }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    console.error('[approvals/inbox]', error)
    return NextResponse.json({ error: 'Failed to load approval inbox' }, { status: 500 })
  }
}
