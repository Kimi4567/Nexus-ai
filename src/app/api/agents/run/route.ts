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
import {
  checkAndDeductCredits,
  creditCheckHttpStatus,
  finalizeCreditDeduction,
  getCreditActionPolicy,
  refundCreditDeduction,
  type CreditDeductionOk,
} from '@/lib/credits'
import { validateOutputObject, logQualityReport } from '@/lib/ai/outputValidator'
import { randomUUID } from 'crypto'
import { getAiProviderUnavailablePayload, isAiProviderConfigured } from '@/lib/ai/provider'
import { enforceBillableAiRateLimit } from '@/lib/billableAiRateLimit'
import { getCreditOperationKey } from '@/lib/creditOperationKey.server'

export async function POST(req: NextRequest) {
  let chargedCredit: CreditDeductionOk | null = null
  let chargedUserId: string | null = null
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
    const rateLimitResponse = await enforceBillableAiRateLimit(user.id, 'RUN_FULL_STRATEGY')
    if (rateLimitResponse) return rateLimitResponse
    const credit = await checkAndDeductCredits(
      user.id,
      'RUN_FULL_STRATEGY',
      undefined,
      {
        entityId: workspace.id,
        entityType: 'workspace_strategy_run',
        operationKey: getCreditOperationKey(req, 'RUN_FULL_STRATEGY', 'workspace_strategy_run', workspace.id),
      },
    )
    if (!credit.ok) return NextResponse.json(credit, { status: creditCheckHttpStatus(credit) })
    chargedCredit = credit
    chargedUserId = user.id

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
      await refundCreditDeduction({
        userId: user.id,
        action: 'RUN_FULL_STRATEGY',
        deduction: credit,
        reason: 'Full strategy generation failed',
      })
      throw genErr
    }

    if (!result.strategyCreated) {
      await refundCreditDeduction({
        userId: user.id,
        action: 'RUN_FULL_STRATEGY',
        deduction: credit,
        reason: 'No usable strategy was created',
      })
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

    const finalization = await finalizeCreditDeduction({
      userId: user.id,
      action: 'RUN_FULL_STRATEGY',
      deduction: credit,
    })
    if (!finalization.ok) {
      chargedCredit = null
      return NextResponse.json({
        error: 'Strategy was created but the credit operation could not be finalized. Reserved credits were returned.',
        code: 'CREDIT_FINALIZATION_FAILED',
        refunded: finalization.refundStatus === 'refunded',
      }, { status: 503 })
    }
    chargedCredit = null

    return NextResponse.json({
      ok: true,
      workspaceId: workspace.id,
      creditsRemaining: credit.creditsRemaining,
      creditsUsed: credit.creditsUsed,
      creditCharge: {
        ...getCreditActionPolicy('RUN_FULL_STRATEGY'),
        creditsUsed: credit.creditsUsed,
      },
      qualityScore: qualityReport.score,
      ...result,
    })
  } catch (err: any) {
    console.error('[api/agents/run]', err)
    if (chargedCredit && chargedUserId) {
      await refundCreditDeduction({
        userId: chargedUserId,
        action: 'RUN_FULL_STRATEGY',
        deduction: chargedCredit,
        reason: 'Full strategy route failed before finalization',
      })
    }
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 })
  }
}
