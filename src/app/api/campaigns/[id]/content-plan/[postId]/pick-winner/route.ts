/**
 * PATCH /api/campaigns/[id]/content-plan/[postId]/pick-winner
 *
 * FL2-E: A/B Testing — Pick the winning variant.
 *
 * Actions:
 *  1. Verify ownership + that postId belongs to this campaign
 *  2. Look up the variantGroup of the winning post
 *  3. Mark the winning post: variantWinner = true
 *  4. Delete the losing sibling variant (same variantGroup, different id)
 *  5. Record a user preference and prepare reviewable learning proposals
 *
 * Returns: { ok: true, winnerId, loserDeleted, learningProposalQueued }
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { runBrainLearning } from '@/lib/brain-learning'

type Params = { params: Promise<{ id: string; postId: string }> }

export async function PATCH(req: NextRequest, props: Params) {
  const params = await props.params;
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // ── 1. Verify campaign ownership ─────────────────────────────────────
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: userId } },
      select: { id: true, workspaceId: true },
    })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    // ── 2. Load the winning post ─────────────────────────────────────────
    const winner = await (prisma.socialPost as any).findFirst({
      where: {
        id: params.postId,
        campaignId: params.id,
        workspaceId: campaign.workspaceId,
      },
      select: {
        id: true,
        caption: true,
        platform: true,
        variantGroup: true,
        variantLabel: true,
        variantWinner: true,
      },
    }) as {
      id: string
      caption: string
      platform: string
      variantGroup: string | null
      variantLabel: string | null
      variantWinner: boolean
    } | null

    if (!winner) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    if (!winner.variantGroup) {
      return NextResponse.json({ error: 'This post is not part of an A/B test' }, { status: 400 })
    }

    // ── 3. Find the losing sibling (fetch full details BEFORE deletion) ─────
    const loser = await (prisma.socialPost as any).findFirst({
      where: {
        variantGroup: winner.variantGroup,
        campaignId: params.id,
        workspaceId: campaign.workspaceId,
        id: { not: winner.id },
      },
      select: { id: true, caption: true, platform: true, variantLabel: true },
    }) as { id: string; caption: string; platform: string; variantLabel: string | null } | null

    // ── 4. Apply selection + audit atomically ─────────────────────────────
    await prisma.$transaction(async (tx) => {
      const txDb = tx as any
      await txDb.socialPost.update({
        where: { id: winner.id },
        data: {
          variantWinner: true,
          variantGroup: null, // clear group — it's no longer part of an active A/B test
        },
      })
      if (loser) await txDb.socialPost.delete({ where: { id: loser.id } })
      await tx.marketingLearningEvent.create({
        data: {
          workspaceId: campaign.workspaceId,
          campaignId: campaign.id,
          socialPostId: winner.id,
          eventType: 'AB_VARIANT_SELECTED',
          source: 'CONTENT_REVIEW',
          actor: 'USER',
          metadata: {
            selectedVariant: winner.variantLabel ?? 'A',
            rejectedVariant: loser?.variantLabel ?? null,
            selectionBasis: 'USER_PREFERENCE',
            performanceClaim: false,
          },
        },
      })
    })

    // ── 5. Proposal path: compare the selected draft with the rejected draft ──
    let learningProposalQueued = false
    if (loser && loser.caption && loser.caption.trim().length > 10) {
      try {
        const proposed = await runBrainLearning({
          workspaceId: campaign.workspaceId,
          campaignId: campaign.id,
          trigger: 'ab_winner',
          payload: {
            selectionBasis: 'USER_PREFERENCE',
            winner: {
              caption: winner.caption,
              platform: String(winner.platform),
              variantLabel: winner.variantLabel ?? 'A',
            },
            loser: {
              caption: loser.caption,
              platform: String(loser.platform),
              variantLabel: loser.variantLabel ?? 'B',
            },
          },
        })
        learningProposalQueued = proposed > 0
      } catch {
        // The user's selection remains valid; proposal generation can be retried.
      }
    }

    return NextResponse.json({
      ok: true,
      winnerId: winner.id,
      loserDeleted: !!loser,
      hookLearned: false,
      learningProposalQueued,
    })
  } catch (err: any) {
    console.error('[pick-winner PATCH]', err)
    return NextResponse.json({ error: 'Failed to pick winner' }, { status: 500 })
  }
}
