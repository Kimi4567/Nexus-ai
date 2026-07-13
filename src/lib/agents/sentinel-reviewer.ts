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
import { detectUnsupportedClaims, buildClaimWarnings } from '@/lib/ai/claimGuard'

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

interface RawSentinelAssessment {
  riskScore?: unknown
  brandConsistencyScore?: unknown
  summary?: unknown
  claimSafetyNotes?: unknown
  toneConsistencyNotes?: unknown
  complianceWarnings?: unknown
  recommendedFixes?: unknown
}

const QUOTED_EVIDENCE_PATTERNS = [
  /"([^"\n]{4,})"/g,
  /'([^'\n]{4,})'/g,
  /“([^”\n]{4,})”/g,
  /‘([^’\n]{4,})’/g,
  /«([^»\n]{4,})»/g,
]

function normalizedEvidenceText(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/g, ' ').trim()
}

function collectTextLeaves(value: unknown, output: string[] = []): string[] {
  if (typeof value === 'string' && value.trim()) output.push(value)
  else if (Array.isArray(value)) value.forEach((item) => collectTextLeaves(item, output))
  else if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((item) => collectTextLeaves(item, output))
  }
  return output
}

/**
 * LLM findings are allowed to block execution only when they quote text that is
 * actually present in the supplied campaign package. This prevents a reviewer
 * suggestion about a missing future deliverable (or an unsupported assumption)
 * from becoming a circular workflow blocker.
 */
export function hasCampaignEvidenceQuote(finding: string, sourceText: string): boolean {
  const normalizedSource = normalizedEvidenceText(sourceText)
  for (const pattern of QUOTED_EVIDENCE_PATTERNS) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(finding)) !== null) {
      const quote = normalizedEvidenceText(match[1] || '')
      if (quote.length >= 4 && normalizedSource.includes(quote)) return true
    }
  }
  return false
}

export function normalizeSentinelAssessment(
  result: RawSentinelAssessment,
  sourceText: string,
  claimScan: ReturnType<typeof detectUnsupportedClaims>,
  language?: string,
): SentinelReviewOutput {
  const parsedRisk = Number.parseInt(String(result.riskScore ?? 50), 10)
  const parsedBrand = Number.parseInt(String(result.brandConsistencyScore ?? 70), 10)
  const riskScore = Math.min(100, Math.max(0, Number.isFinite(parsedRisk) ? parsedRisk : 50))
  const brandScore = Math.min(100, Math.max(0, Number.isFinite(parsedBrand) ? parsedBrand : 70))
  const rawWarnings = Array.isArray(result.complianceWarnings)
    ? result.complianceWarnings.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
  const rawFixes = Array.isArray(result.recommendedFixes)
    ? result.recommendedFixes.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
  const groundedWarnings = rawWarnings.filter((item) => hasCampaignEvidenceQuote(item, sourceText))
  const groundedFixes = rawFixes.filter((item) => hasCampaignEvidenceQuote(item, sourceText))
  const claimWarnings = buildClaimWarnings(claimScan)
  const allWarnings = [...groundedWarnings, ...claimWarnings]
  const hasGroundedLlmFinding = groundedWarnings.length > 0 || groundedFixes.length > 0

  // A score with no cited evidence is an advisory model opinion, not a factual
  // blocker. Keep it within the documented proceed-with-review band.
  const finalRiskScore = claimScan.hasUnsupportedClaims
    ? Math.max(riskScore, 40)
    : hasGroundedLlmFinding
      ? riskScore
      : Math.min(riskScore, 40)
  const status: 'passed' | 'needs_attention' =
    claimScan.hasUnsupportedClaims ||
    groundedWarnings.length > 0 ||
    (finalRiskScore > 40 && groundedFixes.length > 0)
      ? 'needs_attention'
      : 'passed'

  const arabic = String(language || '').toLowerCase().startsWith('ar')
  const summary = status === 'needs_attention'
    ? arabic
      ? 'تم إيقاف الاعتماد بسبب ملاحظات مرتبطة بنص موجود فعلاً في الحملة. راجع التحذيرات والاقتباسات قبل المتابعة.'
      : 'Approval is blocked by findings tied to text that is actually present in the campaign. Review the warnings and quoted evidence before proceeding.'
    : groundedFixes.length > 0
      ? arabic
        ? 'لم تُكتشف مخاطر امتثال مانعة. التوصيات المرتبطة باقتباسات من الحملة إرشادية ويمكن مراجعتها قبل التنفيذ.'
        : 'No blocking compliance risk was detected. Recommendations tied to quoted campaign text are advisory and can be reviewed before execution.'
      : arabic
        ? 'لم تُكتشف ادعاءات غير مدعومة أو مخاطر امتثال مانعة في النص المقدم.'
        : 'No unsupported-claim pattern or blocking compliance risk was detected in the supplied text.'
  const claimSafetyNotes = claimScan.hasUnsupportedClaims
    ? arabic
      ? `رصد الفحص الآلي ${claimScan.findings.length} ادعاء يحتاج إلى دليل أو صياغة أكثر تحفظاً قبل الاستخدام.`
      : `The deterministic scan found ${claimScan.findings.length} claim(s) that need evidence or safer wording before use.`
    : arabic
      ? 'لم يرصد الفحص الآلي أنماط ادعاءات غير مدعومة في النص المقدم.'
      : 'The deterministic scan found no unsupported-claim patterns in the supplied text.'
  const rawToneNotes = typeof result.toneConsistencyNotes === 'string'
    ? result.toneConsistencyNotes.trim()
    : ''
  const toneConsistencyNotes = rawToneNotes && hasCampaignEvidenceQuote(rawToneNotes, sourceText)
    ? rawToneNotes
    : arabic
      ? `مقارنة آلية مع ملف البراند: ${brandScore}/100. هذه إشارة للمراجعة وليست قياساً للأداء.`
      : `Automated comparison with the supplied brand profile: ${brandScore}/100. This is a review signal, not a performance measurement.`

  return {
    status,
    riskScore: finalRiskScore,
    brandConsistencyScore: brandScore,
    summary,
    claimSafetyNotes,
    toneConsistencyNotes,
    complianceWarnings: allWarnings,
    recommendedFixes: groundedFixes,
    reviewedAt: new Date().toISOString(),
  }
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

Act as Sentinel, an evidence-first marketing compliance and brand-risk reviewer. Do not claim legal credentials, review history, or certainty about market performance. Flag potential issues for human review and identify when jurisdiction- or platform-specific verification is required.

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
- riskScore 21-40: review recommended. Specific items to fix but can proceed; 40 is not a blocking score by itself.
- riskScore 41-70: significant issues. Should not launch without corrections.
- riskScore 71-100: high risk. Legal exposure, platform violations, or severe brand damage possible. Do NOT launch.
- brandConsistencyScore 80-100: strong alignment. Below 60 means the content reads like a different brand.

SENTINEL'S CODE: never invent risks that don't exist. Bold content that is substantiated and on-brand is excellent content — do not penalize it. Only flag real, specific risks with exact quotes from the supplied content and exact corrections needed. Do not flag assets that are planned for a later workflow stage as missing. Do not request verification that the product cannot perform or that is not represented in the supplied package. A warning or recommended fix without an exact quote will be discarded. If the campaign is genuinely clean, say so clearly and confidently.

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

  const sourceText = collectTextLeaves(input).join('\n')

  return normalizeSentinelAssessment(result, sourceText, claimScan, input.language)
}
