/**
 * PATCH /api/campaigns/[id]/content-plan/[postId]/pick-winner
 *
 * FL2-E: A/B Testing — select the preferred draft variant.
 *
 * Actions:
 *  1. Verify ownership + that postId belongs to this campaign
 *  2. Look up the variantGroup of the selected post
 *  3. Mark the selected post: variantWinner = true (legacy field name)
 *  4. Delete the losing sibling variant (same variantGroup, different id)
 *  5. Queue user preference signal proposals for review. This is not analytics-backed learning.
 *
 * Returns: { ok: true, selectedVariantId, discardedVariantDeleted, preferenceSignalSaved }
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { runBrainLearning } from '@/lib/brain-learning'
import { getBrandBrainLearningCopy } from '@/lib/brandBrainLearningContract'

type Params = { params: { id: string; postId: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // ── 1. Verify campaign ownership ─────────────────────────────────────
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: userId } },
      select: { id: true, workspaceId: true },
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
      },
    }) as {
      id: string
      caption: string
      platform: string
      variantGroup: string | null
      variantLabel: string | null
      variantWinner: boolean
    } | null

    if (!selected) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    if (!selected.variantGroup) {
      return NextResponse.json({ error: 'This post is not part of an A/B test' }, { status: 400 })
    }

    // ── 3. Find the losing sibling (fetch full details BEFORE deletion) ─────
    const loser = await (prisma.socialPost as any).findFirst({
      where: {
        variantGroup: selected.variantGroup,
        campaignId: params.id,
        workspaceId: campaign.workspaceId,
        id: { not: selected.id },
      },
      select: { id: true, caption: true, platform: true, variantLabel: true },
    }) as { id: string; caption: string; platform: string; variantLabel: string | null } | null

    // ── 4. Mark selected variant + delete discarded variant in parallel ───
    const [, deleteResult] = await Promise.all([
      (prisma.socialPost as any).update({
        where: { id: selected.id },
        data: {
          variantWinner: true,
          variantGroup: null, // clear group — it's no longer part of an active A/B test
        },
      }),
      loser
        ? (prisma.socialPost as any).delete({ where: { id: loser.id } })
        : Promise.resolve(null),
    ])

    // ── 5. GPT-4o A/B analysis → Brand Brain proposals ───────────────────
    // Compares selected vs discarded draft variants to extract editorial preference signals.
    // Creates pending proposals the user reviews in BrainLearningPanel.
    // Requires discarded-variant data — only runs if we captured it before deletion.
    let preferenceSignalSaved = false
    if (loser && loser.caption && loser.caption.trim().length > 10) {
      runBrainLearning({
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
          forbiddenLanguage: ['winner', 'winning', 'best-performing', 'performance winner', 'learned from performance'],
        },
      }).catch(() => null) // fire-and-forget — never block the pick action
      preferenceSignalSaved = true
    }

    const variantCopy = getBrandBrainLearningCopy('user_variant_pick')

    return NextResponse.json({
      ok: true,
      selectedVariantId: selected.id,
      discardedVariantDeleted: !!loser,
      preferenceSignalSaved,
      message: preferenceSignalSaved
        ? `${variantCopy.label}; selected variant saved as a user preference signal, not analytics-backed performance learning`
        : variantCopy.label,
    })
  } catch (err: any) {
    console.error('[pick-winner PATCH]', err)
    return NextResponse.json({ error: 'Failed to select variant' }, { status: 500 })
  }
}
