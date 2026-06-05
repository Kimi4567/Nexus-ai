/**
 * GET /api/cron/agent-monitor
 * Runs daily at 06:00 UTC.
 *
 * Three jobs in one pass:
 * 1. Campaign Manager agent — checks all active workspaces, creates AgentSuggestion records
 * 2. Brand Brain post-performance learning (FLP) — for any posts published in the last 48 h,
 *    extract hooks + content angles from their captions and merge into the workspace's
 *    Brand Brain (BrandProfile.winningHooks / winningAngles).
 *    Note: once we have real Meta/LinkedIn engagement data we'll gate this on above-average
 *    engagement; for now we learn from every published post.
 * 3. Weekly reports — Mondays only
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runCampaignMonitor, runReport } from '@/lib/agents/orchestrator'

export const dynamic = 'force-dynamic'

// ── Brand Brain helpers (mirrors approve-content-plan) ────────────────────────

/** Merge incoming strings into existing array, dedup, keep last N */
function mergeUnique(existing: string[] | null | undefined, incoming: string[], limit = 20): string[] {
  const current = Array.isArray(existing) ? existing : []
  const next = incoming.filter(s => typeof s === 'string' && s.trim().length > 0).map(s => s.trim())
  return Array.from(new Set([...current, ...next])).slice(-limit)
}

/** Call GPT-4o-mini to extract top hooks + angles from a batch of post captions */
async function extractLearningsFromCaptions(captions: string[]): Promise<{ hooks: string[]; angles: string[] }> {
  if (!process.env.OPENAI_API_KEY || captions.length === 0) return { hooks: [], angles: [] }

  const sample = captions.slice(0, 12)
  const prompt = `Analyze these ${sample.length} published social media post captions and extract the most effective content patterns.

Captions:
${sample.map((c, i) => `${i + 1}. ${c.slice(0, 300)}`).join('\n\n')}

Return a JSON object with exactly:
{
  "hooks": ["hook 1", "hook 2", "hook 3"],
  "angles": ["angle 1", "angle 2", "angle 3"]
}

Rules:
- hooks: the 3 most compelling opening lines / sentence starters extracted verbatim or slightly abstracted
- angles: the 3 main content themes/angles used across the captions (e.g. "social proof + results")
- Keep each hook under 15 words, each angle under 8 words
- Return only the JSON object`

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
    return {
      hooks:  Array.isArray(raw.hooks)  ? raw.hooks.filter((h: any) => typeof h === 'string')  : [],
      angles: Array.isArray(raw.angles) ? raw.angles.filter((a: any) => typeof a === 'string') : [],
    }
  } catch {
    return { hooks: [], angles: [] }
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Verify cron secret — matches Vercel's Authorization: Bearer <CRON_SECRET> format
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret && process.env.NODE_ENV !== 'development') { return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 }) }
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = {
    workspacesChecked: 0,
    campaignsChecked: 0,
    suggestionsCreated: 0,
    reportsCreated: 0,
    brandBrainLearned: { workspaces: 0, hooks: 0, angles: 0 },
    errors: [] as string[],
  }

  // Get all workspaces that have at least one campaign
  const workspaces = await prisma.workspace.findMany({
    where: {
      campaigns: { some: { status: { in: ['ACTIVE', 'DRAFT'] } } },
    },
    select: { id: true },
  })

  results.workspacesChecked = workspaces.length

  // ── Job 1: Campaign monitor ──────────────────────────────────────────────────
  for (const ws of workspaces) {
    try {
      const monitorResult = await runCampaignMonitor(ws.id)
      results.campaignsChecked += monitorResult.campaignsChecked
      results.suggestionsCreated += monitorResult.suggestionsCreated
      results.errors.push(...monitorResult.errors)
    } catch (err: any) {
      results.errors.push(`Workspace ${ws.id}: ${err?.message}`)
    }
  }

  // ── Job 2: Brand Brain post-performance learning (FLP) ───────────────────────
  // Find all posts published in the last 48 hours across all workspaces.
  // Group by workspace → extract hooks/angles → merge into Brand Brain.
  try {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000)

    const recentPosts = await (prisma.socialPost as any).findMany({
      where: {
        status: 'PUBLISHED',
        publishedAt: { gte: since },
        caption: { not: null },
        autoGenerated: true,  // Only learn from AI-generated content
      },
      select: { workspaceId: true, caption: true },
    }) as Array<{ workspaceId: string; caption: string }>

    // Group captions by workspace
    const byWorkspace = new Map<string, string[]>()
    for (const post of recentPosts) {
      if (!post.caption || post.caption.trim().length < 20) continue
      const arr = byWorkspace.get(post.workspaceId) ?? []
      arr.push(post.caption)
      byWorkspace.set(post.workspaceId, arr)
    }

    for (const [workspaceId, captions] of byWorkspace.entries()) {
      try {
        const learnings = await extractLearningsFromCaptions(captions)
        if (learnings.hooks.length === 0 && learnings.angles.length === 0) continue

        const brand = await prisma.brandProfile.findUnique({
          where: { workspaceId },
          select: { winningHooks: true, winningAngles: true },
        })
        if (!brand) continue

        await prisma.brandProfile.update({
          where: { workspaceId },
          data: {
            winningHooks:  mergeUnique(brand.winningHooks,  learnings.hooks,  25),
            winningAngles: mergeUnique(brand.winningAngles, learnings.angles, 25),
          },
        })

        results.brandBrainLearned.workspaces++
        results.brandBrainLearned.hooks  += learnings.hooks.length
        results.brandBrainLearned.angles += learnings.angles.length
      } catch (err: any) {
        results.errors.push(`BrandBrain ${workspaceId}: ${err?.message}`)
      }
    }
  } catch (err: any) {
    results.errors.push(`FLP scan: ${err?.message}`)
  }

  // ── Job 3: Weekly reports (Mondays only) ─────────────────────────────────────
  const isMonday = new Date().getDay() === 1
  if (isMonday) {
    for (const ws of workspaces) {
      try {
        await runReport(ws.id, 'weekly')
        results.reportsCreated++
      } catch (err: any) {
        results.errors.push(`Report ${ws.id}: ${err?.message}`)
      }
    }
  }

  return NextResponse.json({
    ok: true,
    ...results,
    ts: new Date().toISOString(),
  })
}
