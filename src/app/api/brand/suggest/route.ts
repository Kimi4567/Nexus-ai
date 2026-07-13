import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { suggestRateLimitDb } from '@/lib/dbRateLimit'
import {
  BANNED_PHRASES,
  SPECIFICITY_RULES,
  UNSUPPORTED_CLAIMS_RULES,
  buildBrandContextBlock,
  type BrandContextData,
} from '@/lib/ai/promptRules'
import {
  checkAndDeductCredits,
  refundCredits,
  refundCreditsForTransaction,
  type CreditDeductionOk,
} from '@/lib/credits'
import { guardBrandText, guardBrandList } from '@/lib/ai/brandTruthGuard'

/* ═══════════════════════════════════════════════════════════════
   POST /api/brand/suggest
   Takes partial brand data + field to suggest.
   Returns AI-generated suggestions with analytical depth —
   chain-of-thought + anti-generic constraints enforced.
   ═══════════════════════════════════════════════════════════════ */

// Shared system prompt used for all brand suggest calls
function buildSystemPrompt(contextBlock: string, brandName?: string, industry?: string): string {
  const industryClause = industry ? ` in the ${industry} industry` : ''

  // When no industry is set, explicitly prevent the model from guessing based on brand name.
  // Without this guard, GPT infers industry from the brand name (e.g., "NEXUS AI" → SaaS) and
  // generates wrong-industry content — Bug #713.
  const noIndustryGuard = !industry
    ? `\n\nCRITICAL — INDUSTRY UNKNOWN: The user has NOT yet specified an industry. You MUST NOT assume, infer, or guess the industry from the brand name or any other signal. Do not anchor your output to any industry category. Base your suggestions ONLY on the explicit brand data provided (name, description, offer, audience). If you cannot generate meaningful output without knowing the industry, produce the most industry-neutral, broadly applicable version possible.`
    : ''

  const brandAnchor = brandName
    ? `You are working exclusively with the brand named "${brandName}"${industryClause}. Every output must be specifically written for "${brandName}" — not for any other brand, platform, or company.${noIndustryGuard}`
    : `You are working with an unnamed brand${industryClause}. Do NOT invent or assume a brand name. Write "this brand" when referring to it. Do NOT generate content for marketing tools, SaaS platforms, or advertising agencies unless the industry explicitly indicates this.${noIndustryGuard}`

  return `You are a senior brand strategist with deep expertise in positioning, market analysis, and industry-specific marketing.

${brandAnchor}

${BANNED_PHRASES}

${SPECIFICITY_RULES}

${UNSUPPORTED_CLAIMS_RULES}

CRITICAL INDUSTRY ALIGNMENT:
You must stay 100% within the brand's actual industry. If the brand is in Real Estate, generate real estate content. If Fashion, generate fashion content. If Restaurants, generate restaurant content. Never bleed in marketing-tech, SaaS, or advertising-platform framing unless the brand explicitly operates in those sectors.

CRITICAL REASONING REQUIREMENT:
Before writing any suggestion, internally complete this analysis:
1. What industry is this brand in? What are that industry's specific dynamics?
2. Who is their ONE most likely buyer right now — specific profile, situation, budget?
3. What specific problem does this brand solve that others in the SAME industry don't?
4. What industry-specific language would resonate with this brand's audience?
Only AFTER completing this analysis should you write the output.

${contextBlock}

OUTPUT RULES:
- Reference the brand by name if a name is provided; otherwise write "this brand" — NEVER invent a brand name
- Use specific language tied to this brand's actual industry, offer, and market
- Never write generic phrases that could apply to any brand in any industry
- Return ONLY what was requested — no intro, no explanation, no preamble`
}

async function refundDeductedCredits(userId: string, credit: CreditDeductionOk, reason: string) {
  if (credit.creditsUsed <= 0) return
  if (credit.transactionId) {
    await refundCreditsForTransaction({ userId, transactionId: credit.transactionId, reason })
    return
  }
  await refundCredits(userId, 'AD_COPY', reason)
}

