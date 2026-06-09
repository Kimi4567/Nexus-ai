/**
 * GET  /api/brain/proposals   — list pending brain learning proposals
 * PATCH /api/brain/proposals  — accept or dismiss a proposal
 *
 * When a proposal is accepted:
 *   - The specific Brand Brain field is updated (arrays are merged, strings replaced)
 *   - Proposal status → 'accepted'
 *
 * When a proposal is dismissed:
 *   - Proposal status → 'dismissed'
 *   - Brand Brain is NOT modified
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/apiAuth'

const db = prisma as any  // eslint-disable-line @typescript-eslint/no-explicit-any

function mergeUnique(current: string[], incoming: string[], maxLen = 30): string[] {
  const seen = new Set(current.map(s => s.toLowerCase().trim()))
  const additions = incoming.filter(s => typeof s === 'string' && !seen.has(s.toLowerCase().trim()))
  return [...current, ...additions].slice(0, maxLen)
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
    })
    if (!workspace) return NextResponse.json({ proposals: [] })

    const url = new URL(req.url)
    const status = url.searchParams.get('status') || 'pending'

    let proposals: unknown[] = []
    try {
      proposals = await db.brainLearning.findMany({
        where: { workspaceId: workspace.id, status },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
    } catch {
      // Table may not exist yet (before prisma db push)
      return NextResponse.json({ proposals: [] })
    }

    return NextResponse.json({ proposals })
  } catch (error) {
    console.error('[brain/proposals GET]', error)
    return NextResponse.json({ error: 'Failed to load proposals' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { proposalId, action } = await req.json() as {
      proposalId: string
      action: 'accept' | 'dismiss'
    }

    if (!proposalId || !action) {
      return NextResponse.json({ error: 'Missing proposalId or action' }, { status: 400 })
    }

    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
    })
    if (!workspace) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

    // Load the proposal
    let proposal: Record<string, unknown> | null = null
    try {
      proposal = await db.brainLearning.findFirst({
        where: { id: proposalId, workspaceId: workspace.id, status: 'pending' },
      })
    } catch {
      return NextResponse.json({ error: 'BrainLearning table not ready — run prisma db push' }, { status: 503 })
    }

    if (!proposal) return NextResponse.json({ error: 'Proposal not found or already actioned' }, { status: 404 })

    if (action === 'dismiss') {
      await db.brainLearning.update({
        where: { id: proposalId },
        data: { status: 'dismissed' },
      })
      return NextResponse.json({ success: true, action: 'dismissed' })
    }

    // ── ACCEPT: apply to Brand Brain ─────────────────────────────────────────
    const field = proposal.field as string
    const proposed = proposal.proposed

    // Get current Brand Brain (or null)
    let brandBrain: Record<string, unknown> | null = null
    try {
      brandBrain = await db.brandProfile.findUnique({ where: { workspaceId: workspace.id } })
    } catch { /* no brand profile yet */ }

    // Build the update payload
    const updateData: Record<string, unknown> = {}

    // Array fields → merge unique
    const arrayFields = ['winningHooks', 'winningAngles', 'toneKeywords', 'audiencePainPoints', 'audienceDesires', 'uniqueAdvantages']
    if (arrayFields.includes(field)) {
      const current = brandBrain ? (brandBrain[field] as string[] || []) : []
      const incoming = Array.isArray(proposed) ? proposed as string[] : []
      updateData[field] = mergeUnique(current, incoming)
    } else if (field === 'strategicNotes') {
      // String field — append new insight
      const existing = brandBrain?.strategicNotes as string || ''
      const newNote = typeof proposed === 'string' ? proposed : ''
      updateData[field] = existing
        ? `${existing}\n\n[${new Date().toISOString().split('T')[0]}] ${newNote}`
        : newNote
    } else {
      updateData[field] = proposed
    }

    // Upsert Brand Brain
    if (brandBrain) {
      await db.brandProfile.update({
        where: { workspaceId: workspace.id },
        data: updateData,
      })
    } else {
      await db.brandProfile.create({
        data: {
          workspaceId: workspace.id,
          ...updateData,
        },
      })
    }

    // Mark proposal as accepted
    await db.brainLearning.update({
      where: { id: proposalId },
      data: { status: 'accepted' },
    })

    return NextResponse.json({
      success: true,
      action: 'accepted',
      field,
      message: `Brand Brain updated: ${field}`,
    })
  } catch (error) {
    console.error('[brain/proposals PATCH]', error)
    return NextResponse.json({ error: 'Failed to process proposal' }, { status: 500 })
  }
}
