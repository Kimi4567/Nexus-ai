/**
 * POST /api/campaigns/[id]/approve-content-plan
 *
 * Approves all DRAFT posts in a campaign's content plan. Approval and scheduling
 * are SEPARATE decisions (the agency "client approval before scheduling" step):
 * - Default (mode 'approve'):  DRAFT → APPROVED only. Sets approvedAt. Does NOT
 *   schedule and does NOT touch scheduledAt. Scheduling happens later via
 *   POST /api/campaigns/[id]/schedule-content-plan.
 * - Legacy (mode 'approve_and_schedule'): the old one-click behaviour — DRAFT →
 *   SCHEDULED in one step. Kept explicit for any flow that still needs it; never
 *   the default.
 * - Assigns integrationId + pageId per platform (FL2A) so a later schedule/publish
 *   has credentials.
 * - Records every transition in PostStatusHistory (actor USER).
 * - Records approval as workflow/review signals only. Approval is not analytics-backed learning.
 *
 * DELETE /api/campaigns/[id]/approve-content-plan
 * Reverts all APPROVED or SCHEDULED posts (that haven't published yet) back to DRAFT.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { runBrainLearning } from '@/lib/brain-learning'
import { planApproval, planRevert, type ApprovalMode } from '@/lib/approvalPlan'
import { buildLearningEvents } from '@/lib/brandBrainEvents'
import { getBrandBrainLearningCopy } from '@/lib/brandBrainLearningContract'
import {
  buildContentPlanOrderMismatchMessage,
  deriveContentPlanOrderReview,
} from '@/lib/contentPlanOrderContract'

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // mode: 'approve' (default, DRAFT→APPROVED) | 'approve_and_schedule' (legacy, DRAFT→SCHEDULED)
  const body = await req.json().catch(() => ({} as any))
  const mode: ApprovalMode = body?.mode === 'approve_and_schedule' ? 'approve_and_schedule' : 'approve'

  try {
    // Verify campaign ownership
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: userId } },
      select: { id: true, workspaceId: true, name: true, aiOutput: true },
    })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    // FL2A: Build platform → integration map so the publish cron has credentials
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
      const pageId: string | null = pages[0]?.id ?? intg.accountId ?? null
      integrationMap[key] = { integrationId: intg.id, pageId }
    }

    // Load draft posts (include caption for optional approval-signal extraction)
    const draftPosts = await (prisma.socialPost as any).findMany({
      where: {
        campaignId: params.id,
        workspaceId: campaign.workspaceId,
        status: 'DRAFT',
        publishedAt: null,
      },
      select: { id: true, platform: true, caption: true },
    })

    if (draftPosts.length === 0) {
      return NextResponse.json({ success: true, approved: 0, message: 'No draft posts to approve' })
    }

    const contentPlanPosts = await (prisma.socialPost as any).findMany({
      where: {
        campaignId: params.id,
        workspaceId: campaign.workspaceId,
      },
      select: { contentPlanIndex: true, variantGroup: true },
    })

    const orderReview = deriveContentPlanOrderReview(campaign.aiOutput, contentPlanPosts)
    const orderMismatchMessage = buildContentPlanOrderMismatchMessage(orderReview)
    if (orderMismatchMessage) {
      return NextResponse.json(
        {
          error: orderMismatchMessage,
          code: 'CONTENT_PLAN_ORDER_MISMATCH',
          expectedDirections: orderReview.expectedDirections,
          actualDirections: orderReview.actualDirections,
          reason: orderReview.reason,
        },
        { status: 409 },
      )
    }

    // Decide the honest transitions (pure, fully tested in approvalPlan.test.ts):
    //  - 'approve' (default): DRAFT → APPROVED  (sets approvedAt, never schedules)
    //  - 'approve_and_schedule' (legacy): DRAFT → SCHEDULED in one explicit step
    const plan = planApproval(
      draftPosts.map((p: any) => ({ id: p.id, workspaceId: campaign.workspaceId, status: 'DRAFT' as const })),
      { mode, actor: 'USER' }
    )
    const updateById = new Map(plan.updates.map(u => [u.id, u.data]))
    const platformById = new Map(draftPosts.map((p: any) => [p.id, String(p.platform)]))

    // Apply the planned status change + assign integration credentials where available.
    let approved = 0
    for (const [postId, data] of updateById) {
      const match = integrationMap[platformById.get(postId) as string]
      await (prisma.socialPost as any).update({
        where: { id: postId },
        data: {
          status: data.status,
          ...(data.approvedAt !== undefined ? { approvedAt: data.approvedAt } : {}),
          ...(match ? { integrationId: match.integrationId, pageId: match.pageId } : {}),
        },
      })
      approved++
    }

    // Record the lifecycle transitions for the audit trail / future Brand Brain.
    if (plan.history.length > 0) {
      await (prisma as any).postStatusHistory
        .createMany({ data: plan.history })
        .catch((e: any) => console.error('[approve-content-plan] history write failed', e?.message))
    }

    // Brand Brain (PR1): capture one workflow signal per ACTUAL transition. Derived from
    // plan.history so re-approving a non-DRAFT post (empty plan) writes nothing — no
    // duplicates, no events for invalid transitions. Non-blocking: never fails approval.
    const approveEvents = buildLearningEvents(
      plan.history.map((h: any) => ({
        workspaceId: h.workspaceId,
        campaignId: campaign.id,
        socialPostId: h.socialPostId,
        from: h.fromStatus ?? null,
        to: h.toStatus,
        actor: h.actor,
        publishMode: 'MANUAL',
        platform: (platformById.get(h.socialPostId) as string | undefined) ?? null,
        approvedAt: updateById.get(h.socialPostId)?.approvedAt ?? null,
      }))
    )
    if (approveEvents.length > 0) {
      await (prisma as any).marketingLearningEvent
        .createMany({ data: approveEvents })
        .catch((e: any) => console.error('[approve-content-plan] workflow signal write failed', e?.message))
    }

    const approvedIds = new Set(updateById.keys())
    const linked   = draftPosts.filter((p: any) => approvedIds.has(p.id) && !!integrationMap[String(p.platform)]).length
    const unlinked = approved - linked

    const captions: string[] = draftPosts
      .map((p: any) => p.caption)
      .filter((c: any): c is string => typeof c === 'string' && c.trim().length > 10)

    // ── BL3: Brain signal proposal system (non-blocking) ─────────────────────────
    // Creates pending review-signal proposals (tone, pain points, desires)
    // that the user reviews in BrainLearningPanel (accept/dismiss).
    if (captions.length >= 3) {
      const allPosts = draftPosts
        .filter((p: any) => typeof p.caption === 'string' && p.caption.trim().length > 10)
        .map((p: any) => ({ platform: String(p.platform), caption: p.caption }))

      runBrainLearning({
        workspaceId: campaign.workspaceId,
        campaignId: campaign.id,
        trigger: 'approved_content',
        payload: { posts: allPosts },
      }).catch(() => null) // fire-and-forget — never block approval
    }

    // Build human-readable message (honest about what actually happened)
    const verb = mode === 'approve_and_schedule' ? 'scheduled' : 'approved'
    let message = `${approved} post${approved !== 1 ? 's' : ''} ${verb}`
    if (linked > 0)         message += ` (${linked} linked to connected platforms)`
    if (approveEvents.length > 0) {
      const approvalCopy = getBrandBrainLearningCopy('approval')
      message += ` · ${approvalCopy.label}`
    }

    return NextResponse.json({
      success: true,
      mode,
      approved,
      linked,
      unlinked,
      signals: {
        approvalEvents: approveEvents.length,
        description: getBrandBrainLearningCopy('approval').description,
      },
      message,
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

    // Revert APPROVED or SCHEDULED → DRAFT (only unpublished posts). Clears
    // approvedAt and records the un-approve / un-schedule transition(s).
    const livePosts = await (prisma.socialPost as any).findMany({
      where: {
        campaignId: params.id,
        workspaceId: campaign.workspaceId,
        status: { in: ['APPROVED', 'SCHEDULED'] },
        publishedAt: null,
      },
      select: { id: true, status: true },
    })

    const plan = planRevert(
      livePosts.map((p: any) => ({ id: p.id, workspaceId: campaign.workspaceId, status: p.status })),
      { actor: 'USER' }
    )

    for (const u of plan.updates) {
      await (prisma.socialPost as any).update({
        where: { id: u.id },
        data: { status: u.data.status, approvedAt: u.data.approvedAt ?? null },
      })
    }
    if (plan.history.length > 0) {
      await (prisma as any).postStatusHistory
        .createMany({ data: plan.history })
        .catch((e: any) => console.error('[approve-content-plan revert] history write failed', e?.message))
    }

    // Brand Brain (PR1): capture unschedule / revert workflow signals from the actual transitions.
    const revertEvents = buildLearningEvents(
      plan.history.map((h: any) => ({
        workspaceId: h.workspaceId,
        campaignId: campaign.id,
        socialPostId: h.socialPostId,
        from: h.fromStatus ?? null,
        to: h.toStatus,
        actor: h.actor,
        publishMode: 'MANUAL',
      }))
    )
    if (revertEvents.length > 0) {
      await (prisma as any).marketingLearningEvent
        .createMany({ data: revertEvents })
        .catch((e: any) => console.error('[approve-content-plan revert] workflow signal write failed', e?.message))
    }

    return NextResponse.json({ success: true, reverted: plan.changed })
  } catch (err: any) {
    console.error('[approve-content-plan DELETE]', err)
    return NextResponse.json({ error: 'Failed to revert approval' }, { status: 500 })
  }
}
