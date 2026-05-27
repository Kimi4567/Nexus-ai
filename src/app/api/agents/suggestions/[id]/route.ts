/**
 * POST /api/agents/suggestions/[id]
 * Body: { action: 'approve' | 'reject' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { action } = await req.json()
    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
    }

    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
    })
    if (!workspace) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

    const suggestion = await (prisma as any).agentSuggestion.findFirst({
      where: { id: params.id, workspaceId: workspace.id },
    })
    if (!suggestion) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (suggestion.status !== 'PENDING') {
      return NextResponse.json({ error: 'Already actioned' }, { status: 409 })
    }

    const now = new Date()

    if (action === 'reject') {
      await (prisma as any).agentSuggestion.update({
        where: { id: params.id },
        data: { status: 'REJECTED', rejectedAt: now },
      })
      return NextResponse.json({ ok: true, status: 'REJECTED' })
    }

    // APPROVE — execute the action
    let executionResult: any = { executed: true }

    try {
      const payload = suggestion.payload as any
      const type = suggestion.type as string

      if (type === 'STRATEGY' && payload?.campaignId) {
        // Activate the campaign
        await (prisma.campaign as any).update({
          where: { id: payload.campaignId },
          data: { status: 'ACTIVE' },
        })
        executionResult = { campaignActivated: payload.campaignId }

      } else if (type === 'CAMPAIGN_PAUSE' && payload?.campaignId) {
        await (prisma.campaign as any).update({
          where: { id: payload.campaignId },
          data: { status: 'PAUSED' },
        })
        executionResult = { campaignPaused: payload.campaignId }

      } else if (type === 'CONTENT_SWAP' && payload?.campaignId) {
        // Log activity — actual content swap would require Content Director re-run
        await (prisma.campaignActivity as any).create({
          data: {
            campaignId: payload.campaignId,
            type: 'regenerated',
            description: `Content refreshed based on Campaign Manager suggestion: ${suggestion.title}`,
            metadata: payload,
          },
        })
        executionResult = { contentSwapLogged: true }

      } else if (type === 'BUDGET_CHANGE' && payload?.campaignId) {
        // Store budget change in campaign metadata
        const campaign = await (prisma.campaign as any).findUnique({
          where: { id: payload.campaignId },
          select: { performanceMetrics: true },
        })
        await (prisma.campaign as any).update({
          where: { id: payload.campaignId },
          data: {
            performanceMetrics: {
              ...(campaign?.performanceMetrics || {}),
              budgetChange: payload,
              budgetChangedAt: now.toISOString(),
            },
          },
        })
        executionResult = { budgetChangeRecorded: true }
      }

    } catch (execErr: any) {
      executionResult = { error: execErr?.message }
    }

    await (prisma as any).agentSuggestion.update({
      where: { id: params.id },
      data: {
        status: 'EXECUTED',
        approvedAt: now,
        executedAt: now,
        executionResult,
      },
    })

    return NextResponse.json({ ok: true, status: 'EXECUTED', result: executionResult })
  } catch (err: any) {
    console.error('[api/agents/suggestions/[id]]', err)
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
