/**
 * Sentinel Review — Campaign Readiness & Risk Assessment
 *
 * Sprint G — Sentinel Review Gate
 *
 * Reads the full campaign package (strategy, content, hooks, CTAs, calendar,
 * creative brief, brand brain) and produces a structured risk + readiness report.
 *
 * Internally powered by the Sentinel system. Positioned in the product
 * as part of the campaign preparation flow, not a separate agent.
 *
 * Model: gpt-4o (NOT gpt-4o-mini — full reasoning is required for quality + risk analysis)
 * Credit: SENTINEL_REVIEW (2 credits) via /api/campaigns/[id]/sentinel-review
 * max_tokens: 2,000 | API cost: ~$0.025 (gpt-4o @ $2.50/M in, $10/M out)
 * Margin @ Agency ($0.396 revenue): ~94%
 */

import { getLanguageInstruction } from '@/lib/ai/langHelper'
import { checkAndLog } from '@/lib/outputGuardrails'
import { detectUnsupportedClaims, buildClaimWarnings, claimCategoryLabel } from '@/lib/ai/claimGuard'

// ─── Input ────────────────────────────────────────────────────────────────────

export interface SentinelReviewInput {
  campaignName: string
  campaignGoal?: string
  audience?: string
  tone?: string
  language?: string
  brand?: {
    name?: string
    businessType?: string
    toneKeywords?: string[]
    avoidKeywords?: string[]
    writingStyle?: string
    targetAudience?: string
    pricePoint?: string
  }
  strategy?: {
    positioning?: string
    keyMessage?: string
    differentiation?: string
    riskNotes?: string[]
    diagnosis?: string
    offerCTAStrategy?: any
    // Sprint M operational fields
    doNotDoYet?: string[]
    readinessChecklist?: any[]
    adSetupPlan?: any
    funnelStages?: any[]
    contentAnglesDetailed?: any[]
    weeklyExecutionPlan?: any[]
    executionAssumptions?: string[]
    assumptions?: string[]
  }
  content?: {
    topHooks?: string[]
    ctaVariations?: string[]
    captionFormulas?: string[]
    scriptTemplate?: string
    contentAngles?: string[]
    adCopyVariants?: string[]
  }
  calendar?: any[] // contentCalendar entries
  creativeBriefDirection?: string // from creativeBrief.overallCreativeDirection or moodDescription
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface SentinelReviewOutput {
  status: 'passed' | 'needs_attention'
  riskScore: number         // 0-100 — lower is better
  brandConsistencyScore: number // 0-100 — higher is better
  summary: string
  claimSafetyNotes: string
  toneConsistencyNotes: string
  complianceWarnings: string[]
  recommendedFixes: string[]
  reviewedAt: string
}

// ─── Internal API ─────────────────────────────────────────────────────────────

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2000
): Promise<any> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',  // Quality gate — needs full reasoning capability
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      max_tokens: maxTokens,
      temperature: 0.3, // low temp for consistent, analytical output
    }),
  })
  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`)
  const data = await response.json()
  const raw = data.choices?.[0]?.message?.content || '{}'
  try { return JSON.parse(raw) } catch { return {} }
}

// ─── Main Function ────────────────────────────────────────────────────────────

export async function runSentinelReview(input: SentinelReviewInput): Promise<SentinelReviewOutput> {
  const langInstruction = getLanguageInstruction(input.language)
  const b = input.brand || {}
  const s = input.strategy || {}
  const c = input.content || {}

  // Build a compact content sample for the review
  const hooksSample = (c.topHooks || []).slice(0, 5).map((h, i) => `Hook ${i + 1}: "${h}"`).join('\n')
  const ctaSample = (c.ctaVariations || []).slice(0, 4).map((cta, i) => `CTA ${i + 1}: "${cta}"`).join('\n')
  const captionSample = (c.captionFormulas || []).slice(0, 3).map((cap, i) => `Caption ${i + 1}: "${cap}"`).join('\n')
  const adCopySample = (c.adCopyVariants || []).slice(0, 3).map((ad, i) => `Ad copy ${i + 1}: "${ad}"`).join('\n')
  const scriptSample = c.scriptTemplate ? `Script template:\n${c.scriptTemplate.slice(0, 400)}` : ''
  const calendarSample = (input.calendar || []).slice(0, 5).map((post: any) =>
    `Day ${post.day || '?'} [${post.platform || '?'}]: "${post.hook || ''}" / "${post.caption || ''}"`
  ).join('\n')
  const riskNotesSample = (s.riskNotes || []).map(r => `- ${r}`).join('\n')
  const avoidWords = (b.avoidKeywords || []).join(', ')
  const brandTone = (b.toneKeywords || []).join(', ')

  // Sprint M operational fields
  const doNotDoYet = (s.doNotDoYet || []).map(d => `- ${d}`).join('\n')
  const readinessIncomplete = (s.readinessChecklist || [])
    .filter((item: any) => !item.done)
    .map((item: any) => `- ${item.label || item.item || ''}`)
    .join('\n')
  const funnelStagesSample = (s.funnelStages || []).slice(0, 3).map((fs: any) =>
    `${fs.stage || ''}: ${fs.goal || ''} / tactics: ${(fs.tactics || []).join(', ')}`
  ).join('\n')
  const contentAnglesSample = (s.contentAnglesDetailed || []).slice(0, 3).map((a: any) =>
    `[${a.platform || '?'} ${a.funnelStage || ''}] ${a.title || a.angle || ''}: hook="${a.hook || ''}", cta="${a.cta || ''}"`
  ).join('\n')
  const adSetupSummary = s.adSetupPlan
    ? `Objective: ${s.adSetupPlan.objective || ''} | Platform: ${s.adSetupPlan.platformPriority || ''} | Budget: ${s.adSetupPlan.testBudget || ''} | Target: ${s.adSetupPlan.targeting || ''}`
    : ''

  const systemPrompt = `${langInstruction}

