import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { getWorkspaceExecutionTruthByWorkspaceId } from '@/lib/executionTruthService'
import { buildOperationsOverview } from '@/lib/operationsOverview'
import { getCanonicalApprovalInbox } from '@/lib/approvalInboxService'

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
    const [
      truth,
      latestMonitor,
      integrations,
      adAccounts,
      approvalInbox,
      creditTransactions,
      paidCampaigns,
      latestAnalytics,
      retriesLast24h,
      latestRetry,
    ] = await Promise.all([
      getWorkspaceExecutionTruthByWorkspaceId(workspace.id),
      prisma.agentRun.findFirst({
        where: { workspaceId: workspace.id, triggeredBy: 'execution-monitor' },
        orderBy: { createdAt: 'desc' },
        select: { status: true, createdAt: true, completedAt: true, outputData: true, error: true },
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
        select: { amount: true, pricingVersion: true, entityId: true, entityType: true },
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
    })

    return NextResponse.json({ overview })
  } catch (error) {
    console.error('[operations/overview]', error)
    return NextResponse.json({ error: 'Failed to load operations overview' }, { status: 500 })
  }
}
