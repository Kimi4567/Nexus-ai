/**
 * POST /api/campaigns/[id]/schedule-content-plan
 *
 * Schedules a campaign's APPROVED content-plan posts: APPROVED → SCHEDULED only.
 * This is the SEPARATE scheduling decision that follows approval. It:
 * - moves only APPROVED posts (a DRAFT post can never be scheduled directly here),
 * - keeps the planned scheduledAt from generation (never overwrites it),
 * - assigns integrationId + pageId per platform if still missing,
 * - records APPROVED → SCHEDULED in PostStatusHistory (actor USER),
 * - never marks anything PUBLISHED and never touches cron/publishing behaviour.
 *
 * DELETE /api/campaigns/[id]/schedule-content-plan
 * Unschedules: SCHEDULED → APPROVED (keeps the approval, just pulls it off the
 * schedule). Published posts are untouched.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { planScheduling } from '@/lib/approvalPlan'
import { validateTransition, buildStatusHistory } from '@/lib/postStatus'

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: userId } },
      select: { id: true, workspaceId: true },
    })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    // Build platform → integration map so a scheduled post has publish credentials.
    const connectedIntegrations = await prisma.integration.findMany({
      where: {
        workspaceId: campaign.workspaceId,
        status: 'CONNECTED' as any,
        type: { notIn: ['STRIPE', 'CLOUDINARY', 'GOOGLE', 'SLACK'] as any[] },
      },
      select: { id: true, type: true, config: true, accountId: true },
    })
    const integrationMap: Record<string, { integrationId: string; pageId: string | null }> = {}
    for (const intg of connectedIntegrations) {
      const key = String(intg.type)
      if (integrationMap[key]) continue
      const pages: any[] = (intg.config as any)?.pages ?? []
      integrationMap[key] = { integrationId: intg.id, pageId: pages[0]?.id ?? intg.accountId ?? null }
    }

    const approvedPosts = await (prisma.socialPost as any).findMany({
      where: {
        campaignId: params.id,
        workspaceId: campaign.workspaceId,
        status: 'APPROVED',
        publishedAt: null,
      },
      select: { id: true, platform: true, integrationId: true },
    })

    if (approvedPosts.length === 0) {
      return NextResponse.json({ success: true, scheduled: 0, message: 'No approved posts to schedule' })
    }

    const plan = planScheduling(
      approvedPosts.map((p: any) => ({ id: p.id, workspaceId: campaign.workspaceId, status: 'APPROVED' as const })),
      { actor: 'USER' }
    )
    const platformById = new Map(approvedPosts.map((p: any) => [p.id, String(p.platform)]))
    const hasIntegrationById = new Map(approvedPosts.map((p: any) => [p.id, !!p.integrationId]))

    let scheduled = 0
    for (const u of plan.updates) {
      const match = integrationMap[platformById.get(u.id) as string]
      const needsIntegration = !hasIntegrationById.get(u.id)
      await (prisma.socialPost as any).update({
        where: { id: u.id },
        data: {
          status: u.data.status, // SCHEDULED — planned scheduledAt is kept, never overwritten
          ...(needsIntegration && match ? { integrationId: match.integrationId, pageId: match.pageId } : {}),
        },
      })
      scheduled++
    }

    if (plan.history.length > 0) {
      await (prisma as any).postStatusHistory
        .createMany({ data: plan.history })
        .catch((e: any) => console.error('[schedule-content-plan] history write failed', e?.message))
    }

    const linked = approvedPosts.filter((p: any) => !!integrationMap[String(p.platform)]).length
    return NextResponse.json({
      success: true,
      scheduled,
      linked,
      message: `${scheduled} post${scheduled !== 1 ? 's' : ''} scheduled`,
    })
  } catch (err: any) {
    console.error('[schedule-content-plan POST]', err)
    return NextResponse.json({ error: 'Failed to schedule content plan' }, { status: 500 })
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

    // Unschedule: SCHEDULED → APPROVED (keeps approval). Only unpublished posts.
    const scheduledPosts = await (prisma.socialPost as any).findMany({
      where: {
        campaignId: params.id,
        workspaceId: campaign.workspaceId,
        status: 'SCHEDULED',
        publishedAt: null,
      },
      select: { id: true },
    })

    let reverted = 0
    const history: any[] = []
    for (const p of scheduledPosts) {
      if (!validateTransition('SCHEDULED', 'APPROVED').ok) continue
      await (prisma.socialPost as any).update({ where: { id: p.id }, data: { status: 'APPROVED' } })
      history.push(buildStatusHistory({ socialPostId: p.id, workspaceId: campaign.workspaceId, fromStatus: 'SCHEDULED', toStatus: 'APPROVED', actor: 'USER', note: 'unschedule' }))
      reverted++
    }
    if (history.length > 0) {
      await (prisma as any).postStatusHistory
        .createMany({ data: history })
        .catch((e: any) => console.error('[schedule-content-plan DELETE] history write failed', e?.message))
    }

    return NextResponse.json({ success: true, reverted })
  } catch (err: any) {
    console.error('[schedule-content-plan DELETE]', err)
    return NextResponse.json({ error: 'Failed to unschedule content plan' }, { status: 500 })
  }
}