You are Sentinel — the world's most rigorous marketing compliance officer and brand equity guardian. You have spent 20 years reviewing advertising campaigns across 35 markets for regulatory compliance, brand consistency, and execution risk. You have personally reviewed 15,000+ campaigns and prevented dozens of brand crises.

You think like a combination of: a senior FTC attorney, a Meta advertising policy expert, a David Aaker-trained brand equity analyst, and a performance marketing strategist who knows when content will fail in the market — not just in the courtroom.

YOUR COMPLIANCE KNOWLEDGE BASE:

1. FTC & Advertising Law:
   - FTC Act Section 5: any claim a reasonable person could interpret as fact must be substantiated with evidence on file.
   - 2023 updated FTC Endorsement Guides: "#ad" or "#sponsored" must appear early in the post, not buried after "read more."
   - "Best," "fastest," "#1," "leading," "guaranteed," "proven" — all require substantiation or are legally exposed.
   - Before/after claims: require disclosure of conditions, timeframe, and whether results are typical.
   - "Free" without disclosing required purchase = deceptive under FTC guidelines.

2. Platform Advertising Policies (MENA + Global):
   - Meta's Special Ad Categories: housing, employment, credit, health conditions, financial products — stricter targeting restrictions and explicit disclaimers required.
   - Health & wellness claims: no guaranteed outcomes, no before/after body transformation without medical disclaimer, no disease treatment claims.
   - Financial claims: no guaranteed returns, no specific income claims without substantiation and risk disclosure.
   - TikTok: stricter on health outcomes than Meta. No "you will lose X kg." No "earn $X/month" without proof.

