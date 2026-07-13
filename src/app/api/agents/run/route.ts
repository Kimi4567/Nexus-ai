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
import { checkAndDeductCredits, refundCredits } from '@/lib/credits'
import { aiRateLimit } from '@/lib/dbRateLimit'
import { validateOutputObject, logQualityReport } from '@/lib/ai/outputValidator'
import { randomUUID } from 'crypto'
import { getAiProviderUnavailablePayload, isAiProviderConfigured } from '@/lib/ai/provider'

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Rate limit: 15 AI requests per minute per user
    if (!aiRateLimit(user.id)) return NextResponse.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })

    const body = await req.json()
    const companyName = typeof body.companyName === 'string' ? body.companyName.trim().slice(0, 120) : ''
    const businessType = typeof body.businessType === 'string' ? body.businessType.trim().slice(0, 120) : ''
    const targetAudience = typeof body.targetAudience === 'string' ? body.targetAudience.trim().slice(0, 1_000) : ''
    const monthlyBudget = Number(body.monthlyBudget)
    const primaryGoal = typeof body.primaryGoal === 'string' ? body.primaryGoal.trim().slice(0, 80) : 'leads'

    if (!companyName || !businessType || !targetAudience || !Number.isFinite(monthlyBudget) || monthlyBudget <= 0) {
      return NextResponse.json(
        { error: 'companyName, businessType, targetAudience, and monthlyBudget are required' },
        { status: 400 }
      )
    }

    if (!isAiProviderConfigured()) {
      return NextResponse.json(getAiProviderUnavailablePayload(body.language), { status: 503 })
    }

    // Get or create the first workspace under the same lock as /api/workspaces.
    const workspace = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `workspace-limit:${user.id}`)
      const existing = await tx.workspace.findFirst({ where: { ownerId: user.id }, orderBy: { createdAt: 'asc' } })
      if (existing) return existing
      const baseSlug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'workspace'
      return tx.workspace.create({
        data: { name: companyName, slug: `${baseSlug}-${randomUUID().slice(0, 8)}`, ownerId: user.id },
      })
    })

    // Update user company info
    await prisma.user.update({
      where: { id: user.id },
      data: { company: companyName },
    })

    // Save user-provided setup and its Brand Brain revision atomically.
    await prisma.$transaction(async (tx) => {
      await tx.brandProfile.upsert({
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
      await tx.marketingLearningEvent.create({
        data: {
          workspaceId: workspace.id,
          eventType: 'BRAND_PROFILE_UPDATED',
          source: 'STRATEGY_INTAKE',
          actor: 'USER',
          metadata: {
            changedFields: ['brandName', 'industry', 'targetAudience'],
          },
        },
      })
    })

    // Deduct only after all non-AI setup writes have succeeded.
    const credit = await checkAndDeductCredits(user.id, 'RUN_FULL_STRATEGY')
    if (!credit.ok) return NextResponse.json(credit, { status: 402 })

    const brief: BusinessBrief = {
      companyName,
      businessType,
      targetAudience,
      monthlyBudget,
      primaryGoal,
    }

    // Run agents (10-20s -- consider background queue for prod)
    let result
    try {
      result = await runFullAgency(workspace.id, brief)
    } catch (genErr) {
      // Refund — failed strategy run must not charge the user (skip unlimited plans)
      if (credit.creditsUsed > 0) await refundCredits(user.id, 'RUN_FULL_STRATEGY')
      throw genErr
    }

    if (!result.strategyCreated) {
      if (credit.creditsUsed > 0) await refundCredits(user.id, 'RUN_FULL_STRATEGY')
      const limitError = result.errors.find((message) => message.startsWith('CAMPAIGN_LIMIT_REACHED:'))
      if (limitError) {
        const [, limit, ...resetParts] = limitError.split(':')
        const resetsAt = resetParts.join(':')
        return NextResponse.json({
          error: 'CAMPAIGN_LIMIT_REACHED',
          limit: Number(limit),
          resetsAt,
          creditsUsed: 0,
          creditsRemaining: credit.creditsRemaining + credit.creditsUsed,
          upgradeUrl: '/billing',
        }, { status: 403 })
      }
      return NextResponse.json({
        error: result.errors[0] || 'Strategy generation failed',
        creditsUsed: 0,
        creditsRemaining: credit.creditsRemaining + credit.creditsUsed,
      }, { status: 502 })
    }

    // AD3: Post-generation quality validation (non-blocking — logs only)
    const qualityReport = validateOutputObject(result, {
      brandName: companyName,
      minScore: 40,
    })
    logQualityReport('/api/agents/run', qualityReport, `workspace=${workspace.id}`)

    return NextResponse.json({
      ok: true,
      workspaceId: workspace.id,
      creditsRemaining: credit.creditsRemaining,
      qualityScore: qualityReport.score,
      ...result,
    })
  } catch (err: any) {
    console.error('[api/agents/run]', err)
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 })
  }
}
