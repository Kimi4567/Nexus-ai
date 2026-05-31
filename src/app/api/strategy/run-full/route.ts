/**
 * POST /api/strategy/run-full
 *
 * Re-triggers the full agency orchestration from the dashboard at any time.
 * Reads Brand Brain from the existing workspace — no form required.
 * Reuses the exact same runFullAgency() orchestrator used during onboarding.
 *
 * Credit system: same rules as /api/agents/run
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { runFullAgency } from '@/lib/agents/orchestrator'

const FREE_COMPLIMENTARY_RUNS = 3

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const goalOverride = (body?.goal as string | undefined) || 'leads'
    const budgetOverride = Number(body?.budget) || 5000

    // ── Credit check (mirrors /api/agents/run) ───────────────────────────────
    let freshUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, subscriptionStatus: true, aiCredits: true, monthlyGenerations: true, preferences: true },
    })
    if (!freshUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const isUnlimited = freshUser.aiCredits === -1
    const isFree = freshUser.subscriptionStatus === 'FREE'

    if (!isUnlimited) {
      // First-time free user: grant complimentary runs
      if (isFree && freshUser.aiCredits === 0 && freshUser.monthlyGenerations === 0) {
        await prisma.user.update({
          where: { id: user.id },
          data: { aiCredits: FREE_COMPLIMENTARY_RUNS },
        })
        freshUser = { ...freshUser, aiCredits: FREE_COMPLIMENTARY_RUNS }
      }

      if (freshUser.aiCredits <= 0) {
        return NextResponse.json(
          {
            error: 'CREDITS_EXHAUSTED',
            message: isFree
              ? `You've used your ${FREE_COMPLIMENTARY_RUNS} free campaigns. Upgrade to keep going.`
              : 'Monthly credits exhausted. Upgrade your plan or wait for your next billing cycle.',
            creditsRemaining: 0,
            upgradeUrl: '/billing',
          },
          { status: 402 }
        )
      }
    }
    // ────────────────────────────────────────────────────────────────────────

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

    // Get brand profile — required to auto-populate the brief
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

    // ── Language detection: body → user preferences → fallback 'ar' ────────
    const userPrefs = (freshUser?.preferences as Record<string, string> | null) ?? {}
    const language: string =
      (body?.language as string | undefined) ||
      userPrefs?.language ||
      'ar'

    // Build brief from full Brand Brain data — inject everything
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
      // Language preference — drives AI output language
      language,
    }

    // ── Run full orchestration (reuses existing orchestrator unchanged) ──────
    const result = await runFullAgency(workspace.id, brief)
    // ────────────────────────────────────────────────────────────────────────

    // ── Deduct credit + track usage (mirrors /api/agents/run) ───────────────
    await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(isUnlimited ? {} : { aiCredits: { decrement: 1 } }),
        monthlyGenerations: { increment: 1 },
      },
    })

    const now = new Date()
    ;(prisma as any).usage.upsert({
      where: { userId_month_year: { userId: user.id, month: now.getMonth() + 1, year: now.getFullYear() } },
      create: { userId: user.id, month: now.getMonth() + 1, year: now.getFullYear(), aiCreditsUsed: 1, generationsCount: 1 },
      update: { aiCreditsUsed: { increment: 1 }, generationsCount: { increment: 1 } },
    }).catch(() => {})
    // ────────────────────────────────────────────────────────────────────────

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
      creditsRemaining: isUnlimited ? -1 : freshUser.aiCredits - 1,
      errors: result.errors,
    })
  } catch (err: any) {
    console.error('[api/strategy/run-full]', err)
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 })
  }
}