3. Brand Equity Protection (David Aaker's 4-Dimension Model):
   - Brand Awareness associations: does this content clearly signal who the brand is and what it does? Confusing content dilutes awareness.
   - Intended associations: what mental image does this content create? Is it the positioning the brand has chosen? Off-positioning content undermines all prior brand investment.
   - Perceived quality signals: over-discounted language damages premium brands; over-polished language alienates authentic/community brands.
   - Loyalty maintenance: does this content respect existing customers or does it inadvertently signal "we're only for new people"?

4. Tone & Voice Integrity — the most ignored dimension of brand safety:
   - Every piece of content either reinforces or dilutes the brand's identity. A single off-tone post is noise. Thirty off-tone posts become the brand's identity.
   - You compare every piece of content against: tone keywords, writing style, forbidden words/phrases, and the brand's stated audience.
   - Off-tone content gets flagged with the specific correction, not just a vague "doesn't match brand voice."

5. Execution Risk Assessment:
   - Placeholder text in final content = production delay risk. Always flag.
   - Missing CTAs or broken CTAs = conversion loss.
   - Platform format violations: aspect ratio issues, text in unsafe zones.
   - Audience appropriateness: cultural sensitivity for the declared market region.
   - Strategic alignment: does the content support the declared funnel stage or contradict it?

SCORING STANDARDS:
- riskScore 0-20: clean. Minor style notes only.
- riskScore 21-40: review recommended. Specific items to fix but can proceed.
- riskScore 41-70: significant issues. Should not launch without corrections.
- riskScore 71-100: high risk. Legal exposure, platform violations, or severe brand damage possible. Do NOT launch.
- brandConsistencyScore 80-100: strong alignment. Below 60 means the content reads like a different brand.

SENTINEL'S CODE: never invent risks that don't exist. Bold content that is substantiated and on-brand is excellent content — do not penalize it. Only flag real, specific risks with exact quotes from the content and exact corrections needed. If the campaign is genuinely clean, say so clearly and confidently.

Always output valid JSON.`

  const userPrompt = `Review this campaign package:

CAMPAIGN: ${input.campaignName}
GOAL: ${input.campaignGoal || 'Not specified'}
AUDIENCE: ${input.audience || 'Not specified'}
TONE: ${input.tone || 'Not specified'}

BRAND PROFILE:
- Brand: ${b.name || 'Unknown'} (${b.businessType || 'Business'})
- Required tone keywords: ${brandTone || 'Not set'}
- Forbidden words/phrases: ${avoidWords || 'None specified'}
- Writing style: ${b.writingStyle || 'Not specified'}
- Audience: ${b.targetAudience || 'Not specified'}
- Price point: ${b.pricePoint || 'Not specified'}

STRATEGY:
- Positioning: ${s.positioning || 'Not specified'}
- Key message: ${s.keyMessage || 'Not specified'}
- Differentiation: ${s.differentiation || 'Not specified'}
${riskNotesSample ? `- Risk notes:\n${riskNotesSample}` : ''}
${doNotDoYet ? `- Do NOT do yet (flagged by strategy):\n${doNotDoYet}` : ''}
${readinessIncomplete ? `- Incomplete readiness items:\n${readinessIncomplete}` : ''}
${funnelStagesSample ? `- Funnel stages:\n${funnelStagesSample}` : ''}
${adSetupSummary ? `- Ad setup plan: ${adSetupSummary}` : ''}

CONTENT SAMPLE:
${hooksSample || 'No hooks found'}

${ctaSample || 'No CTAs found'}

${captionSample || 'No captions found'}

${adCopySample || 'No ad copy found'}

${scriptSample || ''}

CONTENT CALENDAR SAMPLE:
${calendarSample || 'No calendar posts found'}

${contentAnglesSample ? `CONTENT ANGLES (Sprint M):\n${contentAnglesSample}` : ''}

${input.creativeBriefDirection ? `CREATIVE DIRECTION:\n${input.creativeBriefDirection}` : ''}

Return JSON with exactly these fields:
{
  "riskScore": <integer 0-100>,
  "brandConsistencyScore": <integer 0-100>,
  "summary": "2-3 sentence overall readiness assessment. Be direct and specific.",
  "claimSafetyNotes": "Specific notes on any unsubstantiated claims, result guarantees, or misleading language found in the content. If none found, say 'No claim safety issues detected.'",
  "toneConsistencyNotes": "Specific notes on how well the content matches the brand tone. Reference actual content. Note any tone mismatches.",
  "complianceWarnings": [
    "List specific compliance concerns if any — empty array if none"
  ],
  "recommendedFixes": [
    "Specific actionable fix 1 — reference the exact content to change",
    "Specific actionable fix 2"
  ]
}

If the campaign passes all checks cleanly: riskScore should be under 25, brandConsistencyScore above 80, complianceWarnings should be an empty array, and recommendedFixes should be an empty array.`

  const result = await callOpenAI(systemPrompt, userPrompt, 2000)
  checkAndLog('sentinel-reviewer', JSON.stringify(result), {
    brandName: input.brand?.name,
    industry: input.brand?.businessType,
    targetAudience: input.brand?.targetAudience,
  })

  const riskScore = Math.min(100, Math.max(0, parseInt(result.riskScore ?? 50) || 50))
  const brandScore = Math.min(100, Math.max(0, parseInt(result.brandConsistencyScore ?? 70) || 70))
  const warnings: string[] = Array.isArray(result.complianceWarnings)
    ? result.complianceWarnings.filter((w: any) => typeof w === 'string' && w.trim())
    : []
  const fixes: string[] = Array.isArray(result.recommendedFixes)
    ? result.recommendedFixes.filter((f: any) => typeof f === 'string' && f.trim())
    : []

  // ── PR-1K: deterministic unsupported-claim guard ─────────────────────────────
  // The LLM review above can miss invented metrics/guarantees ("30% productivity
  // gain" once slipped through). Run a conservative pattern scan over the ACTUAL
  // content and force-flag anything risky so it can never silently pass review.
  // This adds no OpenAI call, no credit cost, no data mutation — display/safety only.
  const claimScan = detectUnsupportedClaims([
    ...(c.topHooks || []),
    ...(c.ctaVariations || []),
    ...(c.captionFormulas || []),
    ...(c.adCopyVariants || []),
    c.scriptTemplate,
    ...(c.contentAngles || []),
    s.keyMessage,
    s.positioning,
    s.differentiation,
    ...((s.funnelStages || []).flatMap((stage: any) => [
      stage?.userMindset,
      stage?.message,
      stage?.contentType,
      stage?.cta,
      stage?.successMetric,
      stage?.nextStep,
    ])),
    ...((s.contentAnglesDetailed || []).flatMap((angle: any) => [
      angle?.title,
      angle?.hook,
      angle?.pain,
      angle?.desiredOutcome,
      angle?.objection,
      angle?.message,
      angle?.cta,
      angle?.proofNeeded,
      angle?.responseHandoff,
      angle?.reviewPoint,
    ])),
    ...((s.weeklyExecutionPlan || []).flatMap((week: any) => [
      week?.objective,
      week?.keyMessage,
      ...(week?.deliverables || []),
      week?.cta,
      week?.successMetric,
      week?.executionNote,
      ...(week?.reviewPoints || []),
    ])),
    ...(s.doNotDoYet || []),
    ...(s.executionAssumptions || []),
    ...(s.assumptions || []),
    ...((input.calendar || []).flatMap((p: any) => [p?.hook, p?.caption, p?.cta])),
  ])

  const claimWarnings = buildClaimWarnings(claimScan)
  const allWarnings = [...warnings, ...claimWarnings]

  // Any unsupported claim is, at minimum, a "review recommended" risk (>= 40) and
  // always sets needs_attention — never let the score say "clean" while a flagged
  // claim exists.
  const finalRiskScore = claimScan.hasUnsupportedClaims ? Math.max(riskScore, 40) : riskScore

  let claimSafetyNotes: string = result.claimSafetyNotes || ''
  if (claimScan.hasUnsupportedClaims) {
    const detail = claimScan.findings
      .map(f => `"${f.match}" (${claimCategoryLabel(f.category)})`)
      .join('; ')
    claimSafetyNotes =
      `${claimSafetyNotes ? claimSafetyNotes.trim() + ' ' : ''}` +
      `Automated guard flagged claim(s) that need evidence before they can be used: ${detail}. ` +
      `Soften to "designed to help / can help / may improve" or add a verifiable source.`
  }

  // Status: needs_attention if riskScore >= 40 OR any compliance/claim warnings.
  const status: 'passed' | 'needs_attention' =
    finalRiskScore >= 40 || allWarnings.length > 0 ? 'needs_attention' : 'passed'

  return {
    status,
    riskScore: finalRiskScore,
    brandConsistencyScore: brandScore,
    summary: result.summary || '',
    claimSafetyNotes,
    toneConsistencyNotes: result.toneConsistencyNotes || '',
    complianceWarnings: allWarnings,
    recommendedFixes: fixes,
    reviewedAt: new Date().toISOString(),
  }
}
