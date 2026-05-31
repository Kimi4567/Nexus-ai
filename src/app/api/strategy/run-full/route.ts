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
    }

    // Run full orchestration (reuses existing orchestrator unchanged)
    const result = await runFullAgency(workspace.id, brief)

    // Fetch the newly-created campaign name for the success UI
    const campaign = result.errors.length === 0
      ? await (prisma as any).campaign.findFirst({
          where: { workspaceId: workspace.id },
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true },
        })
      : null

    return NextResponse.json({
      ok: result.errors.length === 0,
      agentRunId: result.agentRunId,
      campaignId: campaign?.id ?? null,
      campaignName: campaign?.name ?? null,
      suggestions: result.suggestions,
      creditsRemaining: credit.creditsRemaining,
      creditsUsed: credit.creditsUsed,
      errors: result.errors,
    })
  } catch (err: any) {
    console.error('[api/strategy/run-full]', err)
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 })
  }
}
