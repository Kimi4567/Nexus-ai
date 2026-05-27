/**
 * POST /api/agents/run
 * Triggers full agency orchestration for a workspace.
 * Called by /start form submission.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { runFullAgency, BusinessBrief } from '@/lib/agents/orchestrator'

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

    // Run agents (this may take 10–20s — consider background queue for prod)
    const result = await runFullAgency(workspace.id, brief)

    return NextResponse.json({
      ok: true,
      workspaceId: workspace.id,
      ...result,
    })
  } catch (err: any) {
    console.error('[api/agents/run]', err)
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 })
  }
}
