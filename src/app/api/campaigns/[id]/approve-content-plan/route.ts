/**
 * POST /api/campaigns/[id]/approve-content-plan
 *
 * Approves all DRAFT posts in a campaign's content plan:
 * - Moves status: DRAFT → SCHEDULED
 * - Keeps existing scheduledAt times (set during generation)
 * - Returns count of approved posts
 *
 * DELETE /api/campaigns/[id]/approve-content-plan
 * Reverts all SCHEDULED posts (that haven't published yet) back to DRAFT.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Verify campaign ownership
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: userId } },
      select: { id: true, workspaceId: true },
    })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    // Move all DRAFT posts → SCHEDULED
    const result = await prisma.socialPost.updateMany({
      where: {
        campaignId: params.id,
        workspaceId: campaign.workspaceId,
        status: 'DRAFT',
        publishedAt: null,
      },
      data: {
        status: 'SCHEDULED',
      },
    })

    return NextResponse.json({
      success: true,
      approved: result.count,
      message: `${result.count} posts scheduled for publishing`,
    })
  } catch (err: any) {
    console.error('[approve-content-plan POST]', err)
    return NextResponse.json({ error: 'Failed to approve content plan' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: userId } },
      select: { id: true, workspaceId: true },
    })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    // Revert SCHEDULED → DRAFT (only unpublished posts)
    const result = await prisma.socialPost.updateMany({
      where: {
        campaignId: params.id,
        workspaceId: campaign.workspaceId,
        status: 'SCHEDULED',
        publishedAt: null,
      },
      data: {
        status: 'DRAFT',
      },
    })

    return NextResponse.json({ success: true, reverted: result.count })
  } catch (err: any) {
    console.error('[approve-content-plan DELETE]', err)
    return NextResponse.json({ error: 'Failed to revert approval' }, { status: 500 })
  }
}
