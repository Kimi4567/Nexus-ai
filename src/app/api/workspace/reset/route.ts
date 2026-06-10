/**
 * POST /api/workspace/reset
 *
 * Deletes ALL content in the user's workspace (campaigns, content plans,
 * Brand Brain data, media, agent data, ad campaigns, etc.)
 * and resets BrandProfile fields to empty.
 *
 * The workspace record itself is preserved so the user can start fresh.
 * Credits and billing are NOT affected.
 *
 * Deletion order respects foreign-key constraints.
 */

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

const db = prisma as any

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify confirmation header to prevent accidental resets
    const body = await req.json().catch(() => ({}))
    if (body.confirm !== 'RESET') {
      return NextResponse.json(
        { error: 'Missing confirmation. Send { confirm: "RESET" }' },
        { status: 400 }
      )
    }

    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const wid = workspace.id

    // ── Deletion in FK-safe order ──────────────────────────────────────────────

    // 1. Brain / agent intelligence (no children)
    await db.brainLearning.deleteMany({ where: { workspaceId: wid } })
    await db.brainScoreSnapshot.deleteMany({ where: { workspaceId: wid } })
    await db.campaignMemory.deleteMany({ where: { workspaceId: wid } })
    await db.agentReport.deleteMany({ where: { workspaceId: wid } })
    await db.agentSuggestion.deleteMany({ where: { workspaceId: wid } })
    await db.agentRun.deleteMany({ where: { workspaceId: wid } })

    // 2. Generated content / visuals
    await db.generatedVisual.deleteMany({ where: { workspaceId: wid } })
    await db.socialPost.deleteMany({ where: { workspaceId: wid } })
    await db.export.deleteMany({ where: { workspaceId: wid } })

    // 3. Paid campaign pack (before Campaign cascade)
    await db.paidCampaignPack.deleteMany({ where: { workspaceId: wid } })

    // 4. Ad system (AdSet + Ad + AdPerformanceSnapshot cascade from AdCampaign)
    await db.adCampaign.deleteMany({ where: { workspaceId: wid } })
    await db.adAccount.deleteMany({ where: { workspaceId: wid } })

    // 5. Media & uploads
    await db.uploadSession.deleteMany({ where: { workspaceId: wid } })
    await db.media.deleteMany({ where: { workspaceId: wid } })

    // 6. Campaigns (cascades: AdConcept, Generation, CampaignActivity, Analytics)
    await db.campaign.deleteMany({ where: { workspaceId: wid } })

    // 7. Projects (cascades remaining campaigns)
    await db.project.deleteMany({ where: { workspaceId: wid } })

    // 8. Integrations & team members
    await db.workspaceMember.deleteMany({ where: { workspaceId: wid } })
    await db.integration.deleteMany({ where: { workspaceId: wid } })

    // 9. Reset Brand Brain fields — keep the record, wipe all learned data
    const existingBrand = await prisma.brandProfile.findUnique({
      where: { workspaceId: wid },
      select: { id: true },
    })
    if (existingBrand) {
      await prisma.brandProfile.update({
        where: { workspaceId: wid },
        data: {
          brandName:          null,
          industry:           null,
          description:        null,
          toneKeywords:       [],
          avoidKeywords:      [],
          writingStyle:       null,
          targetAudience:     null,
          audienceAge:        null,
          audienceLocation:   null,
          audiencePainPoints: [],
          audienceDesires:    [],
          primaryOffer:       null,
          secondaryOffers:    [],
          pricePoint:         null,
          uniqueAdvantages:   [],
          visualStyle:        null,
          colorPalette:       [],
          logoUrl:            null,
          winningHooks:       [],
          winningAngles:      [],
          failedAngles:       [],
          topPlatforms:       [],
          competitors:        [],
          competitorNotes:    null,
          strategicNotes:     null,
          websiteUrl:         null,
          contentSamples:     [],
          aiInsights:         Prisma.JsonNull,
        },
      })
    }

    return NextResponse.json({ ok: true, message: 'Workspace reset successfully' })
  } catch (err: any) {
    console.error('[POST /api/workspace/reset]', err)
    return NextResponse.json({ error: 'Reset failed', detail: err.message }, { status: 500 })
  }
}
