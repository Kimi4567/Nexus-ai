/**
 * Brain Learning — server-side helper
 *
 * Called directly from server-side code (campaign engine, approve-content-plan, etc.)
 * to extract signals and persist them as BrainLearning proposals.
 *
 * Uses GPT-4o to analyse AI outputs and propose specific Brand Brain field updates for review.
 * Proposals are stored in DB and surfaced to the user via BrainLearningPanel.
 *
 * ⚠️  COST TRACKING NOTE (not user-billed):
 * Brain learning calls are background system operations — not charged to user credits.
 * Each call uses gpt-4o with max_tokens=800 output.
 * Estimated cost per call: ~$0.013–$0.020 (gpt-4o @ $2.50/M in, $10/M out)
 * At scale (1,000 users × 5 triggers/day): ~$65-$100/day in uncovered COGS.
 *
 * Search Vercel logs for "[brain-learning] COST" to monitor background spend.
 * If monthly uncovered cost exceeds $500, consider:
 *   1. Rate-limiting triggers per workspace per day
 *   2. Switching to gpt-4o-mini for lower-signal triggers (approved_content, user_selected_variant)
 *   3. Adding a system-level credit pool for background AI operations
 */

import { prisma } from '@/lib/prisma'
import { brainLearningCapDb, BRAIN_LEARNING_DAILY_CAP } from '@/lib/dbRateLimit'

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
  winningHooks:       { displayName: 'Hook Signals',          icon: '🎣' },
  winningAngles:      { displayName: 'Content Angle Signals', icon: '🎯' },
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
  trigger: 'strategy' | 'approved_content' | 'post_performance' | 'ab_winner' | 'user_selected_variant' | 'sentinel_insight' | 'competitor_monitor' | 'industry_trend'
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
  const startMs = Date.now()

  // ── COGS guard: daily per-workspace cap ──────────────────────────────────────
  // Background learning is NOT billed to user credits, so it's uncovered cost.
  // Enforce a daily cap per workspace so a busy/abusive workspace can't run
  // unbounded gpt-4o spend. Fail-open (allow) only if the limiter itself errors.
  try {
    const cap = await brainLearningCapDb(workspaceId)
    if (!cap.ok) {
      console.warn(
        `[brain-learning] SKIP trigger=${trigger} workspace=${workspaceId} reason=daily_cap_reached ` +
        `cap=${BRAIN_LEARNING_DAILY_CAP} resetAt=${new Date(cap.resetAt).toISOString()}`,
      )
      return 0
    }
  } catch (capErr) {
    console.warn('[brain-learning] cap check failed (allowing, non-fatal):', (capErr as Error).message)
  }

  // ── Cost tracking (non-blocking) ─────────────────────────────────────────────
  // These calls are background system operations — not billed to user credits.
  // Log estimated cost to Vercel for operational monitoring at scale.
  // Estimated: $0.013–$0.020 per call (gpt-4o, ~2–4k input + ~800 output tokens).
  // Search logs for "[brain-learning] COST" to total background spend.
  console.log(`[brain-learning] COST trigger=${trigger} workspace=${workspaceId} estimated=$0.015`)
  // ─────────────────────────────────────────────────────────────────────────────

  try {
    // Get current Brand Brain
    let brandBrain: Record<string, unknown> | null = null
    try {
      brandBrain = await db.brandProfile.findUnique({ where: { workspaceId } })
    } catch { /* may not exist */ }

    const brainSummary = brandBrain ? `
Current Brand Brain:
- Hook Signals (${(brandBrain.winningHooks as string[] || []).length}): ${JSON.stringify((brandBrain.winningHooks as string[] || []).slice(0, 3))}
- Content Angle Signals (${(brandBrain.winningAngles as string[] || []).length}): ${JSON.stringify((brandBrain.winningAngles as string[] || []).slice(0, 3))}
- Tone Keywords: ${JSON.stringify(brandBrain.toneKeywords || [])}
- Pain Points: ${JSON.stringify((brandBrain.audiencePainPoints as string[] || []).slice(0, 3))}
- Unique Advantages: ${JSON.stringify((brandBrain.uniqueAdvantages as string[] || []).slice(0, 3))}
- Strategic Notes: ${String(brandBrain.strategicNotes || '').slice(0, 200)}
` : 'Brand Brain: Empty (first signal review)'

    // Build prompt based on trigger
    let extractionContext = ''
    if (trigger === 'strategy') {
      const strategy = payload.strategy || payload
      extractionContext = `
A new campaign strategy was generated. Extract specific, actionable Brand Brain review signals.
This is strategy-derived planning context only. It is not analytics-backed learning or performance evidence.

STRATEGY:
${JSON.stringify(strategy, null, 2).slice(0, 4000)}

${brainSummary}

Extract ONLY new, specific signals NOT already in Brand Brain.
Fields you can propose updates for: winningHooks (legacy storage for reviewed hook signals), winningAngles (legacy storage for reviewed content-angle signals), toneKeywords, audiencePainPoints, audienceDesires, uniqueAdvantages, strategicNotes
Do not call strategy-derived signals winning, proven, high-conversion, best-performing, or learned from performance.
`
    } else if (trigger === 'approved_content') {
      const posts = Array.isArray(payload.posts) ? payload.posts : []
      extractionContext = `
The user approved ${posts.length} social media posts. Analyse them for brand voice patterns.

APPROVED POSTS:
${JSON.stringify(posts.slice(0, 8), null, 2).slice(0, 3000)}

${brainSummary}

Extract review-signal patterns from these approved posts:
- toneKeywords: voice/style patterns appearing in 3+ posts
- winningAngles: legacy schema field for content-angle review signals that appear repeatedly
- winningHooks: legacy schema field for reviewed opening-line structures

Rules:
- Approval is a workflow/review signal, not analytics-backed learning.
- Do not call approved-content patterns winning, proven, high-conversion, best-performing, or learned from performance.
`
    } else if (trigger === 'post_performance') {
      // Real engagement data from Meta/LinkedIn — this is the richest signal
      const posts = Array.isArray(payload.posts) ? payload.posts : []
      const avgRate = typeof payload.avgEngagementRate === 'number'
        ? payload.avgEngagementRate.toFixed(2)
        : null
      const threshold = typeof payload.threshold === 'number'
        ? payload.threshold.toFixed(2)
        : null

      const aboveAvgPosts = posts.filter(
        (p: any) => p.performance === 'above_average',
      )
      const avgPosts = posts.filter(
        (p: any) => p.performance !== 'above_average',
      )

      extractionContext = `
Real performance data for ${posts.length} published posts.
${avgRate ? `Workspace average engagement rate: ${avgRate}%` : ''}
${threshold ? `Above-average threshold: ${threshold}% (posts beating 1.2× the average)` : ''}

ABOVE-AVERAGE POSTS (${aboveAvgPosts.length} posts that outperformed the workspace average):
${JSON.stringify(aboveAvgPosts.slice(0, 8), null, 2).slice(0, 3000)}

AVERAGE POSTS (for contrast — what didn't outperform):
${JSON.stringify(avgPosts.slice(0, 4), null, 2).slice(0, 1500)}

${brainSummary}

Analyse WHY the above-average posts outperformed. What made them resonate with the audience?
Compare them to the average posts — what's different?

Extract specific, evidence-backed learnings:
- winningHooks: exact hook patterns or opening structures from high-performing posts (e.g. "Posts opening with a bold claim outperform — use 'X people don't know...' style")
- winningAngles: content angles/themes that correlated with above-average engagement
- toneKeywords: voice/style traits present in top posts but absent in average ones
- audiencePainPoints: pain points that the top posts addressed (that drove strong engagement)
- audienceDesires: aspirations or desires that top posts tapped into
- strategicNotes: 1-2 sentence strategic insight about what drives performance for this brand/audience

CRITICAL:
- Only extract insights grounded in the actual post data above
- Be specific — quote or closely paraphrase from the actual captions
- No generic advice like "use engaging content" — every insight must trace to a specific post
- If fewer than 3 above-average posts exist, return [] (not enough signal)
`
    } else if (trigger === 'sentinel_insight') {
      // Sentinel just reviewed the campaign against the competitive landscape.
      // Extract positioning gaps + strategic opportunities for Brand Brain.
      const review = payload.sentinelReview as Record<string, unknown> | undefined
      const competitors = Array.isArray(payload.competitors) ? payload.competitors : []

      if (!review) return 0

      extractionContext = `
Sentinel (competitive intelligence agent) just reviewed a campaign against the market landscape.

SENTINEL REVIEW FINDINGS:
Risk Score: ${review.riskScore ?? 'N/A'}/100
Brand Consistency Score: ${review.brandConsistencyScore ?? 'N/A'}/100
Status: ${review.status ?? 'N/A'}

Recommended Fixes:
${JSON.stringify(review.recommendedFixes ?? [], null, 2).slice(0, 1500)}

Strategic Opportunities Identified:
${JSON.stringify(review.strategicOpportunities ?? review.opportunities ?? [], null, 2).slice(0, 1500)}

Risk Notes:
${JSON.stringify(review.riskNotes ?? [], null, 2).slice(0, 800)}

${competitors.length > 0 ? `Known Competitors: ${competitors.join(', ')}` : ''}

${brainSummary}

From the Sentinel findings, extract Brand Brain review signals:
- uniqueAdvantages: competitive edges the review highlighted that should be in Brand Brain
- winningAngles: legacy schema field for positioning-angle signals the review validated or recommended
- audiencePainPoints: pain points the review flagged as underserved by competitors
- strategicNotes: 1-2 sentence strategic insight about competitive positioning
- failingAngles: approaches the review flagged as risky or overdone in the market (to avoid)

IMPORTANT: Only extract if Sentinel identified something genuinely new vs current Brand Brain.
If the review was mostly positive (status: passed), focus on the validated strengths.
If flagged issues, focus on what to change/avoid.
`
    } else if (trigger === 'competitor_monitor') {
      // Daily cron found recent news/content from competitors.
      // Extract market intelligence signals for Brand Brain.
      const competitors = Array.isArray(payload.competitors) ? payload.competitors : []
      const findings = Array.isArray(payload.findings) ? payload.findings : []

      if (findings.length === 0) return 0

      extractionContext = `
Daily competitor monitoring found recent activity from competitors.
Monitored competitors: ${competitors.join(', ')}

RECENT COMPETITOR ACTIVITY (last 24-48h):
${JSON.stringify(findings.slice(0, 12), null, 2).slice(0, 4000)}

${brainSummary}

Analyze the competitor activity and extract Brand Brain market-intelligence signals:
- winningAngles: legacy schema field for content angles or messaging approaches competitors are using —
  that this brand should adopt or respond to
- audiencePainPoints: problems competitors are addressing that this brand should also address
- uniqueAdvantages: gaps in competitor messaging where this brand has an advantage
- strategicNotes: 1-2 sentence insight about what the competitive landscape reveals this week

RULES:
- Focus on ACTIONABLE intelligence, not just "competitor posted about X"
- If competitors are all doing the same thing, that is a market saturation signal — note it
- If a competitor announced something new (product, feature, promotion), that is HIGH signal
- Return [] if competitor activity is too generic to produce meaningful learnings
`
    } else if (trigger === 'industry_trend') {
      // Weekly industry trend scan: what's trending in the brand's sector?
      // Extract positioning opportunities + audience pain shifts for Brand Brain.
      const industry = payload.industry as string | undefined
      const trendFindings = Array.isArray(payload.findings) ? payload.findings : []

      if (trendFindings.length === 0) return 0

      extractionContext = `
Weekly industry trend monitoring for the brand's sector: "${industry || 'General Marketing'}".

TRENDING TOPICS & NEWS IN THIS INDUSTRY (last 7 days):
${JSON.stringify(trendFindings.slice(0, 15), null, 2).slice(0, 4000)}

${brainSummary}

Analyze the industry trends and extract Brand Brain market-intelligence signals:
- audiencePainPoints: new pain points emerging in this industry that the audience is experiencing
- audienceDesires: new aspirations or desires surfacing in this sector
- winningAngles: legacy schema field for content angles that are trending in this industry right now
- uniqueAdvantages: market gaps or underserved needs this brand could address
- strategicNotes: 1-2 sentence insight about where this industry is heading this week

RULES:
- Focus on SIGNALS, not noise — trending topics that suggest audience behavior shifts
- If a trend is a major industry movement (new regulation, major product launch, consumer shift), that is HIGH signal
- Return [] if industry trends are too generic to produce meaningful learnings
- Be specific: reference actual topics from the findings, not generic marketing advice
`
    } else if (trigger === 'ab_winner' || trigger === 'user_selected_variant') {
      // User manually chose between two draft variants. This is an editorial
      // preference signal, not analytics-backed performance evidence.
      const selectedVariant =
        (payload.selectedVariant as { caption: string; platform: string; variantLabel?: string } | undefined) ??
        (payload.winner as { caption: string; platform: string; variantLabel?: string } | undefined)
      const discardedVariant =
        (payload.discardedVariant as { caption: string; platform: string; variantLabel?: string } | undefined) ??
        (payload.loser as { caption: string; platform: string; variantLabel?: string } | undefined)

      if (!selectedVariant || !discardedVariant) {
        return 0 // nothing to propose without both sides
      }

      extractionContext = `
The user compared two draft variants of a social media post and selected one preferred draft.
This is a USER PREFERENCE SIGNAL only. It is not analytics-backed learning and not performance evidence.

SELECTED DRAFT VARIANT (chosen by user):
Platform: ${selectedVariant.platform}
Variant: ${selectedVariant.variantLabel || 'A'}
Caption:
"${selectedVariant.caption.slice(0, 600)}"

DISCARDED DRAFT VARIANT:
Platform: ${discardedVariant.platform}
Variant: ${discardedVariant.variantLabel || 'B'}
Caption:
"${discardedVariant.caption.slice(0, 600)}"

${brainSummary}

Analyze WHY the user preferred the selected draft over the discarded draft.
What is SPECIFICALLY different between them?

Compare: opening hook, content angle, tone/voice, length, structure, emotional appeal, CTA style.

Extract concrete preference-signal proposals:
- winningHooks: legacy schema field for hook preference signals from the selected draft. Do not write "winning hook" in proposed text or reason.
- winningAngles: legacy schema field for content-angle preference signals from the selected draft. Do not write "winning angle" in proposed text or reason.
- toneKeywords: tone/style traits present in the selected draft but absent or weaker in the discarded draft
- strategicNotes: 1-sentence editorial preference signal about what the selected draft suggests for future review

RULES:
- Be hyper-specific — reference the actual text of the captions
- The discarded draft is equally important: note what the selected draft avoided that the discarded draft used
- Do not use winner, winning, loser, best-performing, performance winner, proven, or learned-from-performance language
- Use selected draft, discarded draft, preference signal, user-selected variant, and editorial choice language
- Only analytics-backed post performance may use learning/winning/performance evidence language
- Maximum 3 proposals — quality over quantity
- If the difference is trivial (just emoji or punctuation), return []
`
    }

    const raw = await callOpenAI([
      {
        role: 'system',
        content: `You are a Brand Intelligence Extractor. Extract specific, concrete Brand Brain signals from marketing outputs for review.

Return ONLY a JSON object: { "proposals": [{field, proposed, reason}] }

Rules:
- Be specific, never generic ("use engaging content" = BAD)
- proposed must be array for array fields (winningHooks is a legacy storage field for reviewed hook signals) or string for strategicNotes
- Only include NEW signals not already captured
- Maximum 4 proposals
- proposed arrays should contain only the NEW items to add, not duplicates of what's already there
- Non-analytics triggers are review signals only; do not use winner, winning, proven, high-conversion, best-performing, or learned-from-performance language unless the trigger is post_performance with real analytics data.`,
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

    const durationMs = Date.now() - startMs
    console.log(`[brain-learning] COST trigger=${trigger} workspace=${workspaceId} proposals=${saved} duration=${durationMs}ms`)

    return saved
  } catch (err) {
    console.error('[brain-learning] runBrainLearning error:', err)
    return 0
  }
}
