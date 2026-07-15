import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { buildPromotedEvidenceProof } from '@/lib/brandEvidence'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await props.params
    const body = await req.json()
    const action = body?.action
    if (!['approve', 'approve_conflict', 'reject', 'mark_outdated'].includes(action)) {
      return NextResponse.json({ error: 'Unsupported evidence review action' }, { status: 400 })
    }

    const existing = await prisma.brandEvidenceClaim.findFirst({
      where: { id, workspace: { ownerId: user.id } },
      include: { document: { select: { originalName: true } } },
    })
    if (!existing) return NextResponse.json({ error: 'Evidence claim not found' }, { status: 404 })
    if (action === 'approve' && existing.truthStatus === 'CONFLICTING') {
      return NextResponse.json({
        error: 'This claim conflicts with confirmed numeric evidence. Review both sources and explicitly confirm the conflict before replacing Brand Brain proof.',
        code: 'EXPLICIT_CONFLICT_APPROVAL_REQUIRED',
        conflictClaimId: existing.conflictClaimId,
      }, { status: 409 })
    }
    if (action === 'approve_conflict' && existing.truthStatus !== 'CONFLICTING') {
      return NextResponse.json({ error: 'Explicit conflict approval is only available for a flagged conflict.' }, { status: 400 })
    }
    const supersededClaim = action === 'approve_conflict' && existing.conflictClaimId
      ? await prisma.brandEvidenceClaim.findFirst({
          where: {
            id: existing.conflictClaimId,
            workspaceId: existing.workspaceId,
            status: 'APPROVED',
            truthStatus: 'CONFIRMED',
          },
          select: { id: true, promotedProof: true },
        })
      : null
    if (action === 'approve_conflict' && !supersededClaim) {
      return NextResponse.json({
        error: 'The previously confirmed evidence changed. Refresh and review the conflict again.',
        code: 'CONFLICT_SOURCE_CHANGED',
      }, { status: 409 })
    }

    const approving = action === 'approve' || action === 'approve_conflict'
    const nextStatus = approving ? 'APPROVED' : 'REJECTED'
    const nextTruthStatus = approving
      ? 'CONFIRMED'
      : action === 'mark_outdated'
        ? 'OUTDATED'
        : existing.truthStatus === 'CONFIRMED'
          ? 'PROPOSED'
          : existing.truthStatus
    const promotedProof = approving
      ? buildPromotedEvidenceProof(existing, existing.document.originalName)
      : null

    const result = await prisma.$transaction(async tx => {
      const currentProfile = await tx.brandProfile.findUnique({
        where: { workspaceId: existing.workspaceId },
        select: { verifiedProof: true },
      })
      const proofs = currentProfile?.verifiedProof ?? []
      const withoutPrevious = existing.promotedProof
        ? proofs.filter(proof => proof !== existing.promotedProof)
        : proofs
      const withoutSuperseded = supersededClaim?.promotedProof
        ? withoutPrevious.filter(proof => proof !== supersededClaim.promotedProof)
        : withoutPrevious
      const verifiedProof = promotedProof && !withoutSuperseded.includes(promotedProof)
        ? [...withoutSuperseded, promotedProof]
        : withoutSuperseded

      await tx.brandProfile.upsert({
        where: { workspaceId: existing.workspaceId },
        create: { workspaceId: existing.workspaceId, verifiedProof },
        update: { verifiedProof },
      })
      if (supersededClaim) {
        await tx.brandEvidenceClaim.update({
          where: { id: supersededClaim.id },
          data: {
            status: 'REJECTED',
            truthStatus: 'OUTDATED',
            promotedProof: null,
            reviewedById: user.id,
            reviewedAt: new Date(),
          },
        })
      }
      const claim = await tx.brandEvidenceClaim.update({
        where: { id: existing.id },
        data: {
          status: nextStatus,
          truthStatus: nextTruthStatus,
          promotedProof,
          reviewedById: user.id,
          reviewedAt: new Date(),
        },
        select: { id: true, status: true, truthStatus: true, reviewedAt: true },
      })
      const pending = await tx.brandEvidenceClaim.count({
        where: { documentId: existing.documentId, status: 'PENDING' },
      })
      if (pending === 0) {
        await tx.brandEvidenceDocument.update({
          where: { id: existing.documentId },
          data: { status: 'READY' },
        })
      }
      return claim
    })

    return NextResponse.json({ claim: result, promotedProof, supersededClaimId: supersededClaim?.id ?? null })
  } catch (error) {
    console.error('[brand/evidence claim PATCH]', error)
    return NextResponse.json({ error: 'Failed to review evidence claim' }, { status: 500 })
  }
}
