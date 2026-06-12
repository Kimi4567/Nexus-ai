/**
 * POST /api/campaigns/[id]/approve-content-plan
 *
 * Approves all DRAFT posts in a campaign's content plan:
 * - Moves status: DRAFT → SCHEDULED
 * - Assigns integrationId + pageId per platform (FL2A)
 * - Extracts top hooks + content angles → writes to Brand Brain (FLC)
 * - Returns count of approved posts + what Brand Brain learned
 *
 * DELETE /api/campaigns/[id]/approve-content-plan
 * Reverts all SCHEDULED posts (that haven't published yet) back to DRAFT.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { runBrainLearning } from '@/lib/brain-learning'
import { snapshotBrandMaturity } from '@/lib/brandMaturity'

type Params = { params: { id: string } }

/** Merge incoming strings into existing array, dedup, keep last N */
function mergeUnique(existing: string[] | null | undefined, incoming: unknown[], limit = 20): string[] {
  const current = Array.isArray(existing) ? existing : []
  const next = (incoming as any[])
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map(item => item.trim())
  return Array.from(new Set([...current, ...next])).slice(-limit)
}

/** FLC: Call GPT-4o-mini to extract hooks + angles from approved captions */
async function extractBrandLearnings(captions: string[]): Promise<{
  hooks: string[]
  angles: string[]
}> {
  if (!process.env.OPENAI_API_KEY || captions.length === 0) return { hooks: [], angles: [] }

  // Sample up to 10 captions to keep tokens low
  const sample = captions.slice(0, 10)

  const prompt = `Analyze these ${sample.length} social media post captions and extract the most effective content patterns.

Captions:
${sample.map((c, i) => `${i + 1}. ${c.slice(0, 300)}`).join('\n\n')}

Return a JSON object with exactly:
{
  "hooks": ["hook 1", "hook 2", "hook 3"],
  "angles": ["angle 1", "angle 2", "angle 3"]
}

Rules:
- hooks: the 3 most compelling opening lines / sentence starters extracted verbatim or slightly abstracted (e.g. "Did you know that..." or "Most [audience] struggle with...")
- angles: the 3 main content themes/angles used across the captions (e.g. "social proof + results", "pain point agitation", "educational how-to")
- Keep each hook under 15 words
- Keep each angle under 8 words
- Return only the JSON object, no other text`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      }),
    })
    const data = await res.json()
    const raw = JSON.parse(data.choices?.[0]?.message?.content ?? '{}')
    const hooks  = Array.isArray(raw.hooks)  ? raw.hooks.filter((h: any) => typeof h === 'string')  : []
    const angles = Array.isArray(raw.angles) ? raw.angles.filter((a: any) => typeof a === 'string') : []
    return { hooks, angles }
  } catch {
    return { hooks: [], angles: [] }
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Verify campaign ownership
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: userId } },
      select: { id: true, workspaceId: true, name: true },
    })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    // FL2A: Build platform → integration map so the publish cron has credentials
    const connectedIntegrations = await prisma.integration.findMany({
      where: {
        workspaceId: campaign.workspaceId,
        status: 'CONNECTED' as any,
        type: { notIn: ['STRIPE', 'CLOUDINARY', 'GOOGLE', 'SLACK'] as any[] },
      },
      select: { id: true, type: true, config: true, accountId: true },
    })

    const integrationMap: Record<string, { integrationId: string; pageId: string | null }> = {}
    for (const intg of connectedIntegrations) {
      const key = String(intg.type)
      if (integrationMap[key]) continue
      const pages: any[] = (intg.config as any)?.pages ?? []
      const pageId: string | null = pages[0]?.id ?? intg.accountId ?? null
      integrationMap[key] = { integrationId: intg.id, pageId }
    }

    // Load draft posts (include caption for Brand Brain learning)
    const draftPosts = await (prisma.socialPost as any).findMany({
      where: {
        campaignId: params.id,
        workspaceId: campaign.workspaceId,
        status: 'DRAFT',
        publishedAt: null,
      },
      select: { id: true, platform: true, caption: true },
    })

    if (draftPosts.length === 0) {
      return NextResponse.json({ success: true, approved: 0, message: 'No draft posts to approve' })
    }

    // Update each post: DRAFT → SCHEDULED + assign integrationId where available
    let approved = 0
    for (const post of draftPosts) {
      const platformKey = String(post.platform)
      const match = integrationMap[platformKey]

      await (prisma.socialPost as any).update({
        where: { id: post.id },
        data: {
          status: 'SCHEDULED',
          ...(match ? { integrationId: match.integrationId, pageId: match.pageId } : {}),
        },
      })
      approved++
    }

    const linked   = draftPosts.filter((p: any) => !!integrationMap[String(p.platform)]).length
    const unlinked = approved - linked

    // ── FLC: Extract hooks + angles → update Brand Brain (non-blocking) ──────────
    let learnedHooks  = 0
    let learnedAngles = 0

    const captions: string[] = draftPosts
      .map((p: any) => p.caption)
      .filter((c: any): c is string => typeof c === 'string' && c.trim().length > 10)

    if (captions.length > 0) {
      // Fire-and-forget style — we await but catch silently so approval never fails
      const learnings = await extractBrandLearnings(captions).catch(() => ({ hooks: [], angles: [] }))

      if (learnings.hooks.length > 0 || learnings.angles.length > 0) {
        const brand = await prisma.brandProfile.findUnique({
          where: { workspaceId: campaign.workspaceId },
          select: { winningHooks: true, winningAngles: true },
        }).catch(() => null)

        if (brand) {
          const updatedHooks  = mergeUnique(brand.winningHooks,  learnings.hooks,  20)
          const updatedAngles = mergeUnique(brand.winningAngles, learnings.angles, 20)

          await prisma.brandProfile.update({
            where: { workspaceId: campaign.workspaceId },
            data: {
              winningHooks:  updatedHooks,
              winningAngles: updatedAngles,
            },
          }).catch(() => null)
          snapshotBrandMaturity(prisma as any, campaign.workspaceId).catch(() => null)

          learnedHooks  = learnings.hooks.length
          learnedAngles = learnings.angles.length
        }
      }
    }

    // ── BL3: Full Brain Learning via proposal system (non-blocking) ──────────────
    // Runs alongside FLC — creates rich pending proposals (tone, pain points, desires)
    // that the user reviews in BrainLearningPanel (accept/dismiss).
    if (captions.length >= 3) {
      const allPosts = draftPosts
        .filter((p: any) => typeof p.caption === 'string' && p.caption.trim().length > 10)
        .map((p: any) => ({ platform: String(p.platform), caption: p.caption }))

      runBrainLearning({
        workspaceId: campaign.workspaceId,
        campaignId: campaign.id,
        trigger: 'approved_content',
        payload: { posts: allPosts },
      }).catch(() => null) // fire-and-forget — never block approval
    }

    // Build human-readable message
    let message = `${approved} post${approved !== 1 ? 's' : ''} scheduled`
    if (linked > 0)         message += ` (${linked} linked to connected platforms)`
    if (learnedHooks > 0)   message += ` · Brand Brain learned ${learnedHooks} new hooks`
    if (learnedAngles > 0)  message += ` + ${learnedAngles} angles`

    return NextResponse.json({
      success: true,
      approved,
      linked,
      unlinked,
      learned: { hooks: learnedHooks, angles: learnedAngles },
      message,
    })
  } catch (err: any) {
    console.error('[approve-content-plan POST]', err)
    return NextResponse.json({ error: 'Failed to approve content plan' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: userId } },
      select: { id: true, workspaceId: true },
    })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    // Revert SCHEDULED → DRAFT (only unpublished posts)
    const result = await prisma.socialPost.updateMany({
      where: {
        campaignId: params.id,
        workspaceId: campaign.workspaceId,
        status: 'SCHEDULED',
        publishedAt: null,
      },
      data: {
        status: 'DRAFT',
      },
    })

    return NextResponse.json({ success: true, reverted: result.count })
  } catch (err: any) {
    console.error('[approve-content-plan DELETE]', err)
    return NextResponse.json({ error: 'Failed to revert approval' }, { status: 500 })
  }
}
