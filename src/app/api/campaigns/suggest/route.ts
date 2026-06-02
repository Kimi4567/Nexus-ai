import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import {
  BANNED_PHRASES,
  SPECIFICITY_RULES,
  buildBrandContextBlock,
  type BrandContextData,
} from '@/lib/ai/promptRules'

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

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

REASONING REQUIREMENT — before writing anything, silently complete this analysis:
1. What is the brand's stage and primary growth constraint right now?
2. Who is the ONE buyer most likely to convert from this campaign?
3. What single message will make that buyer stop scrolling?
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
- Use action words, numbers, or power phrases that create urgency or curiosity
- NEVER use: "Power", "Impact", "Transform", "Elevate", "Boost", "Scale", "Ignite" (overused)
- Must sound like a real campaign name a creative director would approve
- Return ONLY the campaign name as plain text, no quotes. Language: ${lang}`,

      description: `Write a campaign product/service description for ${brandRef}.
Rules:
- 1-2 sentences, max 40 words
- Open with WHAT it is and WHO it is for — specific buyer profile
- Include the #1 outcome the buyer gets — concrete, not vague
- If the brand has a price point or delivery model, hint at it
- NEVER use: "innovative", "powerful", "comprehensive", "seamless", "robust"
- Return ONLY the description text. Language: ${lang}`,

      audience: `Write a target audience description for ${brandRef}'s campaign.
Rules:
- 2-3 sentences, max 60 words
- Sentence 1: Demographics — job title or life situation, age, income/budget level
- Sentence 2: Behavior — what they're currently doing or using that isn't working
- Sentence 3: Trigger — the specific frustration or ambition that makes them act NOW
- NEVER write: "business owners", "entrepreneurs", "anyone who wants", "people looking for"
- Return ONLY the audience description. Language: ${lang}`,
    }

    const prompt = prompts[field]
    if (!prompt) return NextResponse.json({ error: 'Unknown field' }, { status: 400 })

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
          { role: 'user', content: prompt },
        ],
        max_tokens: 200,
        temperature: 0.5,  // Analytical — was 0.75
      }),
    })

    const completion = await res.json()
    const suggestion: string = completion.choices?.[0]?.message?.content?.trim() || ''

    return NextResponse.json({ suggestion })
  } catch (error) {
    console.error('POST /api/campaigns/suggest error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
