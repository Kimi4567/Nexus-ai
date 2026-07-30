import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureDbUser } from '@/lib/apiAuth'
import { getBrandBrainReadiness } from '@/lib/brandReadiness'
import { reviewBrandTruthConsistency } from '@/lib/ai/marketingQualityGate'
import {
  getAiProviderUnavailablePayload,
  isAiProviderConfigured,
} from '@/lib/ai/provider'
import { readLockedCampaignAllowance } from '@/lib/campaignCommercial'
import { getOrCreateProjectInWorkspace } from '@/lib/campaignCreation.server'
import {
  inferCampaignTone,
  normalizeCampaignPlatformsForPersistence,
} from '@/lib/campaignInputNormalization'
import {
  isOwnerCampaignOutcome,
  ownerCampaignName,
  type OwnerCampaignOutcome,
} from '@/lib/ownerCampaignCommand'
import {
  ownerCampaignId,
  parseOwnerCampaignOperationKey,
} from '@/lib/ownerCampaignCommand.server'

export const dynamic = 'force-dynamic'

function languageFrom(value: unknown): 'ar' | 'en' {
  return typeof value === 'string' && value.toLowerCase().startsWith('en') ? 'en' : 'ar'
}

export async function POST(req: NextRequest) {
  const authUser = await ensureDbUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
  const operationKey = parseOwnerCampaignOperationKey(req)
  if (!operationKey) {
    return NextResponse.json({
      error: 'A valid Idempotency-Key is required for replay-safe campaign preparation.',
      code: 'IDEMPOTENCY_KEY_REQUIRED',
    }, { status: 400 })
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const rawOutcome = typeof body.outcome === 'string' ? body.outcome.toUpperCase() : ''
  if (!isOwnerCampaignOutcome(rawOutcome)) {
    return NextResponse.json({
      error: 'Choose one supported business outcome.',
      code: 'INVALID_CAMPAIGN_OUTCOME',
    }, { status: 400 })
  }
  const outcome = rawOutcome as OwnerCampaignOutcome
  const language = languageFrom(body.language)
  const campaignId = ownerCampaignId(authUser.id, operationKey)

  const replay = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      workspace: { ownerId: authUser.id },
    },
  })
  if (replay) {
    return NextResponse.json({
      campaign: replay,
      reused: true,
      publishAuthorized: false,
      spendAuthorized: false,
    }, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    })
  }

  if (!isAiProviderConfigured()) {
    return NextResponse.json(getAiProviderUnavailablePayload(language), { status: 503 })
  }

  const workspace = await prisma.workspace.findFirst({
    where: { ownerId: authUser.id },
    orderBy: { createdAt: 'asc' },
    include: { brandProfile: true },
  })
  if (!workspace) {
    return NextResponse.json({
      error: language === 'ar'
        ? 'أكمل إعداد مساحة العمل أولاً.'
        : 'Complete workspace setup first.',
      code: 'WORKSPACE_REQUIRED',
      redirectUrl: '/onboarding',
    }, { status: 409 })
  }

  const brandProfile = workspace.brandProfile
  const readiness = getBrandBrainReadiness(brandProfile)
  if (!readiness.ready) {
    return NextResponse.json({
      error: language === 'ar'
        ? 'أكمل البيانات الأساسية في Brand Brain قبل تجهيز الحملة.'
        : 'Complete the required Brand Brain fields before preparing a campaign.',
      code: 'BRAND_BRAIN_INCOMPLETE',
      missingRequired: readiness.missingRequired,
      score: readiness.score,
      redirectUrl: '/brand',
    }, { status: 422 })
  }

  const truthReview = reviewBrandTruthConsistency(brandProfile)
  if (truthReview.status === 'blocked') {
    return NextResponse.json({
      error: language === 'ar'
        ? 'يوجد تعارض في حقائق Brand Brain ويجب حسمه قبل تجهيز الحملة.'
        : 'Brand Brain contains conflicting facts that must be resolved first.',
      code: 'BRAND_TRUTH_CONFLICT',
      blockers: truthReview.blockers,
      warnings: truthReview.warnings,
      redirectUrl: '/brand',
    }, { status: 422 })
  }

  const platforms = normalizeCampaignPlatformsForPersistence(brandProfile?.topPlatforms)
  if (platforms.length === 0) {
    return NextResponse.json({
      error: language === 'ar'
        ? 'حدّد منصة مدعومة واحدة على الأقل في Brand Brain.'
        : 'Choose at least one supported platform in Brand Brain.',
      code: 'SUPPORTED_PLATFORM_REQUIRED',
      redirectUrl: '/brand',
    }, { status: 422 })
  }

  const result = await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      `owner-campaign-command:${campaignId}`,
    )
    const existing = await tx.campaign.findUnique({ where: { id: campaignId } })
    if (existing) {
      const belongsToOwner = await tx.workspace.count({
        where: { id: existing.workspaceId, ownerId: authUser.id },
      })
      return belongsToOwner === 1
        ? { campaign: existing, reused: true as const }
        : { conflict: true as const }
    }

    // Keep the shared lock order aligned with general campaign creation:
    // default project first, then the account-wide monthly campaign allowance.
    // This avoids a project-lock/campaign-lock inversion under concurrency.
    const projectId = await getOrCreateProjectInWorkspace(
      tx,
      workspace.id,
      brandProfile?.brandName || workspace.name,
    )
    const allowance = await readLockedCampaignAllowance(tx, authUser.id)
    if (allowance.limit !== 999 && allowance.current >= allowance.limit) {
      return { limitReached: true as const, allowance }
    }

    const campaign = await tx.campaign.create({
      data: {
        id: campaignId,
        name: ownerCampaignName({
          outcome,
          brandName: brandProfile?.brandName || workspace.name,
          language,
        }),
        description: brandProfile?.businessGoal || '',
        workspaceId: workspace.id,
        projectId,
        goal: outcome,
        audience: brandProfile?.targetAudience || '',
        tone: inferCampaignTone(brandProfile?.toneKeywords),
        platforms,
        status: 'DRAFT',
        thumbnail: '✦',
        aiOutput: {
          language,
          ownerCommand: {
            schemaVersion: 1,
            outcome,
            publishAuthorized: false,
            spendAuthorized: false,
            requestedAt: new Date().toISOString(),
          },
        },
        activities: {
          create: {
            type: 'owner_command',
            description: 'Owner asked NEXUS to prepare a campaign for review',
            metadata: {
              outcome,
              publishAuthorized: false,
              spendAuthorized: false,
            },
          },
        },
      },
    })
    return { campaign, reused: false as const }
  })

  if ('conflict' in result) {
    return NextResponse.json({
      error: 'The idempotency key conflicts with another campaign.',
      code: 'IDEMPOTENCY_CONFLICT',
    }, { status: 409 })
  }
  if ('limitReached' in result && result.limitReached) {
    const allowance = result.allowance!
    return NextResponse.json({
      error: 'CAMPAIGN_LIMIT_REACHED',
      message: `This plan allows ${allowance.limit} campaign creation${allowance.limit === 1 ? '' : 's'} per billing month.`,
      limit: allowance.limit,
      current: allowance.current,
      resetsAt: allowance.periodEnd.toISOString(),
      upgradeUrl: '/billing',
    }, { status: 403 })
  }

  return NextResponse.json({
    campaign: result.campaign,
    reused: result.reused,
    publishAuthorized: false,
    spendAuthorized: false,
  }, {
    status: result.reused ? 200 : 201,
    headers: { 'Cache-Control': 'private, no-store' },
  })
  } catch (error) {
    console.error('[campaigns/prepare POST]', error)
    return NextResponse.json({
      error: 'NEXUS could not safely prepare the campaign draft.',
      code: 'CAMPAIGN_PREPARATION_FAILED',
    }, { status: 500 })
  }
}
