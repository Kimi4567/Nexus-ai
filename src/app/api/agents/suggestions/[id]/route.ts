/**
 * POST /api/agents/suggestions/[id]
 * Body: { action: 'approve' | 'reject' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { approveCampaignStrategy, StrategyApprovalError } from '@/lib/strategyApprovalService'
import { reviewBrandTruthConsistency } from '@/lib/ai/marketingQualityGate'

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { action } = await req.json()
    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
    }

    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
    })
    if (!workspace) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

    const suggestion = await (prisma as any).agentSuggestion.findFirst({
      where: { id: params.id, workspaceId: workspace.id },
    })
    if (!suggestion) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (suggestion.status !== 'PENDING') {
      return NextResponse.json({ error: 'Already actioned' }, { status: 409 })
    }

    const now = new Date()

    if (action === 'reject') {
      await prisma.$transaction(async (tx) => {
        await (tx as any).agentSuggestion.update({
          where: { id: params.id },
          data: { status: 'REJECTED', rejectedAt: now },
        })
        await tx.marketingLearningEvent.create({
          data: {
            workspaceId: workspace.id,
            campaignId: suggestion.campaignId,
            eventType: 'AGENT_SUGGESTION_REJECTED',
            source: 'APPROVAL_CENTER',
            actor: 'USER',
            metadata: { suggestionId: suggestion.id, suggestionType: suggestion.type },
          },
        })
      })
      return NextResponse.json({ ok: true, status: 'REJECTED' })
    }

    const suggestionPayload = suggestion.payload && typeof suggestion.payload === 'object'
      ? suggestion.payload as Record<string, unknown>
      : {}

    // Execution Monitor suggestions authorize navigation to a guarded workflow,
    // never a background mutation. The target route performs the real approval.
    const suggestionSource = typeof suggestionPayload.source === 'string' ? suggestionPayload.source : ''
    const guidedResearchReview = suggestionSource.endsWith('research-monitor')
    if (suggestion.type !== 'CAMPAIGN_PAUSE') {
      const brandProfile = await prisma.brandProfile.findUnique({
        where: { workspaceId: workspace.id },
      })
      const brandTruthReport = reviewBrandTruthConsistency(brandProfile)
      if (!brandProfile || brandTruthReport.status === 'blocked') {
        return NextResponse.json({
          error: 'BRAND_TRUTH_CONFLICT',
          message: 'Resolve the current Brand Brain conflict before approving derived decisions.',
          blockers: brandTruthReport.blockers,
        }, { status: 409 })
      }
    }
    if (suggestionSource === 'execution-monitor' || guidedResearchReview) {
      const nextHref = typeof suggestionPayload.href === 'string'
        ? suggestionPayload.href
        : guidedResearchReview
          ? '/strategy'
          : undefined
      await prisma.$transaction(async (tx) => {
        await (tx as any).agentSuggestion.update({
          where: { id: params.id },
          data: {
            status: 'APPROVED',
            approvedAt: now,
            executionResult: {
              executed: false,
              autoExecution: false,
              nextHref,
              reason: guidedResearchReview ? 'RESEARCH_REVIEW_REQUIRED' : 'GUIDED_WORKFLOW_REQUIRED',
            },
          },
        })
        await tx.marketingLearningEvent.create({
          data: {
            workspaceId: workspace.id,
            campaignId: suggestion.campaignId,
            eventType: 'AGENT_SUGGESTION_APPROVED',
            source: 'APPROVAL_CENTER',
            actor: 'USER',
            metadata: {
              suggestionId: suggestion.id,
              suggestionType: suggestion.type,
              suggestionSource,
              executed: false,
              nextHref,
            },
          },
        })
      })
      return NextResponse.json({
        ok: true,
        status: 'APPROVED',
        executed: false,
        nextHref,
      })
    }

    // APPROVE — execute the action
    let executionResult: any = { executed: true }

    try {
      const payload = suggestion.payload as any
      const type = suggestion.type as string

      if (type === 'STRATEGY' && payload?.campaignId) {
        const result = await approveCampaignStrategy(
          String(payload.campaignId),
          user.id,
          'AGENT_SUGGESTION',
        )
        executionResult = {
          strategyApproved: payload.campaignId,
          unchanged: result.unchanged,
          approvalState: result.contract.state,
        }

      } else if (type === 'CAMPAIGN_PAUSE' && payload?.campaignId) {
        await (prisma.campaign as any).update({
          where: { id: payload.campaignId },
          data: { status: 'PAUSED' },
        })
        executionResult = { campaignPaused: payload.campaignId }

      } else if (type === 'CONTENT_SWAP' && payload?.campaignId) {
        // Log activity — actual content swap would require Content Director re-run
        await (prisma.campaignActivity as any).create({
          data: {
            campaignId: payload.campaignId,
            type: 'regenerated',
            description: `Content refreshed based on Campaign Manager suggestion: ${suggestion.title}`,
            metadata: payload,
          },
        })
        executionResult = { contentSwapLogged: true }

      } else if (type === 'BUDGET_CHANGE' && payload?.campaignId) {
        // Store budget change in campaign metadata
        const campaign = await (prisma.campaign as any).findUnique({
          where: { id: payload.campaignId },
          select: { performanceMetrics: true },
        })
        await (prisma.campaign as any).update({
          where: { id: payload.campaignId },
          data: {
            performanceMetrics: {
              ...(campaign?.performanceMetrics || {}),
              budgetChange: payload,
              budgetChangedAt: now.toISOString(),
            },
          },
        })
        executionResult = { budgetChangeRecorded: true }
      }

    } catch (execErr: any) {
      if (execErr instanceof StrategyApprovalError) {
        return NextResponse.json({
          error: execErr.code,
          blockers: execErr.blockers,
        }, { status: execErr.status })
      }
      console.error('[agent suggestion execution]', execErr)
      return NextResponse.json({ error: 'SUGGESTION_EXECUTION_FAILED' }, { status: 500 })
    }

    await prisma.$transaction(async (tx) => {
      await (tx as any).agentSuggestion.update({
        where: { id: params.id },
        data: {
          status: 'EXECUTED',
          approvedAt: now,
          executedAt: now,
          executionResult,
        },
      })
      await tx.marketingLearningEvent.create({
        data: {
          workspaceId: workspace.id,
          campaignId: suggestion.campaignId,
          eventType: 'AGENT_SUGGESTION_EXECUTED',
          source: 'APPROVAL_CENTER',
          actor: 'USER',
          metadata: {
            suggestionId: suggestion.id,
            suggestionType: suggestion.type,
            executionResult,
          },
        },
      })
    })

    return NextResponse.json({ ok: true, status: 'EXECUTED', result: executionResult })
  } catch (err: any) {
    console.error('[api/agents/suggestions/[id]]', err)
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
