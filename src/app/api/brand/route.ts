import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/apiAuth'

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

    return NextResponse.json({ brandProfile, workspaceId: workspace.id })
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
      return NextResponse.json({ brandProfile: profileData, success: true, pending: true })
    }

    // ── Brain Score Snapshot (3-dimension intelligence formula) ─────────────────
    // Score grows as the brand brain gets RICHER, not just "filled".
    //   Completeness  (30 pts) — are the core fields set?
    //   Array Depth   (50 pts) — how many hooks / angles / pain-points are stored?
    //   Learning      (20 pts) — how many AI proposals has the user accepted?
    // Max 100. A perfectly filled new brain ≈ 30. 100 requires real training.
    try {
      const saved = brandProfile as Record<string, unknown>

      // 1. Completeness (max 30)
      const completenessMap: Record<string, number> = {
        brandName: 5, industry: 5, description: 5, primaryOffer: 5,
        targetAudience: 3, audienceAge: 2, audienceLocation: 2, topPlatforms: 3,
      }
      let completeness = 0
      for (const [key, pts] of Object.entries(completenessMap)) {
        const val = saved[key]
        if (Array.isArray(val) ? val.length > 0 : !!val) completeness += pts
      }

      // 2. Array Depth (max 50)
      function depth(arr: unknown[], brackets: [number, number][]): number {
        const len = Array.isArray(arr) ? arr.length : 0
        let pts = 0
        for (const [threshold, score] of brackets) {
          if (len >= threshold) pts = score; else break
        }
        return pts
      }
      const arrayDepth =
        depth(saved.winningHooks      as unknown[], [[1,4],[3,8],[6,12],[10,16],[15,20]]) + // max 20
        depth(saved.winningAngles     as unknown[], [[1,2],[3,5],[6,8],[10,10]])           + // max 10
        depth(saved.audiencePainPoints as unknown[], [[1,2],[3,5],[6,8],[10,10]])          + // max 10
        depth(saved.toneKeywords      as unknown[], [[1,2],[3,3],[5,5]])                  + // max 5
        depth(saved.uniqueAdvantages  as unknown[], [[1,2],[3,3],[5,5]])                    // max 5
      // Total max: 50

      // 3. Learning Activity (max 20)
      let acceptedCount = 0
      try {
        acceptedCount = await db.brainLearning.count({
          where: { workspaceId: workspace.id, status: 'accepted' },
        })
      } catch { /* table may not exist yet */ }
      const learning =
        acceptedCount >= 13 ? 20 :
        acceptedCount >= 8  ? 15 :
        acceptedCount >= 4  ? 10 :
        acceptedCount >= 1  ?  5 : 0

      const score = Math.min(100, completeness + arrayDepth + learning)

      await db.brainScoreSnapshot.create({
        data: { workspaceId: workspace.id, score },
      })
    } catch { /* snapshot failure is non-critical */ }

    return NextResponse.json({ brandProfile, success: true })
  } catch (error) {
    console.error('POST /api/brand error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
