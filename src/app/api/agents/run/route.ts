/**
 * POST /api/agents/run
 * Triggers full agency orchestration for a workspace.
 * Called by /start form submission.
 *
 * Credit cost: RUN_FULL_STRATEGY (see lib/credits.ts)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { runFullAgency, BusinessBrief } from '@/lib/agents/orchestrator'
import { checkAndDeductCredits } from '@/lib/credits'
import { aiRateLimit } from '@/lib/dbRateLimit'

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Rate limit: 15 AI requests per minute per user
    if (!aiRateLimit(user.id)) return NextResponse.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })

    const body = await req.json()
    const { companyName, businessType, targetAudience, monthlyBudget, primaryGoal } = body

    if (!companyName || !businessType || !targetAudience || !monthlyBudget) {
      return NextResponse.json(
        { error: 'companyName, businessType, targetAudience, and monthlyBudget are required' },
        { status: 400 }
      )
    }

    // -- Unified credit check + deduction ------------------------------------
    const credit = await checkAndDeductCredits(user.id, 'RUN_FULL_STRATEGY')
    if (!credit.ok) {
      return NextResponse.json(credit, { status: 402 })
    }
    // ------------------------------------------------------------------------

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

    // Run agents (10-20s -- consider background queue for prod)
    const result = await runFullAgency(workspace.id, brief)

    return NextResponse.json({
      ok: true,
      workspaceId: workspace.id,
      creditsRemaining: credit.creditsRemaining,
      ...result,
    })
  } catch (err: any) {
    console.error('[api/agents/run]', err)
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 })
  }
}
