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
 *  5. Feed the winner's opening hook into Brand Brain (winningHooks)
 *
 * Returns: { ok: true, winnerId, loserDeleted, hookLearned }
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { runBrainLearning } from '@/lib/brain-learning'
import { snapshotBrandMaturity } from '@/lib/brandMaturity'

type Params = { params: { id: string; postId: string } }

/** Extract the opening hook (first sentence or ≤120 chars) from a caption */
function extractHook(caption: string): string {
  const first = caption.split(/[.!?\n]/)[0]?.trim() ?? ''
  return first.slice(0, 120)
}

/** Merge incoming strings into existing array, dedup, keep last N */
function mergeUnique(existing: string[] | null | undefined, incoming: string[], limit = 25): string[] {
  const current = Array.isArray(existing) ? existing : []
  const next = incoming.filter(s => typeof s === 'string' && s.trim().length > 15)
  return Array.from(new Set([...current, ...next])).slice(-limit)
}

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

    // ── 4. Mark winner + delete loser in parallel ────────────────────────
    const [, deleteResult] = await Promise.all([
      (prisma.socialPost as any).update({
        where: { id: winner.id },
        data: {
          variantWinner: true,
          variantGroup: null, // clear group — it's no longer part of an active A/B test
        },
      }),
      loser
        ? (prisma.socialPost as any).delete({ where: { id: loser.id } })
        : Promise.resolve(null),
    ])

    // ── 5. Fast path: feed winner hook into Brand Brain directly ────────────
    // Silent, always runs — keeps Brand Brain current even if user never reviews proposals.
    let hookLearned = false
    try {
      const hook = extractHook(winner.caption)
      if (hook.length > 15) {
        const brand = await prisma.brandProfile.findUnique({
          where: { workspaceId: campaign.workspaceId },
          select: { winningHooks: true },
        })
        if (brand) {
          await prisma.brandProfile.update({
            where: { workspaceId: campaign.workspaceId },
            data: {
              winningHooks: mergeUnique(brand.winningHooks, [hook], 25),
            },
          })
          snapshotBrandMaturity(prisma as any, campaign.workspaceId).catch(() => null)
          hookLearned = true
        }
      }
    } catch (brandErr) {
      console.warn('[pick-winner] Brand Brain fast-path update failed:', brandErr)
    }

    // ── 6. Rich path: GPT-4o A/B analysis → Brain Brain proposals ──────────
    // Compares winner vs loser to extract WHY the winner resonated.
    // Creates pending proposals the user reviews in BrainLearningPanel.
    // Requires loser data — only runs if we captured it before deletion.
    if (loser && loser.caption && loser.caption.trim().length > 10) {
      runBrainLearning({
        workspaceId: campaign.workspaceId,
        campaignId: campaign.id,
        trigger: 'ab_winner',
        payload: {
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
      }).catch(() => null) // fire-and-forget — never block the pick action
    }

    return NextResponse.json({
      ok: true,
      winnerId: winner.id,
      loserDeleted: !!loser,
      hookLearned,
    })
  } catch (err: any) {
    console.error('[pick-winner PATCH]', err)
    return NextResponse.json({ error: 'Failed to pick winner' }, { status: 500 })
  }
}
