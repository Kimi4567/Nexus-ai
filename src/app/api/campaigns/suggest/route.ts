import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { suggestRateLimitDb } from '@/lib/dbRateLimit'
import { prisma } from '@/lib/prisma'
import {
  BANNED_PHRASES,
  SPECIFICITY_RULES,
  UNSUPPORTED_CLAIMS_RULES,
  buildBrandContextBlock,
  type BrandContextData,
} from '@/lib/ai/promptRules'
import { guardBrandText } from '@/lib/ai/brandTruthGuard'
import {
  checkAndDeductCredits,
  refundCredits,
  refundCreditsForTransaction,
  type CreditDeductionOk,
} from '@/lib/credits'

/* ═══════════════════════════════════════════════════════════════
   POST /api/campaigns/suggest
   Generates AI text suggestions for campaign wizard fields.
   Uses brand brain context + current form data for relevance.
   Anti-generic rules + chain-of-thought enforced.

   Fields:
     name        → catchy campaign name
     description → product/service description
     audience    → target audience description
   ═══════════════════════════════════════════════════════════════ */

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
    const { field, name, description, goal, locale } = body

    if (!field) return NextResponse.json({ error: 'field required' }, { status: 400 })

    const isAr = locale === 'ar'
    const lang = isAr ? 'Arabic' : 'English'

    // ── Load Brand Brain for full context ─────────────────────────
    let brandData: BrandContextData = {}
    try {
      const workspace = await prisma.workspace.findFirst({ where: { ownerId: user.id } })
      if (workspace) {
        const brand = await prisma.brandProfile.findUnique({ where: { workspaceId: workspace.id } })
        if (brand) {
          brandData = {
            brandName:           brand.brandName  || undefined,
            industry:            brand.industry   || undefined,
            description:         brand.description || undefined,
            primaryOffer:        brand.primaryOffer || undefined,
            targetAudience:      brand.targetAudience || undefined,
            audienceLocation:    brand.audienceLocation || undefined,
            uniqueAdvantages:    Array.isArray(brand.uniqueAdvantages) ? (brand.uniqueAdvantages as string[]) : undefined,
            toneKeywords:        Array.isArray(brand.toneKeywords) ? (brand.toneKeywords as string[]) : undefined,
            audiencePainPoints:  Array.isArray(brand.audiencePainPoints) ? (brand.audiencePainPoints as string[]) : undefined,
            competitorNotes:     brand.competitorNotes || undefined,
            winningHooks:        Array.isArray(brand.winningHooks) ? (brand.winningHooks as string[]) : undefined,
          }
        }
      }
    } catch { /* non-fatal — proceed without brand context */ }

    const contextBlock = buildBrandContextBlock(brandData)

    const campaignContext = [
      name        && `Campaign name: ${name}`,
      description && `Product/Service being advertised: ${description}`,
      goal        && `Campaign goal: ${goal}`,
    ].filter(Boolean).join('\n')

    const systemPrompt = `You are a senior marketing strategist and copywriter.

${BANNED_PHRASES}

${SPECIFICITY_RULES}

${UNSUPPORTED_CLAIMS_RULES}

REASONING REQUIREMENT — before writing anything, silently complete this analysis:
1. Which brand stage and constraint are explicitly supported, and which remain unknown?
2. Which buyer details are confirmed in Brand Brain or this campaign?
3. What message can be written using only the confirmed offer, audience, and proof?
4. What would make this campaign blend into generic noise — and how do I avoid it?

${contextBlock}
${campaignContext ? `\n=== CURRENT CAMPAIGN ===\n${campaignContext}\n=== END CAMPAIGN ===` : ''}

Return ONLY what was requested — no intro, no preamble, no explanation.`

    // ── Field-specific prompts ─────────────────────────────────────
    const brandRef = brandData.brandName || 'this brand'

    const prompts: Record<string, string> = {

      name: `Generate a campaign name for ${brandRef}${goal ? ` with goal: "${goal}"` : ''}.
Rules:
- Max 6 words — punchy, specific, memorable
- Must reflect the campaign's actual goal and the audience's desire
- Use clear action language or curiosity without inventing numbers, deadlines, scarcity, discounts, or urgency
- NEVER use: "Power", "Impact", "Transform", "Elevate", "Boost", "Scale", "Ignite" (overused)
- Must sound like a real campaign name a creative director would approve
- Return ONLY the campaign name as plain text, no quotes. Language: ${lang}`,

      description: `Write a campaign product/service description for ${brandRef}.
Rules:
- 1-2 sentences, max 40 words
- Open with WHAT it is and WHO it is for using confirmed details only
- Include a qualitative outcome only when the brand context supports it; otherwise label it as a positioning hypothesis
- Mention price or delivery model only when it is supplied
- NEVER use: "innovative", "powerful", "comprehensive", "seamless", "robust"
- Return ONLY the description text. Language: ${lang}`,

      audience: `Write a target audience description for ${brandRef}'s campaign.
Rules:
- 2-3 sentences, max 60 words
- Use only confirmed job, situation, age, income/budget, location, behavior, and pain details
- Do not infer demographics or behavior from the industry, offer, or campaign goal
- If details are missing, write a clearly labelled audience hypothesis and list the missing inputs to confirm
- NEVER write: "business owners", "entrepreneurs", "anyone who wants", "people looking for"
- Return ONLY the audience description. Language: ${lang}`,
    }

    const prompt = prompts[field]
    if (!prompt) return NextResponse.json({ error: 'Unknown field' }, { status: 400 })

    // FLOW-03 fix: deduct 1 credit per AI suggest call
    const credit = await checkAndDeductCredits(user.id, 'AD_COPY')
    if (!credit.ok) return NextResponse.json(credit, { status: 402 })
    chargedUserId = user.id
    chargedCredit = credit

    const freshPrompt = `${prompt}\n\nProduce an alternate wording while preserving every supplied fact and uncertainty label.`

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: freshPrompt },
        ],
        max_tokens: 200,
        temperature: 0.85,  // High enough for real variety on repeated clicks
      }),
    })
    if (!res.ok) {
      await refundDeductedCredits(user.id, credit, `OpenAI error ${res.status}`)
      return NextResponse.json({ error: `OpenAI error ${res.status}` }, { status: 502 })
    }

    const completion = await res.json()
    const rawSuggestion: string = completion.choices?.[0]?.message?.content?.trim() || ''
    const allowedClaims = [
      name,
      description,
      goal,
      brandData.brandName,
      brandData.industry,
      brandData.description,
      brandData.primaryOffer,
      brandData.targetAudience,
      brandData.audienceLocation,
      ...(brandData.uniqueAdvantages || []),
      ...(brandData.audiencePainPoints || []),
      brandData.competitorNotes,
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    const suggestion = guardBrandText(rawSuggestion, allowedClaims)

    // Prevent any edge caching
    return NextResponse.json({ suggestion }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('POST /api/campaigns/suggest error:', error)
    if (chargedUserId && chargedCredit) {
      await refundDeductedCredits(chargedUserId, chargedCredit, 'Campaign suggestion failed')
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
