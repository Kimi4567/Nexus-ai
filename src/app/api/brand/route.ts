import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/apiAuth'
import { calculateBrandMaturity, snapshotBrandMaturity } from '@/lib/brandMaturity'
import { buildBrandBrainContract, getChangedBrandFields } from '@/lib/brandBrainContract'
import { normalizeBusinessGoal } from '@/lib/businessGoals'
import { mergeApprovedEvidenceProofs } from '@/lib/brandEvidence'

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  }
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map(item => item.trim()).filter(Boolean)
  }
  return []
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : null
}

function customStrategyDays(value: unknown): number | null {
  const days = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(days) && days >= 1 && days <= 180 ? days : null
}

async function getAcceptedLearningCount(workspaceId: string): Promise<number> {
  return prisma.brainLearning.count({
    where: { workspaceId, status: 'accepted' },
  })
}

function metadataChangedFields(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return []
  const value = (metadata as Record<string, unknown>).changedFields
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

async function buildContract(workspaceId: string, brandProfile: Record<string, unknown> | null) {
  const revisionEvents = ['BRAND_PROFILE_UPDATED', 'BRAND_LEARNING_ACCEPTED']
  const [acceptedLearningCount, learnedFields, acceptedLearningEvents, pendingFields, revisionNumber, latestRevision] = await Promise.all([
    getAcceptedLearningCount(workspaceId),
    prisma.brainLearning.findMany({
      where: { workspaceId, status: 'accepted' },
      select: { field: true },
      distinct: ['field'],
    }),
    prisma.marketingLearningEvent.findMany({
      where: { workspaceId, eventType: 'BRAND_LEARNING_ACCEPTED' },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { metadata: true },
    }),
    prisma.brainLearning.findMany({
      where: { workspaceId, status: 'pending' },
      select: { field: true },
      distinct: ['field'],
    }),
    prisma.marketingLearningEvent.count({
      where: { workspaceId, eventType: { in: revisionEvents } },
    }),
    prisma.marketingLearningEvent.findFirst({
      where: { workspaceId, eventType: { in: revisionEvents } },
      orderBy: { createdAt: 'desc' },
      select: { metadata: true },
    }),
  ])

  return buildBrandBrainContract(brandProfile, {
    revisionNumber,
    learnedFields: Array.from(new Set([
      ...learnedFields.map((item) => item.field),
      ...acceptedLearningEvents.flatMap((event) => metadataChangedFields(event.metadata)),
    ])),
    pendingLearningFields: pendingFields.map((item) => item.field),
    acceptedLearningCount,
    lastChangedFields: metadataChangedFields(latestRevision?.metadata),
  })
}

// GET /api/brand — fetch brand profile for user's primary workspace
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get user's first workspace
    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
    })

    if (!workspace) {
      return NextResponse.json({ brandProfile: null })
    }

    const brandProfile = await prisma.brandProfile.findUnique({
      where: { workspaceId: workspace.id },
    })

    const acceptedLearningCount = await getAcceptedLearningCount(workspace.id)
    const maturity = calculateBrandMaturity(brandProfile, { acceptedLearningCount })
    const profileWithMaturity = brandProfile
      ? { ...brandProfile, acceptedLearningCount }
      : null

    const contract = await buildContract(
      workspace.id,
      profileWithMaturity as Record<string, unknown> | null,
    )

    return NextResponse.json({ brandProfile: profileWithMaturity, workspaceId: workspace.id, maturity, contract })
  } catch (error) {
    console.error('GET /api/brand error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/brand — create or update brand profile (upsert)
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()

    // Get user's first workspace
    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
    })

    if (!workspace) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Evidence-backed proof is governed by the claim review ledger. A stale
    // Brand Brain form must never erase an approved source citation.
    const approvedEvidence = await prisma.brandEvidenceClaim.findMany({
      where: {
        workspaceId: workspace.id,
        status: 'APPROVED',
        promotedProof: { not: null },
      },
      select: { promotedProof: true },
    })
    const approvedEvidenceProofs = approvedEvidence
      .map(item => item.promotedProof)
      .filter((item): item is string => Boolean(item))

    const {
      brandName, industry, description,
      toneKeywords, avoidKeywords, writingStyle,
      targetAudience, audienceAge, audienceLocation,
      audiencePainPoints, audienceDesires,
      primaryOffer, secondaryOffers, pricePoint, uniqueAdvantages,
      visualStyle, colorPalette, logoUrl,
      winningHooks, winningAngles, failedAngles, topPlatforms,
      strategicNotes, competitorNotes, competitors,
      websiteUrl, contentSamples,
      // PR-2A — strategy data requirements (additive, nullable; capture only)
      businessGoal, marketingBudget, conversionDestination, leadHandling,
      customerObjections, complianceNotes, averageOrderValue, grossMargin,
      customerLifetimeValue, salesCycleLength, seasonality, pastAdResults,
      // PR-H2 — Brand Brain v2 (additive, nullable/default-safe)
      languagePreference, verifiedProof,
      strategyType, strategyDuration, strategyCustomDays, campaignObjective,
    } = body

    const profileData = {
      brandName: brandName || null,
      industry: industry || null,
      description: description || null,
      toneKeywords: toStringArray(toneKeywords),
      avoidKeywords: toStringArray(avoidKeywords),
      writingStyle: writingStyle || null,
      targetAudience: targetAudience || null,
      audienceAge: audienceAge || null,
      audienceLocation: audienceLocation || null,
      audiencePainPoints: toStringArray(audiencePainPoints),
      audienceDesires: toStringArray(audienceDesires),
      primaryOffer: primaryOffer || null,
      secondaryOffers: toStringArray(secondaryOffers),
      pricePoint: pricePoint || null,
      uniqueAdvantages: toStringArray(uniqueAdvantages),
      visualStyle: visualStyle || null,
      colorPalette: toStringArray(colorPalette),
      logoUrl: logoUrl || null,
      winningHooks: toStringArray(winningHooks),
      winningAngles: toStringArray(winningAngles),
      failedAngles: toStringArray(failedAngles),
      topPlatforms: toStringArray(topPlatforms),
      strategicNotes: strategicNotes || null,
      competitorNotes: competitorNotes || null,
      competitors: toStringArray(competitors),
      websiteUrl: websiteUrl || null,
      contentSamples: toStringArray(contentSamples),
      // PR-2A — strategy data requirements (free-text bands; arrays via toStringArray)
      businessGoal: normalizeBusinessGoal(businessGoal),
      marketingBudget: marketingBudget || null,
      conversionDestination: conversionDestination || null,
      leadHandling: leadHandling || null,
      customerObjections: toStringArray(customerObjections),
      complianceNotes: complianceNotes || null,
      averageOrderValue: averageOrderValue || null,
      grossMargin: grossMargin || null,
      customerLifetimeValue: customerLifetimeValue || null,
      salesCycleLength: salesCycleLength || null,
      seasonality: seasonality || null,
      pastAdResults: pastAdResults || null,
      // PR-H2 — language preference (user-chosen) + verified proof (user-confirmed only)
      languagePreference: languagePreference || null,
      verifiedProof: mergeApprovedEvidenceProofs(toStringArray(verifiedProof), approvedEvidenceProofs),
      strategyType: enumValue(strategyType, ['organic', 'paid', 'full'] as const),
      strategyDuration: enumValue(strategyDuration, ['30', '90', '180', 'custom'] as const),
      strategyCustomDays: customStrategyDays(strategyCustomDays),
      campaignObjective: enumValue(campaignObjective, ['leads', 'sales', 'awareness', 'traffic'] as const),
    }

    const previous = await prisma.brandProfile.findUnique({
      where: { workspaceId: workspace.id },
    })
    const changedFields = getChangedBrandFields(
      previous as unknown as Record<string, unknown> | null,
      profileData,
    )

    const brandProfile = changedFields.length === 0 && previous
      ? previous
      : await prisma.$transaction(async (tx) => {
          const saved = await tx.brandProfile.upsert({
            where: { workspaceId: workspace.id },
            update: profileData,
            create: { workspaceId: workspace.id, ...profileData },
          })

          await tx.marketingLearningEvent.create({
            data: {
              workspaceId: workspace.id,
              eventType: 'BRAND_PROFILE_UPDATED',
              source: 'BRAND_BRAIN',
              actor: 'USER',
              metadata: {
                changedFields,
                profileUpdatedAt: saved.updatedAt.toISOString(),
              },
            },
          })
          return saved
        })

    const maturity = await snapshotBrandMaturity(prisma, workspace.id)
      ?? calculateBrandMaturity(brandProfile as Record<string, unknown>)
    const profileWithMaturity = {
      ...(brandProfile as Record<string, unknown>),
      acceptedLearningCount: maturity.acceptedLearningCount,
    }

    const contract = await buildContract(workspace.id, profileWithMaturity)

    return NextResponse.json({ brandProfile: profileWithMaturity, maturity, contract, success: true })
  } catch (error) {
    console.error('POST /api/brand error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
