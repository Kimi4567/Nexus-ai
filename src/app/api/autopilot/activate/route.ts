/**
 * POST /api/autopilot/activate
 *
 * Enables monitoring for an already reviewed AUTO publishing queue.
 * This route never generates copy, never schedules a post, never calls an AI
 * provider, and never consumes credits. Content creation belongs exclusively to
 * Content Hub; approval and AUTO scheduling remain explicit user decisions.
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { prisma } from '@/lib/prisma'
import { getStrategyApprovalContract, StrategyApprovalError } from '@/lib/strategyApprovalService'
import { reviewStrategyGrounding } from '@/lib/ai/marketingQualityGate'
import { reviewContentPostForPublishing } from '@/lib/contentPlanApprovalGuard'
import { isContentPostMediaReadyForScheduling } from '@/lib/contentHubMediaState'

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user } } = await adminClient.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({})) as {
      campaignId?: unknown
      explicitAutopilotConfirmed?: unknown
    }
    const campaignId = typeof body.campaignId === 'string' ? body.campaignId : ''
    if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 })
    if (body.explicitAutopilotConfirmed !== true) {
      return NextResponse.json({
        error: 'Explicit confirmation is required before enabling automatic publishing monitoring.',
        code: 'EXPLICIT_AUTOPILOT_CONFIRMATION_REQUIRED',
        creditsUsed: 0,
      }, { status: 409 })
    }

    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
      select: { id: true },
    })
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, workspaceId: workspace.id },
      select: { id: true, name: true, status: true, aiOutput: true, goal: true, platforms: true },
    })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    const approval = await getStrategyApprovalContract(campaignId, user.id)
    if (approval.state !== 'approved') {
      return NextResponse.json({
        error: 'Strategy approval is required before enabling Autopilot.',
        code: 'STRATEGY_APPROVAL_REQUIRED',
        approval,
        creditsUsed: 0,
      }, { status: 409 })
    }

    const brandProfile = await prisma.brandProfile.findUnique({ where: { workspaceId: workspace.id } })
    const aiOutput = campaign.aiOutput && typeof campaign.aiOutput === 'object' && !Array.isArray(campaign.aiOutput)
      ? campaign.aiOutput as Record<string, unknown>
      : {}
    const qualityGate = reviewStrategyGrounding({
      strategy: aiOutput.strategy ?? aiOutput,
      brand: brandProfile,
      allowedPlatforms: Array.isArray(campaign.platforms) ? campaign.platforms.map(String) : [],
      goal: String(campaign.goal),
    })
    if (qualityGate.status !== 'passed') {
      return NextResponse.json({
        error: 'Autopilot is blocked because the strategy no longer matches Brand Brain or the reviewed channel scope.',
        code: 'MARKETING_QUALITY_GATE_FAILED',
        qualityGate,
        creditsUsed: 0,
      }, { status: 409 })
    }

    const autoQueue = await (prisma.socialPost as any).findMany({
      where: {
        campaignId,
        workspaceId: workspace.id,
        status: 'SCHEDULED',
        approvedAt: { not: null },
        publishMode: 'AUTO',
        autoPublishConsentAt: { not: null },
      },
      include: { integration: { select: { status: true } } },
      orderBy: { scheduledAt: 'asc' },
    })
    if (autoQueue.length === 0) {
      return NextResponse.json({
        error: 'Approve the drafts, complete media review, then schedule at least one post as AUTO before enabling Autopilot.',
        code: 'AUTO_SCHEDULE_REQUIRED',
        creditsUsed: 0,
      }, { status: 409 })
    }

    const queueBlockers = autoQueue.flatMap((post: any, index: number) => {
      const blockers: Array<{ postId: string; reason: string }> = []
      if (!post.integrationId || post.integration?.status !== 'CONNECTED') {
        blockers.push({ postId: post.id, reason: 'connected_publish_destination_required' })
      }
      if (!post.scheduledAt || !post.autoPublishConsentAt) {
        blockers.push({ postId: post.id, reason: 'explicit_auto_schedule_consent_required' })
      }
      if (!post.approvedAt) {
        blockers.push({ postId: post.id, reason: 'saved_approval_evidence_required' })
      }
      if (!isContentPostMediaReadyForScheduling(post)) {
        blockers.push({ postId: post.id, reason: 'media_review_required' })
      }
      reviewContentPostForPublishing(post, index + 1).forEach(issue => {
        blockers.push({ postId: post.id, reason: issue.reason })
      })
      return blockers
    })
    if (queueBlockers.length > 0) {
      return NextResponse.json({
        error: 'The AUTO queue needs review before Autopilot can be enabled.',
        code: 'AUTOPILOT_QUEUE_REVIEW_REQUIRED',
        blockers: queueBlockers,
        creditsUsed: 0,
      }, { status: 409 })
    }

    const activatedAt = new Date()
    await prisma.$transaction(async (tx) => {
      const updated = await tx.campaign.updateMany({
        where: { id: campaignId, workspaceId: workspace.id, status: 'ACTIVE' },
        data: { autopilotEnabled: true, autopilotActivatedAt: activatedAt },
      })
      if (updated.count !== 1) throw new Error('CAMPAIGN_EXECUTION_STATE_CHANGED')
      await tx.campaignActivity.create({
        data: {
          campaignId,
          type: 'autopilot_enabled',
          description: `Autopilot monitoring enabled for ${autoQueue.length} explicitly approved AUTO post${autoQueue.length === 1 ? '' : 's'}`,
          metadata: {
            monitoredPosts: autoQueue.length,
            contentGenerated: false,
            creditsUsed: 0,
            requiresExplicitAutoScheduleConsent: true,
          },
        },
      })
    })

    return NextResponse.json({
      ok: true,
      autopilotEnabled: true,
      monitoredPosts: autoQueue.length,
      posts: autoQueue,
      creditsUsed: 0,
      providerCalls: 0,
      message: 'Autopilot monitoring is enabled for the reviewed AUTO queue. Publishing remains subject to each post schedule and provider safety checks.',
    })
  } catch (error) {
    if (error instanceof StrategyApprovalError) {
      return NextResponse.json({ error: error.code, blockers: error.blockers, creditsUsed: 0 }, { status: error.status })
    }
    if (error instanceof Error && error.message === 'CAMPAIGN_EXECUTION_STATE_CHANGED') {
      return NextResponse.json({
        error: 'Campaign state changed before Autopilot could be enabled. Refresh and review it again.',
        code: 'CAMPAIGN_EXECUTION_STATE_CHANGED',
        creditsUsed: 0,
      }, { status: 409 })
    }
    console.error('[Autopilot Activate] Error:', error)
    return NextResponse.json({ error: 'Internal server error', creditsUsed: 0 }, { status: 500 })
  }
}
