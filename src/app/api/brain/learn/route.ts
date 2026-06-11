/**
 * POST /api/brain/learn
 *
 * Brain Learning Engine — the core of NEXUS intelligence.
 *
 * Every time something significant happens (strategy generated, content approved),
 * NEXUS analyses the output and proposes specific Brand Brain updates.
 * These proposals are stored in BrainLearning table and shown to the user
 * via the BrainLearningPanel component.
 *
 * Triggers:
 *   - 'strategy'          : After campaign strategy is generated
 *   - 'approved_content'  : After user approves a content plan
 *   - 'post_performance'  : After a post gets engagement data (future)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/apiAuth'
const db = prisma as any  // eslint-disable-line @typescript-eslint/no-explicit-any

// ─── Field definitions — what Brain Brain fields we can learn into ────────────
const LEARNABLE_FIELDS: Record<string, { displayName: string; displayNameAr: string; icon: string; type: 'array' | 'string' }> = {
  winningHooks:      { displayName: 'Winning Hooks',      displayNameAr: 'الخطافات الرابحة',    icon: '🎣', type: 'array'  },
  winningAngles:     { displayName: 'Winning Angles',     displayNameAr: 'الزوايا الرابحة',     icon: '🎯', type: 'array'  },
  toneKeywords:      { displayName: 'Brand Tone',         displayNameAr: 'أسلوب العلامة',       icon: '🎙️', type: 'array'  },
  audiencePainPoints:{ displayName: 'Audience Pain Points',displayNameAr: 'مشاكل الجمهور',      icon: '💢', type: 'array'  },
  audienceDesires:   { displayName: 'Audience Desires',   displayNameAr: 'رغبات الجمهور',       icon: '✨', type: 'array'  },
  uniqueAdvantages:  { displayName: 'Unique Advantages',  displayNameAr: 'المزايا الفريدة',    icon: '🏆', type: 'array'  },
  strategicNotes:    { displayName: 'Strategic Notes',    displayNameAr: 'ملاحظات استراتيجية', icon: '📋', type: 'string' },
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { trigger, campaignId, payload } = body as {
      trigger: 'strategy' | 'approved_content' | 'post_performance'
      campaignId?: string
      payload: Record<string, unknown>
    }

    if (!trigger || !payload) {
      return NextResponse.json({ error: 'Missing trigger or payload' }, { status: 400 })
    }

    // Get workspace
    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
    })
    if (!workspace) return NextResponse.json({ error: 'No workspace found' }, { status: 404 })

    // ── Rate limit: max 25 brain/learn calls per workspace per day ────────────
    // This is a gpt-4o call (~$0.015 each) — cap it to prevent cost runaway.
    // Normal usage: 1-3 per day (strategy + content approval + sentinel).
    // Anything over 25/day is anomalous.
    try {
      const dayStart = new Date()
      dayStart.setHours(0, 0, 0, 0)
      const todayCallCount = await db.brainLearning.count({
        where: {
          workspaceId: workspace.id,
          createdAt: { gte: dayStart },
        },
      })
      if (todayCallCount >= 25) {
        console.warn(`[brain/learn] Rate limit hit for workspace ${workspace.id} — ${todayCallCount} calls today`)
        return NextResponse.json({
          proposals: [],
          message: 'Daily brain learning limit reached — resets at midnight UTC',
        })
      }
    } catch { /* non-fatal — proceed if count fails */ }
    // ─────────────────────────────────────────────────────────────────────────

    // ── Cost log (gpt-4o, max_tokens: 1200, ~$0.015/call) ────────────────────
    console.log(`[brain/learn] COST trigger=${trigger} workspace=${workspace.id} model=gpt-4o estimated=$0.015`)
    // ─────────────────────────────────────────────────────────────────────────

    // Get current Brand Brain
    let brandBrain: Record<string, unknown> | null = null
    try {
      brandBrain = await db.brandProfile.findUnique({ where: { workspaceId: workspace.id } })
    } catch { /* brand profile may not exist yet */ }

    // ── Build the extraction prompt based on trigger ──────────────────────────
    const systemPrompt = `You are a Brand Intelligence Extractor for NEXUS AI.

Your job: analyse AI-generated marketing outputs and extract SPECIFIC, ACTIONABLE learnings
that should be saved to a brand's permanent memory (Brand Brain).

You must ONLY extract concrete, specific insights — not generic marketing advice.
Bad: "Use engaging content" (useless, generic)
Good: "Use questions that challenge conventional wisdom" (specific hook pattern)
Good: "Audience responds to 'before/after transformation' narratives" (specific angle)

Return ONLY a valid JSON array. No prose, no explanation.`

    const currentBrainSummary = brandBrain ? `
CURRENT BRAND BRAIN STATE:
- Brand: ${brandBrain.brandName || 'Unknown'}
- Industry: ${brandBrain.industry || 'Unknown'}
- Winning Hooks (current): ${JSON.stringify(brandBrain.winningHooks || [])}
- Winning Angles (current): ${JSON.stringify(brandBrain.winningAngles || [])}
- Tone Keywords (current): ${JSON.stringify(brandBrain.toneKeywords || [])}
- Audience Pain Points (current): ${JSON.stringify(brandBrain.audiencePainPoints || [])}
- Audience Desires (current): ${JSON.stringify(brandBrain.audienceDesires || [])}
- Unique Advantages (current): ${JSON.stringify(brandBrain.uniqueAdvantages || [])}
- Strategic Notes (current): ${brandBrain.strategicNotes || 'None'}
` : 'CURRENT BRAND BRAIN: Empty — first time learning.'

    let userPrompt = ''

    if (trigger === 'strategy') {
      const strategy = payload.strategy || payload
      userPrompt = `
${currentBrainSummary}

A campaign strategy was just generated for this brand. Extract learnings to update Brand Brain.

STRATEGY OUTPUT:
${JSON.stringify(strategy, null, 2)}

Extract ONLY NEW insights not already in Brand Brain. For each field, propose additions/updates:
- winningHooks: specific hook formulas the strategy identified (e.g. "Use 'Most people don't know...' opener")
- winningAngles: content angles with proven appeal for this audience
- toneKeywords: tone/style words that define this brand's voice
- audiencePainPoints: specific problems/frustrations of this audience
- audienceDesires: specific aspirations/desires of this audience
- uniqueAdvantages: competitive edges this brand has
- strategicNotes: 1-2 sentence strategic insight worth remembering long-term

Return a JSON array of proposals. Each proposal:
{
  "field": "winningHooks",           // one of the 7 field names above
  "proposed": ["hook1", "hook2"],    // NEW values to ADD (for arrays) or replace (for string)
  "reason": "The strategy identified these hook patterns as high-conversion for this audience segment."
}

Rules:
- Only include fields where you found genuinely new, specific insights
- For arrays: proposed = only the NEW items to add (not duplicates)
- For strategicNotes (string): proposed = the full updated text
- Maximum 5 proposals per call
- Skip if nothing meaningful found for a field
- Return [] if nothing new was found
`
    } else if (trigger === 'approved_content') {
      const posts = payload.posts || []
      userPrompt = `
${currentBrainSummary}

The user just approved ${Array.isArray(posts) ? posts.length : 0} social media posts for publishing.
Analyse these posts to extract brand voice patterns and content preferences.

APPROVED POSTS SAMPLE:
${JSON.stringify(Array.isArray(posts) ? posts.slice(0, 10) : posts, null, 2)}

Extract learnings about:
- toneKeywords: tone/style patterns repeated across approved posts (e.g. "uses emoji sparingly", "direct CTA style", "storytelling format")
- winningAngles: content angles/formats that appear in approved posts
- winningHooks: opening lines / hook structures that appear

Return JSON array same format as above. Only extract if you see clear patterns (3+ posts showing the same characteristic).
Return [] if not enough signal.
`
    }

    // ── Call GPT-4o to extract learnings ──────────────────────────────────────
    let proposals: Array<{ field: string; proposed: unknown; reason: string }> = []

    try {
      const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 1200,
          response_format: { type: 'json_object' },
        }),
      })
      const aiData = await aiRes.json() as { choices?: Array<{ message?: { content?: string } }> }

      const raw = aiData.choices?.[0]?.message?.content || '{}'
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        parsed = {}
      }

      // Handle both { proposals: [...] } and direct array
      if (Array.isArray(parsed)) {
        proposals = parsed
      } else if (parsed && typeof parsed === 'object' && 'proposals' in parsed && Array.isArray((parsed as Record<string, unknown>).proposals)) {
        proposals = (parsed as { proposals: Array<{ field: string; proposed: unknown; reason: string }> }).proposals
      }
    } catch (aiErr) {
      console.error('[brain/learn] AI extraction failed:', aiErr)
      return NextResponse.json({ proposals: [], message: 'AI extraction failed' })
    }

    // ── Validate and filter proposals ────────────────────────────────────────
    const validProposals = proposals.filter(p => {
      if (!p.field || !LEARNABLE_FIELDS[p.field]) return false
      if (!p.proposed) return false
      const fieldDef = LEARNABLE_FIELDS[p.field]
      if (fieldDef.type === 'array' && !Array.isArray(p.proposed)) return false
      if (fieldDef.type === 'array' && (p.proposed as unknown[]).length === 0) return false
      if (fieldDef.type === 'string' && typeof p.proposed !== 'string') return false
      return true
    })

    if (validProposals.length === 0) {
      return NextResponse.json({ proposals: [], message: 'No new learnings extracted' })
    }

    // ── Save proposals to BrainLearning table ────────────────────────────────
    const savedProposals = []
    for (const proposal of validProposals) {
      const fieldDef = LEARNABLE_FIELDS[proposal.field]
      const currentVal = brandBrain ? (brandBrain[proposal.field] ?? null) : null

      try {
        const saved = await db.brainLearning.create({
          data: {
            workspaceId: workspace.id,
            campaignId:  campaignId || null,
            trigger,
            field:       proposal.field,
            displayName: fieldDef.displayName,
            icon:        fieldDef.icon,
            current:     currentVal ? JSON.parse(JSON.stringify(currentVal)) : null,
            proposed:    JSON.parse(JSON.stringify(proposal.proposed)),
            reason:      proposal.reason || 'NEXUS identified this as a useful brand insight.',
            status:      'pending',
          },
        })
        savedProposals.push(saved)
      } catch (dbErr) {
        console.error('[brain/learn] Failed to save proposal:', dbErr)
      }
    }

    return NextResponse.json({
      proposals: savedProposals,
      count: savedProposals.length,
      message: `Extracted ${savedProposals.length} learning${savedProposals.length !== 1 ? 's' : ''} from ${trigger}`,
    })
  } catch (error) {
    console.error('[brain/learn] Error:', error)
    return NextResponse.json({ error: 'Brain learning failed' }, { status: 500 })
  }
}
