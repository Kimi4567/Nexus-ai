/**
 * POST /api/agents/run
 * Triggers full agency orchestration for a workspace.
 * Called by /start form submission.
 *
 * Credit system:
 *   FREE:    3 complimentary runs to experience the product, then upgrade required
 *   STARTER: 50 credits/month (set by billing webhook)
 *   PRO:     200 credits/month (set by billing webhook)
 *   AGENCY:  Unlimited (aiCredits = -1)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { runFullAgency, BusinessBrief } from '@/lib/agents/orchestrator'

const FREE_COMPLIMENTARY_RUNS = 3

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { companyName, businessType, targetAudience, monthlyBudget, primaryGoal } = body

    if (!companyName || !businessType || !targetAudience || !monthlyBudget) {
      return NextResponse.json(
        { error: 'companyName, businessType, targetAudience, and monthlyBudget are required' },
        { status: 400 }
      )
    }

    // ── Credit check ────────────────────────────────────────────────────────
    let freshUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, subscriptionStatus: true, aiCredits: true, monthlyGenerations: true },
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

    // Get or create workspace
    let workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
    })

    if (!workspace) {
      const slug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 30)
        + '-' + Math.random().toString(36).slice(2, 6)
      workspace = await prisma.workspace.create({
        data: {
          name: companyName,
          slug,
          ownerId: user.id,
        },
      })
    }

    // Update user company info
    await prisma.user.update({
      where: { id: user.id },
      data: { company: companyName },
    })

    // Upsert brand profile
    await prisma.brandProfile.upsert({
      where: { workspaceId: workspace.id },
      create: {
        workspaceId: workspace.id,
        brandName: companyName,
        industry: businessType,
        targetAudience,
      },
      update: {
        brandName: companyName,
        industry: businessType,
        targetAudience,
      },
    })

    const brief: BusinessBrief = {
      companyName,
      businessType,
      targetAudience,
      monthlyBudget: Number(monthlyBudget),
      primaryGoal: primaryGoal || 'leads',
    }

    // Run agents (10–20s — consider background queue for prod)
    const result = await runFullAgency(workspace.id, brief)

    // ── Deduct credit + track usage ─────────────────────────────────────────
    await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(isUnlimited ? {} : { aiCredits: { decrement: 1 } }),
        monthlyGenerations: { increment: 1 },
      },
    })

    // Monthly usage tracking (non-blocking — table may not exist yet)
    const now = new Date()
    ;(prisma as any).usage.upsert({
      where: { userId_month_year: { userId: user.id, month: now.getMonth() + 1, year: now.getFullYear() } },
      create: { userId: user.id, month: now.getMonth() + 1, year: now.getFullYear(), aiCreditsUsed: 1, generationsCount: 1 },
      update: { aiCreditsUsed: { increment: 1 }, generationsCount: { increment: 1 } },
    }).catch(() => {})
    // ────────────────────────────────────────────────────────────────────────

    return NextResponse.json({
      ok: true,
      workspaceId: workspace.id,
      creditsRemaining: isUnlimited ? -1 : freshUser.aiCredits - 1,
      ...result,
    })
  } catch (err: any) {
    console.error('[api/agents/run]', err)
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 })
  }
}
