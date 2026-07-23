import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { decisionEvent } from '@/lib/paidStrategySourceServer'
import { inspectPaidStrategySource } from '@/lib/paidStrategySource'

type Params = { params: Promise<{ id: string }> }
type JsonRecord = Record<string, unknown>

function record(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

function statusCounts(items: Array<{ status: string }>) {
  return items.reduce<Record<string, number>>((counts, item) => {
    counts[item.status] = (counts[item.status] ?? 0) + 1
    return counts
  }, {})
}

export async function GET(req: NextRequest, props: Params) {
  const { id } = await props.params
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Every read is independently workspace-scoped so the remote database can
  // resolve the entire command center in one parallel round trip. This avoids
  // rendering false empty truth while a second sequential query wave runs.
  const [campaign, latestDecision, posts, paidCampaigns, accounts, strategySnapshot] = await Promise.all([
    prisma.campaign.findFirst({
      where: { id, workspace: { ownerId: userId } },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        description: true,
        goal: true,
        audience: true,
        platforms: true,
        status: true,
        aiOutput: true,
        updatedAt: true,
      },
    }),
    prisma.marketingLearningEvent.findFirst({
      where: {
        campaignId: id,
        eventType: { in: ['STRATEGY_APPROVED', 'STRATEGY_APPROVAL_REVOKED'] },
      },
      orderBy: { createdAt: 'desc' },
      select: { eventType: true, createdAt: true, source: true },
    }),
    prisma.socialPost.findMany({
      where: { campaignId: id, workspace: { ownerId: userId } },
      orderBy: { contentPlanIndex: 'asc' },
      select: {
        id: true,
        status: true,
        generationStatus: true,
        imageUrl: true,
        uploadedMediaId: true,
        isVideoPost: true,
        approvedSnapshotId: true,
        mediaApprovalSnapshotId: true,
        scheduledSnapshotId: true,
        platformPostId: true,
      },
    }),
    prisma.adCampaign.findMany({
      where: { organicCampaignId: id, workspace: { ownerId: userId } },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        platform: true,
        objective: true,
        status: true,
        adAccountId: true,
        strategySnapshotId: true,
        budgetApprovalSnapshotId: true,
        launchApprovalSnapshotId: true,
        platformCampaignId: true,
        platformStatus: true,
        trackingUrls: true,
        aiStrategy: true,
        updatedAt: true,
        adSets: {
          select: {
            id: true,
            ads: {
              select: {
                id: true,
                status: true,
                imageUrl: true,
                videoUrl: true,
                specsValidated: true,
                reviewStatus: true,
              },
            },
          },
        },
      },
    }),
    prisma.adAccount.findMany({
      where: {
        workspace: {
          ownerId: userId,
          campaigns: { some: { id } },
        },
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        platform: true,
        status: true,
        platformAccountName: true,
        currency: true,
        hasApiAccess: true,
        isVerified: true,
        pixelId: true,
        pageId: true,
        lastError: true,
      },
    }),
    prisma.campaignSnapshot.findFirst({
      where: {
        campaignId: id,
        workspace: { ownerId: userId },
        scope: 'STRATEGY_APPROVAL',
      },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, scope: true, createdAt: true },
    }),
  ])
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sourceTruth = inspectPaidStrategySource(
    campaign,
    decisionEvent(latestDecision),
  )
  const output = record(campaign.aiOutput) ?? {}
  const strategy = record(output.strategy) ?? output
  const missingData = stringArray(strategy.missingData)
  const paidPlanning = record(strategy.paidPlanning)
  const launchBlockers = stringArray(paidPlanning?.launchBlockers)
  const readyForPaidAds = strategy.readyForPaidAds === true
  const readyForPaidAdsReason = typeof strategy.readyForPaidAdsReason === 'string'
    ? strategy.readyForPaidAdsReason
    : null

  const organicCounts = statusCounts(posts)
  const organicCopyApproved = posts.filter(post => Boolean(post.approvedSnapshotId)).length
  const organicMediaApproved = posts.filter(post => Boolean(post.mediaApprovalSnapshotId)).length
  const organicScheduledDecisions = posts.filter(post => Boolean(post.scheduledSnapshotId)).length
  const organicMediaReady = posts.filter(post => (
    Boolean(post.imageUrl || post.uploadedMediaId)
    && post.generationStatus !== 'FAILED'
  )).length
  const organicNextAction = posts.length === 0
    ? {
        code: 'BUILD_CONTENT',
        labelAr: 'إنشاء مسودات المحتوى العضوي',
        labelEn: 'Build organic content drafts',
        href: `/campaigns/${campaign.id}/content-hub?buildPlan=1`,
      }
    : (organicCounts.DRAFT ?? 0) > 0
      ? {
          code: 'REVIEW_CONTENT',
          labelAr: 'مراجعة واعتماد المنشورات',
          labelEn: 'Review and approve posts',
          href: `/campaigns/${campaign.id}/content-hub`,
        }
      : (organicCounts.APPROVED ?? 0) > 0
        ? {
            code: 'SCHEDULE_CONTENT',
            labelAr: 'اعتماد الوسائط ثم الجدولة',
            labelEn: 'Approve media and schedule',
            href: `/campaigns/${campaign.id}/content-hub`,
          }
        : {
            code: 'MONITOR_CONTENT',
            labelAr: 'مراجعة حالة النشر والنتائج',
            labelEn: 'Review publishing and results',
            href: `/campaigns/${campaign.id}/content-hub`,
          }

  const approvedPlatformSet = new Set(sourceTruth.approvedPlatforms)
  const matchingAccounts = accounts.filter(account => (
    account.status === 'ACTIVE' && approvedPlatformSet.has(account.platform)
  ))
  const latestPaidCampaign = paidCampaigns[0] ?? null
  const paidAds = paidCampaigns.flatMap(paidCampaign => (
    paidCampaign.adSets.flatMap(adSet => adSet.ads)
  ))
  const paidCreativesReady = paidAds.filter(ad => (
    Boolean(ad.imageUrl || ad.videoUrl)
    && ad.specsValidated
    && ad.reviewStatus !== 'DISAPPROVED'
  )).length
  const paidTrackingReady = sourceTruth.launchReadiness.ready
    && paidCampaigns.some(paidCampaign => Boolean(paidCampaign.trackingUrls))

  const paidNextAction = !sourceTruth.eligible
    ? {
        code: 'APPROVE_STRATEGY',
        labelAr: 'إكمال مراجعة واعتماد الاستراتيجية',
        labelEn: 'Complete strategy review and approval',
        href: `/campaigns/${campaign.id}?tab=strategy`,
      }
    : !sourceTruth.paidPackage.complete
      ? {
          code: 'REPAIR_PAID_PACKAGE',
          labelAr: 'إصلاح حزمة التخطيط المدفوع',
          labelEn: 'Repair the paid planning package',
          href: `/campaigns/${campaign.id}?tab=strategy`,
        }
      : sourceTruth.approvedPlatforms.length === 0
        ? {
            code: 'APPROVE_PAID_PLATFORM',
            labelAr: 'تحديد منصة مدفوعة داخل الاستراتيجية',
            labelEn: 'Approve a paid platform in strategy',
            href: `/campaigns/${campaign.id}?tab=strategy`,
          }
        : matchingAccounts.length === 0
          ? {
              code: 'CONNECT_STRATEGY_ACCOUNT',
              labelAr: 'ربط حساب إعلاني يطابق الاستراتيجية',
              labelEn: 'Connect a strategy-matched ad account',
              href: '/connections',
            }
          : latestPaidCampaign
            ? {
                code: 'CONTINUE_PAID_DRAFT',
                labelAr: 'متابعة إعداد الحملة المدفوعة',
                labelEn: 'Continue paid campaign setup',
                href: `/paid-campaigns/${latestPaidCampaign.id}`,
              }
            : {
                code: 'CREATE_PAID_DRAFT',
                labelAr: 'إنشاء مسودة التنفيذ المدفوع',
                labelEn: 'Create the paid execution draft',
                href: `/paid-campaigns/new?sourceCampaignId=${campaign.id}`,
              }

  return NextResponse.json({
    campaign: {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      goal: campaign.goal,
      status: campaign.status,
      platforms: campaign.platforms,
      scope: sourceTruth.scope,
      approvalState: sourceTruth.approvalState,
      strategySnapshot,
    },
    organic: {
      inScope: sourceTruth.scope !== 'paid',
      total: posts.length,
      counts: organicCounts,
      copyApproved: organicCopyApproved,
      mediaApproved: organicMediaApproved,
      scheduledDecisions: organicScheduledDecisions,
      mediaReady: organicMediaReady,
      mediaPending: Math.max(0, posts.length - organicMediaReady),
      nextAction: organicNextAction,
    },
    paid: {
      inScope: sourceTruth.scope === 'paid' || sourceTruth.scope === 'full',
      eligible: sourceTruth.eligible,
      objective: sourceTruth.executionObjective,
      package: sourceTruth.paidPackage,
      approvedPlatforms: sourceTruth.approvedPlatforms,
      planningOnlyPlatforms: sourceTruth.planningOnlyPlatforms,
      platformDecisionSource: sourceTruth.platformDecisionSource,
      matchingAccounts,
      allAccounts: accounts,
      readyForPaidAds,
      readyForPaidAdsReason,
      missingData,
      launchBlockers,
      trackingReady: paidTrackingReady,
      campaignCount: paidCampaigns.length,
      adCount: paidAds.length,
      creativesReady: paidCreativesReady,
      campaigns: paidCampaigns.map(paidCampaign => ({
        id: paidCampaign.id,
        name: paidCampaign.name,
        platform: paidCampaign.platform,
        objective: paidCampaign.objective,
        status: paidCampaign.status,
        strategyPinned: Boolean(paidCampaign.strategySnapshotId),
        executionPlanReady: Boolean(paidCampaign.aiStrategy),
        budgetApproved: Boolean(paidCampaign.budgetApprovalSnapshotId),
        launchApproved: Boolean(paidCampaign.launchApprovalSnapshotId),
        platformCampaignId: paidCampaign.platformCampaignId,
        platformStatus: paidCampaign.platformStatus,
        adCount: paidCampaign.adSets.reduce((sum, adSet) => sum + adSet.ads.length, 0),
        updatedAt: paidCampaign.updatedAt,
      })),
      nextAction: paidNextAction,
    },
  })
}
