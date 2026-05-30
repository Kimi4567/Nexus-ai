/**
 * /api/suggestions
 *
 * GET  — list AgentSuggestion records for the current user's workspace
 * PATCH — update a suggestion status (APPROVED or REJECTED)
 *
 * No schema change required.
 * Brand Brain update on APPROVE is deferred to Sprint C (suggestion only
 * changes status for now — the foundation is in place).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

const db = prisma as any

// ── GET /api/suggestions ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    if (!workspace) return NextResponse.json({ suggestions: [] })

    const url = new URL(req.url)
    const limit = Math.min(Number(url.searchParams.get('limit') || '10'), 20)

    // Fetch suggestions ordered by priority then date
    const raw = await db.agentSuggestion.findMany({
      where: { workspaceId: workspace.id },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      take: limit,
    })

    if (!raw.length) return NextResponse.json({ suggestions: [] })

    // Batch-fetch campaign names for suggestions that have a campaignId
    const campaignIds = [...new Set(
      raw.map((s: any) => s.campaignId).filter(Boolean)
    )] as string[]

    const campaigns = campaignIds.length
      ? await db.campaign.findMany({
          where: { id: { in: campaignIds } },
          select: { id: true, name: true },
        })
      : []

    const campaignMap = Object.fromEntries(
      campaigns.map((c: { id: string; name: string }) => [c.id, c.name])
    )

    const suggestions = raw.map((s: any) => ({
      id:           s.id,
      agent:        s.agent,
      type:         s.type,
      status:       s.status,
      priority:     s.priority,
      title:        s.title,
      reasoning:    s.reasoning,
      impact:       s.impact ?? null,
      campaignId:   s.campaignId ?? null,
      campaignName: s.campaignId ? (campaignMap[s.campaignId] ?? null) : null,
      approvedAt:   s.approvedAt ?? null,
      rejectedAt:   s.rejectedAt ?? null,
      executedAt:   s.executedAt ?? null,
      expiresAt:    s.expiresAt ?? null,
      createdAt:    s.createdAt,
    }))

    return NextResponse.json({ suggestions })
  } catch (err: any) {
    console.error('[GET /api/suggestions]', err)
    return NextResponse.json({ error: 'Failed to load suggestions' }, { status: 500 })
  }
}

// ── PATCH /api/suggestions ───────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { id, status } = body as { id?: string; status?: string }

    if (!id || !['APPROVED', 'REJECTED'].includes(status ?? '')) {
      return NextResponse.json(
        { error: 'id and status (APPROVED | REJECTED) are required' },
        { status: 400 }
      )
    }

    // Verify ownership via workspace
    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    const existing = await db.agentSuggestion.findFirst({
      where: { id, workspaceId: workspace.id },
    })
    if (!existing) return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })

    const now = new Date()
    const updated = await db.agentSuggestion.update({
      where: { id },
      data: {
        status,
        approvedAt: status === 'APPROVED' ? now : existing.approvedAt,
        rejectedAt: status === 'REJECTED' ? now : existing.rejectedAt,
      },
    })

    // NOTE: Brand Brain update on APPROVE is deferred to Sprint C.
    // The status is updated here; Sprint C will read APPROVED suggestions
    // and propagate winning hooks/angles back to BrandProfile.

    return NextResponse.json({ ok: true, suggestion: { id: updated.id, status: updated.status } })
  } catch (err: any) {
    console.error('[PATCH /api/suggestions]', err)
    return NextResponse.json({ error: 'Failed to update suggestion' }, { status: 500 })
  }
}
