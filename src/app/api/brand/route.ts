import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/apiAuth'
import { calculateBrandMaturity, snapshotBrandMaturity } from '@/lib/brandMaturity'

// Use 'any' cast until prisma generate runs with the new BrandProfile model
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  }
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map(item => item.trim()).filter(Boolean)
  }
  return []
}

async function getAcceptedLearningCount(workspaceId: string): Promise<number> {
  try {
    return await db.brainLearning.count({
      where: { workspaceId, status: 'accepted' },
    })
  } catch {
    return 0
  }
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

    let brandProfile = null
    try {
      brandProfile = await db.brandProfile.findUnique({
        where: { workspaceId: workspace.id },
      })
    } catch {
      // Model may not exist in DB yet — return null gracefully
    }

    const acceptedLearningCount = await getAcceptedLearningCount(workspace.id)
    const maturity = calculateBrandMaturity(brandProfile, { acceptedLearningCount })
    const profileWithMaturity = brandProfile
      ? { ...brandProfile, acceptedLearningCount }
      : null

    return NextResponse.json({ brandProfile: profileWithMaturity, workspaceId: workspace.id, maturity })
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
      businessGoal: businessGoal || null,
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
    }

    let brandProfile = null
    try {
      brandProfile = await db.brandProfile.upsert({
        where: { workspaceId: workspace.id },
        update: profileData,
        create: { workspaceId: workspace.id, ...profileData },
      })
    } catch (upsertError) {
      console.error('BrandProfile upsert error (table may not exist yet):', upsertError)
      // Return success with the data we have — table will be created on next prisma push
      const maturity = calculateBrandMaturity(profileData)
      return NextResponse.json({ brandProfile: profileData, maturity, success: true, pending: true })
    }

    const maturity = await snapshotBrandMaturity(db, workspace.id)
      ?? calculateBrandMaturity(brandProfile as Record<string, unknown>)
    const profileWithMaturity = {
      ...(brandProfile as Record<string, unknown>),
      acceptedLearningCount: maturity.acceptedLearningCount,
    }

    return NextResponse.json({ brandProfile: profileWithMaturity, maturity, success: true })
  } catch (error) {
    console.error('POST /api/brand error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
