/**
 * POST /api/strategy/run-full
 *
 * Re-triggers the full agency orchestration from the dashboard at any time.
 * Reads Brand Brain from the existing workspace -- no form required.
 * Reuses the exact same runFullAgency() orchestrator used during onboarding.
 *
 * Credit cost: RUN_FULL_STRATEGY (see lib/credits.ts)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { runFullAgency } from '@/lib/agents/orchestrator'
import { checkAndDeductCredits } from '@/lib/credits'
import { getBrandBrainReadiness } from '@/lib/brandReadiness'
import { getRelevantMemories, formatMemoriesForPrompt, saveCampaignMemory } from '@/lib/campaign-memory'

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const goalOverride = (body?.goal as string | undefined) || 'leads'
    const budgetOverride = Number(body?.budget) || 5000

    // -- Unified credit check + deduction ------------------------------------
    const credit = await checkAndDeductCredits(user.id, 'RUN_FULL_STRATEGY')
    if (!credit.ok) {
      return NextResponse.json(credit, { status: 402 })
    }
    // ------------------------------------------------------------------------

    // Get workspace
    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
    })
    if (!workspace) {
      return NextResponse.json(
        { error: 'NO_WORKSPACE', message: 'No workspace found. Please complete onboarding first.' },
        { status: 422 }
      )
    }

    // Get brand profile -- required to auto-populate the brief
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { workspaceId: workspace.id },
    })
    if (!brandProfile) {
      return NextResponse.json(
        {
          error: 'NO_BRAND_PROFILE',
          message: 'Brand Brain not set up. Please complete your brand profile first.',
          redirectUrl: '/brand',
        },
        { status: 422 }
      )
    }

    // Defense-in-depth: check Brand Brain readiness before spending credits
    const readiness = getBrandBrainReadiness(brandProfile as any)
    if (!readiness.ready) {
      return NextResponse.json(
        {
          error: 'BRAND_BRAIN_INCOMPLETE',
          message: `Brand Brain is missing required fields: ${readiness.missingRequired.join(', ')}.`,
          missingRequired: readiness.missingRequired,
          score: readiness.score,
          redirectUrl: '/brand',
        },
        { status: 422 }
      )
    }

    // Get user preferences for language detection
    const freshUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { preferences: true },
    })

    // Language detection: body -> user preferences -> fallback 'ar'
    const userPrefs = (freshUser?.preferences as Record<string, string> | null) ?? {}
    const language: string =
      (body?.language as string | undefined) ||
      userPrefs?.language ||
      'ar'

    // Build brief from full Brand Brain data -- inject everything
    const brief = {
      companyName: brandProfile.brandName ?? 'My Brand',
      businessType: brandProfile.industry ?? 'General Business',
      targetAudience: brandProfile.targetAudience ?? 'General audience',
      monthlyBudget: budgetOverride,
      primaryGoal: goalOverride,
      // Extended brand brain fields
      competitors: brandProfile.competitorNotes || undefined,
      region: brandProfile.audienceLocation || undefined,
      uniqueValue: brandProfile.uniqueAdvantages?.length
        ? brandProfile.uniqueAdvantages.join(', ')
        : undefined,
      avoidWords: brandProfile.avoidKeywords?.length
        ? brandProfile.avoidKeywords.join(', ')
        : undefined,
      writingStyle: brandProfile.writingStyle || undefined,
      pricePoint: brandProfile.pricePoint || undefined,
      painPoints: brandProfile.audiencePainPoints?.length
        ? brandProfile.audiencePainPoints.join(', ')
        : undefined,
      desires: brandProfile.audienceDesires?.length
        ? brandProfile.audienceDesires.join(', ')
        : undefined,
      primaryOffer: brandProfile.primaryOffer || undefined,
      winningHooks: brandProfile.winningHooks?.length
        ? brandProfile.winningHooks.slice(0, 3).join(' | ')
        : undefined,
      // Language preference -- drives AI output language
      language,
      // Campaign memory: inject past learnings for this workspace
      pastLearnings: formatMemoriesForPrompt(
        await getRelevantMemories({
          workspaceId: workspace.id,
          goal: goalOverride,
        })
      ) || undefined,
    }

    // Fetch media context — inject asset awareness into strategy brief
    try {
      const mediaItems = await prisma.media.findMany({
        where: { workspace: { ownerId: user.id } },
        select: { type: true, fileName: true },
        take: 100,
      })
      if (mediaItems.length > 0) {
        const imageCount = mediaItems.filter(m => m.type === 'IMAGE').length
        const videoCount = mediaItems.filter(m => m.type === 'VIDEO').length
        const parts: string[] = []
        if (imageCount > 0) parts.push(`${imageCount} image${imageCount !== 1 ? 's' : ''}`)
        if (videoCount > 0) parts.push(`${videoCount} video${videoCount !== 1 ? 's' : ''}`)
        ;(brief as Record<string, unknown>).mediaContext =
          `User has ${parts.join(' and ')} in their media library. Incorporate these existing visual assets into the content strategy — recommend specific usage per platform and content format.`
      }
    } catch { /* non-fatal — proceed without media context */ }

    // Run full orchestration
    const result = await runFullAgency(workspace.id, brief)

    // Fetch the newly-created campaign
    const campaign = result.strategyCreated
      ? await (prisma as any).campaign.findFirst({
          where: { workspaceId: workspace.id },
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true },
        })
      : null

    const success = result.strategyCreated && !!campaign?.id

    // ── Credit refund on complete failure ──────────────────────────────────
    // If strategy itself failed (no campaign created), refund the credits
    if (!success && credit.creditsUsed > 0) {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { aiCredits: { increment: credit.creditsUsed } },
        })
        console.log(`[strategy/run-full] Refunded ${credit.creditsUsed} credits to user ${user.id}`)
      } catch (refundErr) {
        console.error('[strategy/run-full] Credit refund failed:', refundErr)
      }
    }
    // ──────────────────────────────────────────────────────────────────────

    return NextResponse.json({
      ok: success,
      agentRunId: result.agentRunId,
      campaignId: campaign?.id ?? null,
      campaignName: campaign?.name ?? null,
      suggestions: result.suggestions,
      creditsRemaining: success ? credit.creditsRemaining : credit.creditsRemaining + credit.creditsUsed,
      creditsUsed: success ? credit.creditsUsed : 0,
      // Both formats for frontend compatibility
      errors: result.errors,
      error: !success && result.errors.length > 0 ? result.errors[0] : undefined,
    })
  } catch (err: any) {
    console.error('[api/strategy/run-full]', err)
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 })
  }
}
