/**
 * POST /api/campaigns/[id]/approve-content-plan
 *
 * Approves all DRAFT posts in a campaign's content plan. Approval and scheduling
 * are SEPARATE decisions (the agency "client approval before scheduling" step):
 * - Default (mode 'approve'):  DRAFT → APPROVED only. Sets approvedAt. Does NOT
 *   schedule and does NOT touch scheduledAt. Scheduling happens later via
 *   POST /api/campaigns/[id]/schedule-content-plan.
 * - Assigns integrationId + pageId per platform (FL2A) so a later schedule/publish
 *   has credentials.
 * - Records every transition in PostStatusHistory (actor USER).
 * - Creates reviewed learning proposals. Approval alone never writes "winning"
 *   memory because approval is preference, not performance evidence.
 *
 * DELETE /api/campaigns/[id]/approve-content-plan
 * Reverts all APPROVED or SCHEDULED posts (that haven't published yet) back to DRAFT.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { planApproval, planRevert } from '@/lib/approvalPlan'
import { buildLearningEvents } from '@/lib/brandBrainEvents'
import { canMutateCampaignExecution } from '@/lib/strategyApproval'
import { reviewContentPlanForApproval } from '@/lib/contentPlanApprovalGuard'
import { reviewStrategyGrounding } from '@/lib/ai/marketingQualityGate'
import {
  CAMPAIGN_SNAPSHOT_SCOPE,
  buildContentApprovalSnapshotPayload,
  buildStrategyApprovalSnapshotPayload,
  hashCampaignSnapshotPayload,
} from '@/lib/campaignSnapshots'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, props: Params) {
  const params = await props.params;
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({} as any))
  if (body?.mode === 'approve_and_schedule') {
    return NextResponse.json({
      error: 'Combined approval and scheduling has been removed. Approve copy first, confirm media, then schedule in a separate decision.',
      code: 'SEPARATE_SCHEDULING_REQUIRED',
    }, { status: 410 })
  }
  const mode = 'approve' as const

  try {
    // Verify campaign ownership
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: userId } },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        description: true,
        status: true,
        goal: true,
        audience: true,
        tone: true,
        platforms: true,
        aiOutput: true,
        snapshotVersion: true,
        workspace: {
          select: {
            brandProfile: true,
          },
        },
      },
    })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    if (!canMutateCampaignExecution(String(campaign.status), campaign.aiOutput, campaign.workspace.brandProfile)) {
      return NextResponse.json({
        error: 'Approve the campaign strategy before approving content.',
        code: 'STRATEGY_APPROVAL_REQUIRED',
      }, { status: 409 })
    }

    const strategySnapshot = await prisma.campaignSnapshot.findFirst({
      where: {
        workspaceId: campaign.workspaceId,
        campaignId: campaign.id,
        scope: CAMPAIGN_SNAPSHOT_SCOPE.STRATEGY_APPROVAL,
      },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, scope: true, payloadHash: true },
    })
    if (!strategySnapshot) {
      return NextResponse.json({
        error: 'Revoke and approve the strategy again so its reviewed version can be recorded before content approval.',
        code: 'STRATEGY_APPROVAL_SNAPSHOT_REQUIRED',
      }, { status: 409 })
    }
    const currentStrategyPayload = buildStrategyApprovalSnapshotPayload({
      campaign,
      brandProfile: campaign.workspace.brandProfile,
    })
    if (hashCampaignSnapshotPayload(currentStrategyPayload) !== strategySnapshot.payloadHash) {
      return NextResponse.json({
        error: 'The campaign or Brand Brain changed after strategy approval. Revoke and review the strategy again before approving content.',
        code: 'STRATEGY_APPROVAL_SNAPSHOT_STALE',
        approvedSnapshotVersion: strategySnapshot.version,
      }, { status: 409 })
    }

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

    // Load draft posts (include caption for Brand Brain learning)
    const draftPosts = await (prisma.socialPost as any).findMany({
      where: {
        campaignId: params.id,
        workspaceId: campaign.workspaceId,
        status: 'DRAFT',
        publishedAt: null,
      },
      select: {
        id: true,
        platform: true,
        publishTarget: true,
        caption: true,
        imagePrompt: true,
        videoPrompt: true,
        imageUrl: true,
        link: true,
        uploadedMediaId: true,
        sourceMediaId: true,
        mediaSource: true,
        generationStatus: true,
        isVideoPost: true,
        contentPlanIndex: true,
        variantGroup: true,
        variantLabel: true,
        scheduledAt: true,
        updatedAt: true,
      },
    })

    if (draftPosts.length === 0) {
      return NextResponse.json({ success: true, approved: 0, message: 'No draft posts to approve' })
    }

    const aiOutput = (campaign.aiOutput && typeof campaign.aiOutput === 'object')
      ? campaign.aiOutput as Record<string, any>
      : {}
    const strategy = aiOutput.strategy ?? aiOutput
    const brand = campaign.workspace?.brandProfile
    const brandFacts = [
      brand?.brandName,
      brand?.industry,
      brand?.description,
      brand?.primaryOffer,
      brand?.targetAudience,
      brand?.audienceAge,
      brand?.audienceLocation,
      brand?.audiencePainPoints ?? [],
      brand?.audienceDesires ?? [],
      brand?.uniqueAdvantages ?? [],
      brand?.complianceNotes,
      brand?.verifiedProof ?? [],
    ]
    const strategyQualityGate = reviewStrategyGrounding({
      strategy,
      brand,
      allowedPlatforms: Array.isArray(campaign.platforms) ? campaign.platforms.map(String) : [],
      goal: campaign.goal,
    })
    if (strategyQualityGate.status === 'blocked') {
      return NextResponse.json({
        error: 'Content approval is blocked because the source strategy conflicts with Brand Brain or its reviewed channel scope.',
        code: 'MARKETING_QUALITY_GATE_BLOCKED',
        qualityGate: strategyQualityGate,
      }, { status: 422 })
    }
    const approvalReview = reviewContentPlanForApproval(draftPosts, strategy, brandFacts)

    if (!approvalReview.ok) {
      return NextResponse.json({
        error: 'Content approval is blocked because one or more drafts do not remain safely aligned with the reviewed brand and strategy. Regenerate or edit the drafts, then review again.',
        code: 'CONTENT_QUALITY_REVIEW_REQUIRED',
        issues: approvalReview.issues.slice(0, 12),
      }, { status: 422 })
    }

    // Decide the honest transitions (pure, fully tested in approvalPlan.test.ts):
    //  - DRAFT → APPROVED (sets approvedAt, never schedules)
    const plan = planApproval(
      draftPosts.map((p: any) => ({ id: p.id, workspaceId: campaign.workspaceId, status: 'DRAFT' as const })),
      { actor: 'USER' }
    )
    const updateById = new Map(plan.updates.map(u => [u.id, u.data]))
    const platformById = new Map(draftPosts.map((p: any) => [p.id, String(p.platform)]))

    // Persist the exact reviewed revisions, their immutable snapshot, and audit
    // history atomically. The updatedAt predicate prevents a concurrent edit from
    // being approved using stale content read earlier in this request.
    const approvalResult = await prisma.$transaction(async (tx) => {
      const approvedIds: string[] = []
      for (const [postId, data] of updateById) {
        const sourcePost = draftPosts.find((post: any) => post.id === postId)
        if (!sourcePost) continue
        const match = integrationMap[platformById.get(postId) as string]
        const changed = await tx.socialPost.updateMany({
          where: {
            id: postId,
            campaignId: campaign.id,
            workspaceId: campaign.workspaceId,
            status: 'DRAFT',
            updatedAt: sourcePost.updatedAt,
          },
          data: {
            status: data.status,
            ...(data.approvedAt !== undefined ? { approvedAt: data.approvedAt } : {}),
            ...(match ? { integrationId: match.integrationId, pageId: match.pageId } : {}),
          },
        })
        if (changed.count === 1) approvedIds.push(postId)
      }

      if (approvedIds.length === 0) return { approvedIds, snapshot: null, history: [] as typeof plan.history }

      const versionedCampaign = await tx.campaign.update({
        where: { id: campaign.id },
        data: { snapshotVersion: { increment: 1 } },
        select: { snapshotVersion: true },
      })
      const approvedPosts = draftPosts.filter((post: any) => approvedIds.includes(post.id))
      const payload = buildContentApprovalSnapshotPayload({
        campaignId: campaign.id,
        strategySnapshot,
        posts: approvedPosts,
      })
      const snapshot = await tx.campaignSnapshot.create({
        data: {
          workspaceId: campaign.workspaceId,
          campaignId: campaign.id,
          version: versionedCampaign.snapshotVersion,
          scope: CAMPAIGN_SNAPSHOT_SCOPE.CONTENT_APPROVAL,
          payload: payload as any,
          payloadHash: hashCampaignSnapshotPayload(payload),
          createdById: userId,
        },
        select: { id: true, version: true, payloadHash: true },
      })
      await tx.socialPost.updateMany({
        where: { id: { in: approvedIds }, campaignId: campaign.id, workspaceId: campaign.workspaceId },
        data: {
          approvedSnapshotId: snapshot.id,
          mediaApprovalSnapshotId: null,
          scheduledSnapshotId: null,
        },
      })

      const history = plan.history.filter((entry) => approvedIds.includes(entry.socialPostId))
      if (history.length > 0) await tx.postStatusHistory.createMany({ data: history })
      return { approvedIds, snapshot, history }
    })
    const approved = approvalResult.approvedIds.length

    // Brand Brain (PR1): capture one learning event per ACTUAL transition. Derived from
    // plan.history so re-approving a non-DRAFT post (empty plan) writes nothing — no
    // duplicates, no events for invalid transitions. Non-blocking: never fails approval.
    const approveEvents = buildLearningEvents(
      approvalResult.history.map((h: any) => ({
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
        .catch((e: any) => console.error('[approve-content-plan] learning event write failed', e?.message))
    }

    const approvedIds = new Set(approvalResult.approvedIds)
    const linked   = draftPosts.filter((p: any) => approvedIds.has(p.id) && !!integrationMap[String(p.platform)]).length
    const unlinked = approved - linked

    // Bulk approval is recorded in MarketingLearningEvent as a user decision,
    // but generated copy is not treated as audience-performance evidence.
    const learningProposalQueued = false

    // Build human-readable message (honest about what actually happened)
    let message = `${approved} post${approved !== 1 ? 's' : ''} approved`
    if (linked > 0)         message += ` (${linked} linked to connected platforms)`
    if (learningProposalQueued) message += ' · learning proposals ready for review'

    return NextResponse.json({
      success: true,
      mode,
      approved,
      linked,
      unlinked,
      learningProposalQueued,
      snapshot: approvalResult.snapshot,
      message,
    })
  } catch (err: any) {
    console.error('[approve-content-plan POST]', err)
    return NextResponse.json({ error: 'Failed to approve content plan' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, props: Params) {
  const params = await props.params;
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
        data: {
          status: u.data.status,
          approvedAt: u.data.approvedAt ?? null,
          approvedSnapshotId: null,
          mediaApprovalSnapshotId: null,
          scheduledSnapshotId: null,
        },
      })
    }
    if (plan.history.length > 0) {
      await (prisma as any).postStatusHistory
        .createMany({ data: plan.history })
        .catch((e: any) => console.error('[approve-content-plan revert] history write failed', e?.message))
    }

    // Brand Brain (PR1): capture unschedule / revert events from the actual transitions.
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
        .catch((e: any) => console.error('[approve-content-plan revert] learning event write failed', e?.message))
    }

    return NextResponse.json({ success: true, reverted: plan.changed })
  } catch (err: any) {
    console.error('[approve-content-plan DELETE]', err)
    return NextResponse.json({ error: 'Failed to revert approval' }, { status: 500 })
  }
}
