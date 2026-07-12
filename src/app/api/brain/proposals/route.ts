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
import { snapshotBrandMaturity } from '@/lib/brandMaturity'
import { inspectBrainSignalProvenance } from '@/lib/brainSignalProvenance'

const db = prisma as any  // eslint-disable-line @typescript-eslint/no-explicit-any

const ACCEPTABLE_LEARNING_FIELDS = new Set([
  'winningHooks',
  'winningAngles',
  'failedAngles',
  'toneKeywords',
  'audiencePainPoints',
  'audienceDesires',
  'uniqueAdvantages',
  'topPlatforms',
  'strategicNotes',
])

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
    let total = 0
    try {
      const where = status.toLowerCase() === 'all'
        ? { workspaceId: workspace.id }
        : { workspaceId: workspace.id, status }
      ;[proposals, total] = await Promise.all([
        db.brainLearning.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
        db.brainLearning.count({ where }),
      ])
    } catch {
      // Table may not exist yet (before prisma db push)
      return NextResponse.json({ proposals: [], total: 0 })
    }

    const traceableProposals = proposals.map(raw => {
      const proposal = raw as Record<string, unknown>
      const provenance = inspectBrainSignalProvenance({
        trigger: typeof proposal.trigger === 'string' ? proposal.trigger : null,
        reason: typeof proposal.reason === 'string' ? proposal.reason : null,
        campaignId: typeof proposal.campaignId === 'string' ? proposal.campaignId : null,
      })
      return {
        ...proposal,
        reason: provenance.displayReason,
        traceability: provenance.traceability,
        sourceRefs: provenance.sourceRefs,
        canAccept: provenance.canAccept,
      }
    })

    return NextResponse.json({ proposals: traceableProposals, total })
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
      proposalId?: string
      action: 'accept' | 'dismiss' | 'dismiss_blocked'
    }

    if (!['accept', 'dismiss', 'dismiss_blocked'].includes(action) || (action !== 'dismiss_blocked' && !proposalId)) {
      return NextResponse.json({ error: 'Missing proposalId or action' }, { status: 400 })
    }

    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
    })
    if (!workspace) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

    if (action === 'dismiss_blocked') {
      const pending = await db.brainLearning.findMany({
        where: { workspaceId: workspace.id, status: 'pending' },
        select: { id: true, trigger: true, reason: true, campaignId: true },
        take: 250,
      }) as Array<{ id: string; trigger: string; reason: string; campaignId: string | null }>
      const blocked = pending.filter(item => !inspectBrainSignalProvenance(item).canAccept)
      if (blocked.length === 0) return NextResponse.json({ success: true, action: 'dismissed_blocked', count: 0 })

      await prisma.$transaction(async (tx) => {
        await (tx as any).brainLearning.updateMany({
          where: { id: { in: blocked.map(item => item.id) }, workspaceId: workspace.id, status: 'pending' },
          data: { status: 'dismissed' },
        })
        await tx.marketingLearningEvent.createMany({
          data: blocked.map(item => ({
            workspaceId: workspace.id,
            campaignId: item.campaignId,
            eventType: 'BRAND_LEARNING_DISMISSED',
            source: 'BRAIN_PROPOSAL',
            actor: 'USER',
            metadata: { proposalId: item.id, reason: 'SOURCE_REQUIRED' },
          })),
        })
      })
      return NextResponse.json({ success: true, action: 'dismissed_blocked', count: blocked.length })
    }

    // Load the proposal
    let proposal: Record<string, unknown> | null = null
    try {
      proposal = await db.brainLearning.findFirst({
        where: { id: proposalId!, workspaceId: workspace.id, status: 'pending' },
      })
    } catch {
      return NextResponse.json({ error: 'BrainLearning table not ready — run prisma db push' }, { status: 503 })
    }

    if (!proposal) return NextResponse.json({ error: 'Proposal not found or already actioned' }, { status: 404 })

    if (action === 'dismiss') {
      await prisma.$transaction(async (tx) => {
        await (tx as any).brainLearning.update({
          where: { id: proposalId! },
          data: { status: 'dismissed' },
        })
        await tx.marketingLearningEvent.create({
          data: {
            workspaceId: workspace.id,
            campaignId: typeof proposal.campaignId === 'string' ? proposal.campaignId : null,
            eventType: 'BRAND_LEARNING_DISMISSED',
            source: 'BRAIN_PROPOSAL',
            actor: 'USER',
            metadata: { proposalId: proposalId! },
          },
        })
      })
      return NextResponse.json({ success: true, action: 'dismissed' })
    }

    const provenance = inspectBrainSignalProvenance({
      trigger: typeof proposal.trigger === 'string' ? proposal.trigger : null,
      reason: typeof proposal.reason === 'string' ? proposal.reason : null,
      campaignId: typeof proposal.campaignId === 'string' ? proposal.campaignId : null,
    })
    if (!provenance.canAccept) {
      return NextResponse.json({
        error: 'This external signal cannot be applied because no traceable source is attached.',
        code: 'SOURCE_REQUIRED',
      }, { status: 409 })
    }

    // ── ACCEPT: apply to Brand Brain ─────────────────────────────────────────
    const field = proposal.field as string
    const proposed = proposal.proposed

    if (!ACCEPTABLE_LEARNING_FIELDS.has(field)) {
      return NextResponse.json({ error: 'Unsupported Brand Brain learning field' }, { status: 400 })
    }

    // Get current Brand Brain (or null)
    let brandBrain: Record<string, unknown> | null = null
    try {
      brandBrain = await db.brandProfile.findUnique({ where: { workspaceId: workspace.id } })
    } catch { /* no brand profile yet */ }

    // Build the update payload
    const updateData: Record<string, unknown> = {}

    // Array fields → merge unique
    const arrayFields = ['winningHooks', 'winningAngles', 'failedAngles', 'toneKeywords', 'audiencePainPoints', 'audienceDesires', 'uniqueAdvantages', 'topPlatforms']
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

    // Apply, mark accepted, and append the revision event atomically. A failed
    // event write must never leave the profile changed without provenance.
    await prisma.$transaction(async (tx) => {
      const txDb = tx as any // dynamic allowlisted BrandProfile field
      if (brandBrain) {
        await txDb.brandProfile.update({
          where: { workspaceId: workspace.id },
          data: updateData,
        })
      } else {
        await txDb.brandProfile.create({
          data: {
            workspaceId: workspace.id,
            ...updateData,
          },
        })
      }

      await txDb.brainLearning.update({
          where: { id: proposalId! },
        data: { status: 'accepted' },
      })

      await tx.marketingLearningEvent.create({
        data: {
          workspaceId: workspace.id,
          campaignId: typeof proposal.campaignId === 'string' ? proposal.campaignId : null,
          eventType: 'BRAND_LEARNING_ACCEPTED',
          source: 'BRAIN_PROPOSAL',
          actor: 'USER',
          metadata: {
            proposalId: proposalId!,
            trigger: typeof proposal.trigger === 'string' ? proposal.trigger : 'unknown',
            changedFields: [field],
          },
        },
      })
    })

    const maturity = await snapshotBrandMaturity(db, workspace.id)

    return NextResponse.json({
      success: true,
      action: 'accepted',
      field,
      maturity,
      message: `Brand Brain updated: ${field}`,
    })
  } catch (error) {
    console.error('[brain/proposals PATCH]', error)
    return NextResponse.json({ error: 'Failed to process proposal' }, { status: 500 })
  }
}
