/**
 * PATCH /api/campaigns/[id]/content-plan/[postId]/pick-winner
 *
 * FL2-E: A/B draft comparison — select the preferred draft variant.
 *
 * Actions:
 *  1. Verify ownership + that postId belongs to this campaign
 *  2. Look up the variantGroup of the selected post
 *  3. Mark the selected post: variantWinner = true (legacy field name; user-facing meaning = selected variant)
 *  4. Delete the discarded sibling variant (same variantGroup, different id)
 *  5. Request user preference signal proposals for review. This is not a direct Brand Brain update
 *     and not analytics-backed learning. The route name remains pick-winner for compatibility.
 *
 * This is not a distributed performance experiment and never creates a winner claim.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { runBrainLearning } from '@/lib/brain-learning'
import { getBrandBrainLearningCopy } from '@/lib/brandBrainLearningContract'
import { getDraftVariantComparison } from '@/lib/draftVariantComparison'

type Params = { params: Promise<{ id: string; postId: string }> }

export async function PATCH(req: NextRequest, props: Params) {
  const params = await props.params
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // ── 1. Verify campaign ownership ─────────────────────────────────────
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: userId } },
      select: { id: true, workspaceId: true, aiOutput: true },
    })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    // ── 2. Load the selected post ────────────────────────────────────────
    const selected = await (prisma.socialPost as any).findFirst({
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
        contentPlanIndex: true,
        status: true,
        publishedAt: true,
        updatedAt: true,
      },
    }) as {
      id: string
      caption: string
      platform: string
      variantGroup: string | null
      variantLabel: string | null
      variantWinner: boolean
      contentPlanIndex: number | null
      status: string
      publishedAt: Date | null
      updatedAt: Date
    } | null

    if (!selected) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    if (!selected.variantGroup) {
      return NextResponse.json({ error: 'This post is not part of an A/B test' }, { status: 400 })
    }
    if (selected.status !== 'DRAFT' || selected.publishedAt) {
      return NextResponse.json({
        error: 'Draft variants must be compared before copy approval or execution.',
        code: 'DRAFT_VARIANT_SELECTION_REQUIRED',
      }, { status: 409 })
    }

    // ── 3. Find the losing sibling (fetch full details BEFORE deletion) ─────
    const loser = await (prisma.socialPost as any).findFirst({
      where: {
        variantGroup: selected.variantGroup,
        campaignId: params.id,
        workspaceId: campaign.workspaceId,
        id: { not: selected.id },
      },
      select: {
        id: true,
        caption: true,
        platform: true,
        variantLabel: true,
        status: true,
        publishedAt: true,
        updatedAt: true,
      },
    }) as {
      id: string
      caption: string
      platform: string
      variantLabel: string | null
      status: string
      publishedAt: Date | null
      updatedAt: Date
    } | null

    if (!loser || loser.status !== 'DRAFT' || loser.publishedAt) {
      return NextResponse.json({
        error: 'The draft comparison pair is incomplete or has already entered approval.',
        code: 'VARIANT_PAIR_REVIEW_REQUIRED',
      }, { status: 409 })
    }

    const aiOutput = campaign.aiOutput && typeof campaign.aiOutput === 'object' && !Array.isArray(campaign.aiOutput)
      ? campaign.aiOutput as Record<string, unknown>
      : {}
    const strategy = aiOutput.strategy && typeof aiOutput.strategy === 'object' && !Array.isArray(aiOutput.strategy)
      ? aiOutput.strategy
      : aiOutput
    const draftComparison = getDraftVariantComparison(strategy, selected.contentPlanIndex)

    // ── 4. Persist one atomic draft-preference decision ───────────────────
    await prisma.$transaction(async (tx) => {
      const selectedResult = await tx.socialPost.updateMany({
        where: {
          id: selected.id,
          campaignId: campaign.id,
          workspaceId: campaign.workspaceId,
          variantGroup: selected.variantGroup,
          status: 'DRAFT',
          publishedAt: null,
          updatedAt: selected.updatedAt,
        },
        data: {
          variantWinner: true,
          variantGroup: null,
          variantLabel: null,
        },
      })
      const discardedResult = await tx.socialPost.deleteMany({
        where: {
          id: loser.id,
          campaignId: campaign.id,
          workspaceId: campaign.workspaceId,
          variantGroup: selected.variantGroup,
          status: 'DRAFT',
          publishedAt: null,
          updatedAt: loser.updatedAt,
        },
      })
      if (selectedResult.count !== 1 || discardedResult.count !== 1) {
        throw new Error('DRAFT_VARIANT_CONCURRENT_CHANGE')
      }
      await tx.campaignActivity.create({
        data: {
          campaignId: campaign.id,
          type: 'draft_variant_selected',
          description: 'User selected a preferred copy draft; no performance winner was claimed',
          metadata: {
            variantGroup: selected.variantGroup,
            selectedVariantId: selected.id,
            discardedVariantId: loser.id,
            draftComparison: draftComparison ? { ...draftComparison } : null,
            performanceClaim: false,
          },
        },
      })
    })

    // ── 5. Deterministic draft comparison → Brand Brain proposal ─────────
    // Compares selected vs discarded draft variants to extract one editorial preference signal.
    // Creates pending proposals the user reviews in BrainLearningPanel.
    // Requires discarded-variant data — only runs if we captured it before deletion.
    let preferenceSignalProposalQueued = false
    if (loser && loser.caption && loser.caption.trim().length > 10) {
      const proposalsCreated = await runBrainLearning({
        workspaceId: campaign.workspaceId,
        campaignId: campaign.id,
        trigger: 'user_selected_variant',
        payload: {
          selectedVariant: {
            caption: selected.caption,
            platform: String(selected.platform),
            variantLabel: selected.variantLabel ?? 'A',
          },
          discardedVariant: {
            caption: loser.caption,
            platform: String(loser.platform),
            variantLabel: loser.variantLabel ?? 'B',
          },
          signalContext: 'User-selected draft variant only. Not analytics-backed performance evidence.',
          draftComparison,
          forbiddenLanguage: ['winner', 'winning', 'best-performing', 'performance winner', 'learned from performance'],
        },
      })
      preferenceSignalProposalQueued = proposalsCreated > 0
    }

    const variantCopy = getBrandBrainLearningCopy('user_variant_pick')

    return NextResponse.json({
      ok: true,
      selectedVariantId: selected.id,
      discardedVariantDeleted: !!loser,
      selectionScope: 'draft_preference',
      draftComparison,
      // Legacy response field kept for compatibility. This route no longer performs a confirmed
      // Brand Brain preference-signal write, so it must remain false.
      preferenceSignalSaved: false,
      preferenceSignalProposalQueued,
      message: preferenceSignalProposalQueued
        ? `${variantCopy.label}; selected variant saved. A preference signal proposal was queued for review; this is not analytics-backed performance learning.`
        : variantCopy.label,
    })
  } catch (err: any) {
    if (err instanceof Error && err.message === 'DRAFT_VARIANT_CONCURRENT_CHANGE') {
      return NextResponse.json({
        error: 'A draft variant changed during selection. Reload and compare the pair again.',
        code: 'DRAFT_VARIANT_CONCURRENT_CHANGE',
      }, { status: 409 })
    }
    console.error('[pick-winner PATCH]', err)
    return NextResponse.json({ error: 'Failed to select variant' }, { status: 500 })
  }
}
