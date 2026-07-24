import { NextRequest, NextResponse } from 'next/server'

import { getAuthUser } from '@/lib/apiAuth'
import { refreshApprovalPreferenceProposals } from '@/lib/approvalPreferenceLearning'
import { prisma } from '@/lib/prisma'

/**
 * Re-evaluates stored, user-authored approval decisions at zero credit cost.
 * This produces reviewable editorial-preference proposals only. It never
 * treats approval as audience-performance evidence.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    if (!workspace) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

    const result = await refreshApprovalPreferenceProposals(workspace.id)
    return NextResponse.json({
      success: true,
      creditsUsed: 0,
      created: result.created,
      approvalEventCount: result.approvalEventCount,
      uniqueApprovedPostCount: result.uniqueApprovedPostCount,
      duplicateApprovalEventsIgnored: result.duplicateApprovalEventsIgnored,
    })
  } catch (error) {
    console.error('[brain/proposals/refresh POST]', error)
    return NextResponse.json({ error: 'Failed to analyze reviewed decisions' }, { status: 500 })
  }
}
