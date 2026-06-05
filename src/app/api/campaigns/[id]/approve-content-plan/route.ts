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

    // FL2A: Build platform → integration map so the publish cron has credentials
    // Exclude non-social integrations; prefer first connected one per platform type
    const connectedIntegrations = await prisma.integration.findMany({
      where: {
        workspaceId: campaign.workspaceId,
        status: 'CONNECTED' as any,
        type: { notIn: ['STRIPE', 'CLOUDINARY', 'GOOGLE', 'SLACK'] as any[] },
      },
      select: { id: true, type: true, config: true, accountId: true },
    })

    // Map: IntegrationType → { integrationId, pageId }
    const integrationMap: Record<string, { integrationId: string; pageId: string | null }> = {}
    for (const intg of connectedIntegrations) {
      const key = String(intg.type)
      if (integrationMap[key]) continue // keep first
      const pages: any[] = (intg.config as any)?.pages ?? []
      const pageId: string | null = pages[0]?.id ?? intg.accountId ?? null
      integrationMap[key] = { integrationId: intg.id, pageId }
    }

    // Load draft posts so we can assign per-platform integration
    const draftPosts = await (prisma.socialPost as any).findMany({
      where: {
        campaignId: params.id,
        workspaceId: campaign.workspaceId,
        status: 'DRAFT',
        publishedAt: null,
      },
      select: { id: true, platform: true },
    })

    if (draftPosts.length === 0) {
      return NextResponse.json({ success: true, approved: 0, message: 'No draft posts to approve' })
    }

    // Update each post: DRAFT → SCHEDULED + assign integrationId where available
    let approved = 0
    for (const post of draftPosts) {
      const platformKey = String(post.platform)
      const match = integrationMap[platformKey]

      await (prisma.socialPost as any).update({
        where: { id: post.id },
        data: {
          status: 'SCHEDULED',
          ...(match ? { integrationId: match.integrationId, pageId: match.pageId } : {}),
        },
      })
      approved++
    }

    const linked  = draftPosts.filter((p: any) => !!integrationMap[String(p.platform)]).length
    const unlinked = approved - linked

    return NextResponse.json({
      success: true,
      approved,
      linked,
      unlinked,
      message: `${approved} posts scheduled${linked > 0 ? ` (${linked} linked to connected platforms)` : ''}`,
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