export async function POST(req: NextRequest) {
  let chargedUserId: string | null = null
  let chargedCredit: CreditDeductionOk | null = null

  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = await suggestRateLimitDb(user.id)
    if (!rl.ok) return NextResponse.json({ error: rl.message }, { status: 429 })

    const body = await req.json()
    const {
      field,
      brandName,
      industry,
      description,
      primaryOffer,
      targetAudience,
      audienceLocation,
      pricePoint,
      uniqueAdvantages,
      toneKeywords,
      competitorNotes: competitorNotesCtx,
      locale,
    } = body

    if (!field) return NextResponse.json({ error: 'field required' }, { status: 400 })

    const isAr = locale === 'ar'
    const lang = isAr ? 'Arabic' : 'English'

    // ── Build structured brand context block ──────────────────────
    const brandData: BrandContextData = {
      brandName,
      industry,
      description,
      primaryOffer,
      targetAudience,
      audienceLocation,
      pricePoint,
      uniqueAdvantages: Array.isArray(uniqueAdvantages) ? uniqueAdvantages : undefined,
      toneKeywords: Array.isArray(toneKeywords) ? toneKeywords : undefined,
      competitorNotes: competitorNotesCtx,
    }
    const contextBlock = buildBrandContextBlock(brandData)
    const systemPrompt = buildSystemPrompt(contextBlock, brandName || undefined, industry || undefined)

    // PR-G: anything the USER actually provided is allowed to keep its figures.
    // Numbers/claims echoed from these are preserved by the truth guard; only
    // model-invented metrics/proof get scrubbed.
    const allowedClaims: string[] = [
      description, primaryOffer, targetAudience, audienceLocation, pricePoint,
      ...(Array.isArray(uniqueAdvantages) ? uniqueAdvantages : []),
      ...(Array.isArray(toneKeywords) ? toneKeywords : []),
      competitorNotesCtx,
    ].filter((s): s is string => typeof s === 'string' && s.trim().length > 0)

    // ── Text fields: return { suggestion: string } ────────────────
    const textFieldPrompts: Record<string, string> = {

      description: `Write a brand description for ${brandName || 'this brand'} in 2-3 sentences.
Rules:
- Open by naming what ${brandName || 'the brand'} does and for whom (specific audience, not "businesses")
- Include the single biggest differentiator that separates them from competitors in ${industry || 'their industry'}
- Close with the concrete outcome the customer gets — not a vague promise
- Do NOT use: innovative, cutting-edge, transform, unlock, seamless, empower, or any buzzword
Language: ${lang}`,

      primaryOffer: `Write a clear product/service description for ${brandName || 'this brand'}'s main offer in 1-2 sentences.
Rules:
- Name what it is, who it is for (specific buyer profile), and what specific outcome it delivers
- State the delivery format if relevant (1:1 coaching / SaaS / physical product / agency retainer)
- Describe the outcome qualitatively. Do NOT invent metrics, percentages, ROI, or "X% gain" figures — only include a number if it appears verbatim in the brand data above
- Do NOT use: powerful, robust, comprehensive, scalable, or vague adjectives
Language: ${lang}`,

      targetAudience: `Write a specific target audience description for ${brandName || 'this brand'} in 2-3 sentences.
Rules:
- Open with specific demographics: job title or life situation, age range, income/budget level
- Include 1-2 specific behaviors or habits that define this buyer
- Close with the ONE core frustration driving them to seek a solution like ${brandName || 'this brand'}
- Do NOT write: "business owners", "anyone who", "people who want to", or other vague descriptors
Language: ${lang}`,

      writingStyle: `Suggest a writing style directive for ${brandName || 'this brand'}'s marketing copy in 1-2 sentences.
Rules:
- Reference the brand's tone, the audience's communication style, and the platform context
- Give a concrete structural rule (e.g., "Short punchy sentences under 15 words. No preamble.")
- Contrast with what to AVOID — name the specific writing sin this brand must not commit
- Do NOT write generic advice like "be authentic" or "tell your story"
Language: ${lang}`,

      competitorNotes: `Write a competitive landscape overview for ${brandName || 'this brand'} in 2-3 sentences.
Rules:
- Name the 1-2 types of competitors this brand most directly faces (can use archetypes like "large-agency incumbents" or "free DIY tools" if no specific names given)
- State what the competitors do WELL (be honest — this builds strategic clarity)
- State what gap ${brandName || 'this brand'} exploits — the specific weakness or blind spot in competitor offerings
- Do NOT write: "highly competitive landscape", "standing out is key", or other obvious filler
Language: ${lang}`,
    }

    // ── Array fields: return { suggestions: string[] } ────────────
    const arrayFieldPrompts: Record<string, string> = {

      audiencePainPoints: `List 4-6 specific pain points that ${brandName || 'this brand'}'s target audience experiences.
Rules:
- Each pain point must describe a real, felt frustration — not a generic business challenge
- Write from the customer's perspective (e.g., "Spending 3 hours a week manually...")
- Each item should be 5-12 words, specific enough to quote in ad copy
- AVOID: "lack of growth", "poor ROI", "inefficiency" — these are too vague
- Return ONLY a JSON array of strings in ${lang}. Example: ["pain 1", "pain 2"]`,

      audienceDesires: `List 4-6 specific desires and aspirations of ${brandName || 'this brand'}'s target audience.
Rules:
- Each desire must be a concrete, tangible outcome — not an emotion
- Write as outcomes the customer can visualize (e.g., "Close 3 new clients without cold calling")
- Link desires to what ${brandName || 'this brand'} actually delivers
- AVOID: "success", "growth", "freedom", "peace of mind" — too vague
- Return ONLY a JSON array of strings in ${lang}. Example: ["desire 1", "desire 2"]`,

      toneKeywords: `Suggest 5-7 brand voice keywords for ${brandName || 'this brand'}.
Rules:
- Each keyword must be a single adjective that SPECIFICALLY fits this brand — not generic
- Avoid: professional, innovative, authentic, dynamic, passionate (overused everywhere)
- Consider the audience's communication style and the brand's positioning
- Think: "What adjectives would make this brand's competitor sound WRONG if they used them too?"
- Return ONLY a JSON array of single-word adjectives in ${lang}. Example: ["direct", "irreverent"]`,

      uniqueAdvantages: `List 4-6 specific competitive advantages for ${brandName || 'this brand'}.
Rules:
- Each advantage must be something a competitor CANNOT easily copy or claim
- Write from the buyer's benefit perspective — not feature descriptions
- Be concrete about a reviewable buyer benefit, but never invent time saved, cost reduction, guaranteed outcomes, or removed risk
- AVOID: "experienced team", "great service", "holistic approach", "tailored solutions"
- Return ONLY a JSON array of short phrases (4-10 words each) in ${lang}. Example: ["advantage 1"]`,

      winningHooks: `Generate 4-5 marketing hook IDEAS to test for ${brandName || 'this brand'}.
Rules:
- These are hypotheses to test, not proven winners — do NOT claim results, and do NOT invent numbers, percentages, or timeframes (e.g. never "30% in 4 weeks")
- Each hook must do ONE of: (a) name a specific pain, (b) challenge a belief the audience holds, (c) promise a specific qualitative outcome
- Max 10 words per hook
- NEVER start with: Discover, Unlock, Transform, Introducing, Are you ready, We help
- Each hook must be so specific it could ONLY belong to ${brandName || 'this brand'} — not any brand
- Return ONLY a JSON array of hooks in ${lang}. Example: ["hook 1", "hook 2"]`,

      secondaryOffers: `List 3-5 secondary offers ${brandName || 'this brand'} could realistically provide alongside their main offer.
Rules:
- Each offer must be logical given the brand's primary offer and audience
- Write as offer names a customer would recognize (e.g., "Monthly strategy audit call")
- Must be offers that solve problems the existing customers naturally have next
- AVOID: generic add-ons that any agency could offer
- Return ONLY a JSON array of short phrases in ${lang}. Example: ["offer 1", "offer 2"]`,

      winningAngles: `Suggest 3-5 marketing angles to TEST for ${brandName || 'this brand'}.
Rules:
- These are angles to validate, not proven results — do NOT present them as facts, and do NOT invent testimonials, case studies, customer success stories, or metrics/percentages
- Each angle must be a strategic lens through which to position the brand (e.g., "Before/After framing of the customer's situation")
- Name the specific emotional trigger or logical argument each angle uses
- Each angle must be tied to a real pain point or desire of the target audience
- AVOID: generic angles like "social proof" or "authority positioning" without specifics
- Return ONLY a JSON array of short descriptive phrases in ${lang}. Example: ["angle 1"]`,

      avoidKeywords: `List 5-7 words, phrases, or tones ${brandName || 'this brand'} must AVOID in their marketing copy.
Rules:
- Include actual words AND communication styles (e.g., "corporate jargon", "fear-based urgency")
- Explain briefly WHY each should be avoided given this brand's positioning
- Format as the word/phrase itself — the brand team must be able to scan this list quickly
- Think about what competitor brands overuse that would blend this brand into the noise
- Return ONLY a JSON array of short items in ${lang}. Example: ["word 1", "phrase 2"]`,
    }

    // ── Route to appropriate handler ──────────────────────────────
    // Variation tag forces a fresh result on every click
    const variationTag = `[Variation ${Math.floor(Math.random() * 9999)}]`
    const arrayPrompt = arrayFieldPrompts[field]

    if (!textFieldPrompts[field] && !arrayPrompt) {
      return NextResponse.json({ error: 'Unknown field' }, { status: 400 })
    }

    // FLOW-03 fix: deduct 1 credit per AI suggest call (AD_COPY tier — same as VEX)
    const credit = await checkAndDeductCredits(user.id, 'AD_COPY')
    if (!credit.ok) return NextResponse.json(credit, { status: 402 })
    chargedUserId = user.id
    chargedCredit = credit

    if (textFieldPrompts[field]) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `${textFieldPrompts[field]}\n\n${variationTag}` },
          ],
          max_tokens: 250,
          temperature: 0.85,
        }),
      })
      if (!res.ok) {
        await refundDeductedCredits(user.id, credit, `OpenAI error ${res.status}`)
        return NextResponse.json({ error: `OpenAI error ${res.status}` }, { status: 502 })
      }
      const completion = await res.json()
      const rawSuggestion: string = completion.choices?.[0]?.message?.content?.trim() || ''
      // PR-G: deterministic truth guard — scrub invented metrics, downgrade fake
      // proof / overclaimed automation before it can be saved as brand truth.
      const suggestion = guardBrandText(rawSuggestion, allowedClaims)
      return NextResponse.json({ suggestion }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${arrayPrompt}\n\n${variationTag}` },
        ],
        max_tokens: 400,
        temperature: 0.85,
      }),
    })
    if (!res.ok) {
      await refundDeductedCredits(user.id, credit, `OpenAI error ${res.status}`)
      return NextResponse.json({ error: `OpenAI error ${res.status}` }, { status: 502 })
    }
    const completion = await res.json()

    const raw: string = completion.choices?.[0]?.message?.content?.trim() || '[]'
    const cleaned = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim()
    let suggestions: string[] = []
    try {
      const parsed = JSON.parse(cleaned)
      if (Array.isArray(parsed)) {
        // Filter to STRINGS ONLY — non-string items (objects, numbers, null)
        // would crash React when rendered as JSX children
        suggestions = parsed
          .map((item: unknown) => {
            if (typeof item === 'string') return item.trim()
            // Handle {text: "..."} or {value: "..."} shapes GPT sometimes returns
            if (item && typeof item === 'object') {
              const obj = item as Record<string, unknown>
              const str = obj.text ?? obj.value ?? obj.suggestion ?? obj.angle ?? obj.hook ?? obj.item ?? obj.name
              return typeof str === 'string' ? str.trim() : null
            }
            return null
          })
          .filter((s): s is string => typeof s === 'string' && s.length > 0)
      }
    } catch {
      suggestions = []
    }

    // PR-G: same deterministic truth guard for array suggestions (hooks, angles,
    // advantages, etc.) — keeps user-provided figures, scrubs invented ones.
    suggestions = guardBrandList(suggestions, allowedClaims)

    return NextResponse.json({ suggestions }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('POST /api/brand/suggest error:', error)
    if (chargedUserId && chargedCredit) {
      await refundDeductedCredits(chargedUserId, chargedCredit, 'Brand suggestion failed')
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
