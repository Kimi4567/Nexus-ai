import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { getWorkspaceExecutionTruthByWorkspaceId } from '@/lib/executionTruthService'
import { buildOperationsOverview } from '@/lib/operationsOverview'
import { getCanonicalApprovalInbox } from '@/lib/approvalInboxService'
import { buildPilotProofOverview } from '@/lib/pilotProof'
import { STALE_AGENT_RUN_TIMEOUT_MINUTES } from '@/lib/agents/staleAgentRuns'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000)
    const oneDayAgo = new Date(now.getTime() - 86_400_000)
    const staleAgentRunCutoff = new Date(now.getTime() - STALE_AGENT_RUN_TIMEOUT_MINUTES * 60_000)
    const [
      truth,
      latestMonitor,
      staleAgentRuns,
      integrations,
      adAccounts,
      approvalInbox,
      creditTransactions,
      paidCampaigns,
      latestAnalytics,
      retriesLast24h,
      latestRetry,
      strategyRuns,
      pilotPosts,
      pilotLearnings,
    ] = await Promise.all([
      getWorkspaceExecutionTruthByWorkspaceId(workspace.id),
      prisma.agentRun.findFirst({
        where: { workspaceId: workspace.id, triggeredBy: 'execution-monitor' },
        orderBy: { createdAt: 'desc' },
        select: { status: true, createdAt: true, completedAt: true, outputData: true, error: true },
      }),
      prisma.agentRun.count({
        where: {
          workspaceId: workspace.id,
          status: 'RUNNING',
          createdAt: { lte: staleAgentRunCutoff },
        },
      }),
      prisma.integration.findMany({
        where: { workspaceId: workspace.id, status: { not: 'DISCONNECTED' } },
        select: { id: true, type: true, status: true, updatedAt: true, config: true },
      }),
      prisma.adAccount.findMany({
        where: { workspaceId: workspace.id, status: { not: 'DISCONNECTED' } },
        select: { id: true, platform: true, status: true, tokenExpiresAt: true, lastError: true },
      }),
      // Approvals, Operations, and the sidebar all read the same canonical
      // inbox. No surface is allowed to recalculate or double-count decisions.
      getCanonicalApprovalInbox(userId),
      prisma.creditTransaction.findMany({
        where: { userId, createdAt: { gte: thirtyDaysAgo } },
        select: { action: true, amount: true, status: true, createdAt: true, pricingVersion: true, entityId: true, entityType: true },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      }),
      prisma.adCampaign.findMany({
        where: { workspaceId: workspace.id, status: 'ACTIVE' },
        select: {
          id: true,
          name: true,
          currency: true,
          status: true,
          platformCampaignId: true,
          budgetType: true,
          dailyBudget: true,
          lifetimeBudget: true,
          totalSpend: true,
          startDate: true,
          endDate: true,
          lastSyncAt: true,
          lastSyncError: true,
        },
      }),
      prisma.socialPost.findFirst({
        where: {
          workspaceId: workspace.id,
          status: 'PUBLISHED',
          analyticsUpdatedAt: { not: null },
          analyticsData: { path: ['quality'], equals: 'eligible' },
        },
        orderBy: { analyticsUpdatedAt: 'desc' },
        select: { analyticsUpdatedAt: true },
      }),
      prisma.postStatusHistory.count({
        where: { workspaceId: workspace.id, createdAt: { gte: oneDayAgo }, note: { startsWith: '[PUBLISH_RETRY]' } },
      }),
      prisma.postStatusHistory.findFirst({
        where: { workspaceId: workspace.id, note: { startsWith: '[PUBLISH_RETRY]' } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      prisma.agentRun.findMany({
        where: { workspaceId: workspace.id, agent: 'STRATEGIST', triggeredBy: 'user' },
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: {
          id: true,
          status: true,
          inputData: true,
          outputData: true,
          error: true,
          durationMs: true,
          createdAt: true,
          completedAt: true,
        },
      }),
      prisma.socialPost.findMany({
        where: { workspaceId: workspace.id, status: 'PUBLISHED' },
        select: {
          id: true,
          campaignId: true,
          status: true,
          platformPostId: true,
          publishedAt: true,
          manuallyPublishedAt: true,
          analyticsData: true,
        },
        orderBy: { publishedAt: 'desc' },
        take: 1000,
      }),
      prisma.brainLearning.findMany({
        where: { workspaceId: workspace.id, trigger: 'post_performance', status: 'accepted' },
        select: { status: true, trigger: true, evidence: true },
        orderBy: { updatedAt: 'desc' },
        take: 1000,
      }),
    ])

    const pendingApprovals = approvalInbox.summary.total
    const approvalRows = [
      ...(approvalInbox.suggestions as unknown as Array<{ createdAt?: Date | string | null }>),
      ...(approvalInbox.proposals as unknown as Array<{ createdAt?: Date | string | null }>),
    ]
    const overdueApprovals = approvalRows.filter(row => (
      row.createdAt && new Date(row.createdAt).getTime() <= oneDayAgo.getTime()
    )).length
    const publishedAwaitingEvidence = truth.campaigns.reduce(
      (sum, campaign) => sum + campaign.posts.publishedWithoutAnalytics,
      0,
    )

    const overview = buildOperationsOverview({
      now,
      truth,
      latestMonitor,
      staleAgentRuns,
      integrations,
      adAccounts,
      pendingApprovals,
      overdueApprovals,
      creditTransactions,
      paidCampaigns,
      publishedAwaitingEvidence,
      latestAnalyticsAt: latestAnalytics?.analyticsUpdatedAt ?? null,
      retriesLast24h,
      latestRetryAt: latestRetry?.createdAt ?? null,
      strategyRuns,
      pilotProof: buildPilotProofOverview(pilotPosts, pilotLearnings),
    })

    return NextResponse.json({ overview })
  } catch (error) {
    console.error('[operations/overview]', error)
    return NextResponse.json({ error: 'Failed to load operations overview' }, { status: 500 })
  }
}
