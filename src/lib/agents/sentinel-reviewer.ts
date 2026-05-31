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
 */

import { getLanguageInstruction } from '@/lib/ai/langHelper'

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
      model: 'gpt-4o-mini',
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

  const systemPrompt = `${langInstruction}

You are Sentinel — an AI campaign compliance and brand safety reviewer.

Your role: review a marketing campaign package and provide an honest, specific risk and readiness assessment.

REVIEW CRITERIA:
1. CLAIM SAFETY — Are there unsubstantiated claims, guaranteed results, misleading statistics, or legal risks?
2. TONE CONSISTENCY — Does the content match the brand's established tone, voice, and writing style?
3. BRAND SAFETY — Does the content avoid the brand's blacklisted words/phrases? Does it respect audience sensitivity?
4. COMPLIANCE — Any promotional regulations concerns, disclosure requirements, or platform policy risks?
5. EXECUTION READINESS — Is the content specific enough to be executed? Are there vague placeholders?

SCORING:
- riskScore: 0-100. 0 = no risk, 100 = severe risk. Score ≥ 40 requires attention.
- brandConsistencyScore: 0-100. 100 = perfect alignment with brand identity.

Be specific and actionable. Reference actual content from the campaign when noting issues.
Do not invent risks. If the content is genuinely clean, say so clearly.

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
${riskNotesSample ? `- Strategy risk notes:\n${riskNotesSample}` : ''}

CONTENT SAMPLE:
${hooksSample || 'No hooks found'}

${ctaSample || 'No CTAs found'}

${captionSample || 'No captions found'}

${adCopySample || 'No ad copy found'}

${scriptSample || ''}

CONTENT CALENDAR SAMPLE:
${calendarSample || 'No calendar posts found'}

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

  const riskScore = Math.min(100, Math.max(0, parseInt(result.riskScore ?? 50) || 50))
  const brandScore = Math.min(100, Math.max(0, parseInt(result.brandConsistencyScore ?? 70) || 70))
  const warnings: string[] = Array.isArray(result.complianceWarnings)
    ? result.complianceWarnings.filter((w: any) => typeof w === 'string' && w.trim())
    : []
  const fixes: string[] = Array.isArray(result.recommendedFixes)
    ? result.recommendedFixes.filter((f: any) => typeof f === 'string' && f.trim())
    : []

  // Status: needs_attention if riskScore >= 40 OR any compliance warnings
  const status: 'passed' | 'needs_attention' =
    riskScore >= 40 || warnings.length > 0 ? 'needs_attention' : 'passed'

  return {
    status,
    riskScore,
    brandConsistencyScore: brandScore,
    summary: result.summary || '',
    claimSafetyNotes: result.claimSafetyNotes || '',
    toneConsistencyNotes: result.toneConsistencyNotes || '',
    complianceWarnings: warnings,
    recommendedFixes: fixes,
    reviewedAt: new Date().toISOString(),
  }
}
