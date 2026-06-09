/**
 * Brain Learning — server-side helper
 *
 * Called directly from server-side code (campaign engine, approve-content-plan, etc.)
 * to extract learnings and persist them as BrainLearning proposals.
 *
 * Uses GPT-4o to analyse AI outputs and propose specific Brand Brain field updates.
 * Proposals are stored in DB and surfaced to the user via BrainLearningPanel.
 */

import { prisma } from '@/lib/prisma'

async function callOpenAI(messages: Array<{ role: string; content: string }>, maxTokens = 800): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages,
      temperature: 0.25,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  })
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
  return data.choices?.[0]?.message?.content || '{}'
}
const db = prisma as any // eslint-disable-line @typescript-eslint/no-explicit-any

const ARRAY_FIELDS = new Set([
  'winningHooks', 'winningAngles', 'toneKeywords',
  'audiencePainPoints', 'audienceDesires', 'uniqueAdvantages',
])

const FIELD_META: Record<string, { displayName: string; icon: string }> = {
  winningHooks:       { displayName: 'Winning Hooks',       icon: '🎣' },
  winningAngles:      { displayName: 'Winning Angles',      icon: '🎯' },
  toneKeywords:       { displayName: 'Brand Tone',          icon: '🎙️' },
  audiencePainPoints: { displayName: 'Audience Pain Points',icon: '💢' },
  audienceDesires:    { displayName: 'Audience Desires',    icon: '✨' },
  uniqueAdvantages:   { displayName: 'Unique Advantages',   icon: '🏆' },
  strategicNotes:     { displayName: 'Strategic Notes',     icon: '📋' },
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface BrainLearningParams {
  workspaceId: string
  campaignId?: string
  trigger: 'strategy' | 'approved_content' | 'post_performance'
  payload: Record<string, unknown>
}

interface Proposal {
  field: string
  proposed: unknown
  reason: string
}

// ─── Main function ─────────────────────────────────────────────────────────────

export async function runBrainLearning(params: BrainLearningParams): Promise<number> {
  const { workspaceId, campaignId, trigger, payload } = params

  try {
    // Get current Brand Brain
    let brandBrain: Record<string, unknown> | null = null
    try {
      brandBrain = await db.brandProfile.findUnique({ where: { workspaceId } })
    } catch { /* may not exist */ }

    const brainSummary = brandBrain ? `
Current Brand Brain:
- Winning Hooks (${(brandBrain.winningHooks as string[] || []).length}): ${JSON.stringify((brandBrain.winningHooks as string[] || []).slice(0, 3))}
- Winning Angles (${(brandBrain.winningAngles as string[] || []).length}): ${JSON.stringify((brandBrain.winningAngles as string[] || []).slice(0, 3))}
- Tone Keywords: ${JSON.stringify(brandBrain.toneKeywords || [])}
- Pain Points: ${JSON.stringify((brandBrain.audiencePainPoints as string[] || []).slice(0, 3))}
- Unique Advantages: ${JSON.stringify((brandBrain.uniqueAdvantages as string[] || []).slice(0, 3))}
- Strategic Notes: ${String(brandBrain.strategicNotes || '').slice(0, 200)}
` : 'Brand Brain: Empty (first learning)'

    // Build prompt based on trigger
    let extractionContext = ''
    if (trigger === 'strategy') {
      const strategy = payload.strategy || payload
      extractionContext = `
A new campaign strategy was generated. Extract specific, actionable Brand Brain learnings.

STRATEGY:
${JSON.stringify(strategy, null, 2).slice(0, 4000)}

${brainSummary}

Extract ONLY new, specific insights NOT already in Brand Brain.
Fields you can update: winningHooks, winningAngles, toneKeywords, audiencePainPoints, audienceDesires, uniqueAdvantages, strategicNotes
`
    } else if (trigger === 'approved_content') {
      const posts = Array.isArray(payload.posts) ? payload.posts : []
      extractionContext = `
The user approved ${posts.length} social media posts. Analyse them for brand voice patterns.

APPROVED POSTS:
${JSON.stringify(posts.slice(0, 8), null, 2).slice(0, 3000)}

${brainSummary}

Extract patterns from these approved posts:
- toneKeywords: voice/style patterns appearing in 3+ posts
- winningAngles: content formats/approaches that appear repeatedly
- winningHooks: opening line structures used
`
    }

    const raw = await callOpenAI([
      {
        role: 'system',
        content: `You are a Brand Intelligence Extractor. Extract specific, concrete learnings from marketing outputs to update a brand's permanent memory.

Return ONLY a JSON object: { "proposals": [{field, proposed, reason}] }

Rules:
- Be specific, never generic ("use engaging content" = BAD)
- proposed must be array for array fields (winningHooks etc.) or string for strategicNotes
- Only include NEW insights not already captured
- Maximum 4 proposals
- proposed arrays should contain only the NEW items to add, not duplicates of what's already there`,
      },
      { role: 'user', content: extractionContext },
    ])

    let parsed: { proposals?: Proposal[] } = {}
    try { parsed = JSON.parse(raw) } catch { /* ignore */ }

    const proposals: Proposal[] = Array.isArray(parsed.proposals) ? parsed.proposals : []

    // Validate and save
    let saved = 0
    for (const p of proposals) {
      if (!p.field || !FIELD_META[p.field]) continue
      if (!p.proposed) continue
      if (ARRAY_FIELDS.has(p.field) && (!Array.isArray(p.proposed) || p.proposed.length === 0)) continue

      const current = brandBrain?.[p.field] ?? null

      try {
        await db.brainLearning.create({
          data: {
            workspaceId,
            campaignId: campaignId || null,
            trigger,
            field: p.field,
            displayName: FIELD_META[p.field].displayName,
            icon: FIELD_META[p.field].icon,
            current: current ? JSON.parse(JSON.stringify(current)) : null,
            proposed: JSON.parse(JSON.stringify(p.proposed)),
            reason: p.reason || 'NEXUS identified this as a useful brand insight.',
            status: 'pending',
          },
        })
        saved++
      } catch (dbErr) {
        console.error('[brain-learning] save failed:', dbErr)
      }
    }

    return saved
  } catch (err) {
    console.error('[brain-learning] runBrainLearning error:', err)
    return 0
  }
}
