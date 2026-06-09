/**
 * POST /api/ad-campaigns/ai-suggest
 *
 * Reads Brand Brain → returns AI-recommended campaign configuration.
 * Free (no credit cost) — it's a smart recommendation, not a full AI generation.
 *
 * Returns:
 *   platform, objective, dailyBudget, currency, name, language, rationale
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/apiAuth'
import { suggestRateLimitDb } from '@/lib/dbRateLimit'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

async function callGPT(system: string, user: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 600,
    }),
  })
  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? '{}'
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Rate limit — 30 AI suggestions per hour (free endpoint, no credits)
    const rl = await suggestRateLimitDb(user.id)
    if (!rl.ok) return NextResponse.json({ error: rl.message }, { status: 429 })

    // Get workspace
    const workspace = await db.workspace.findFirst({
      where: { ownerId: user.id },
      select: { id: true },
    })
    if (!workspace) return NextResponse.json({ error: 'No workspace found' }, { status: 404 })

    // Get Brand Brain
    let brandProfile = null
    try {
      brandProfile = await db.brandProfile.findUnique({
        where: { workspaceId: workspace.id },
      })
    } catch { /* ok */ }

    // Detect MENA market
    const locationHint = (brandProfile?.audienceLocation || '').toLowerCase()
    const isMENA = ['saudi', 'uae', 'egypt', 'mena', 'gulf', 'كويت', 'إمارات', 'السعودية', 'مصر', 'خليج'].some(
      kw => locationHint.includes(kw)
    )

    // If no Brand Brain, return smart defaults
    if (!brandProfile) {
      const now = new Date()
      const month = now.toLocaleString('en', { month: 'short' })
      const year = now.getFullYear()
      return NextResponse.json({
        platform: 'META',
        objective: 'LEAD_GENERATION',
        dailyBudget: '50',
        currency: 'USD',
        name: `New Campaign — ${month} ${year}`,
        language: 'en',
        rationale: 'Default recommendation — complete your Brand Brain for a personalized suggestion.',
        missingBrandBrain: true,
      })
    }

    const brandCtx = `
Brand: ${brandProfile.brandName || 'Unknown'}
Industry: ${brandProfile.industry || 'Unknown'}
Primary Offer: ${brandProfile.primaryOffer || 'Not specified'}
Price Point: ${brandProfile.pricePoint || 'Not specified'}
Target Audience: ${brandProfile.targetAudience || 'Not specified'}
Audience Location: ${brandProfile.audienceLocation || 'Not specified'}
Audience Age: ${brandProfile.audienceAge || 'Not specified'}
Top Platforms: ${(brandProfile.topPlatforms || []).join(', ')}
Brand Tone: ${(brandProfile.toneKeywords || []).join(', ')}
Unique Advantages: ${(brandProfile.uniqueAdvantages || []).slice(0, 3).join(', ')}`

    const now = new Date()
    const month = now.toLocaleString('en', { month: 'short' })
    const year = now.getFullYear()

    const systemPrompt = `You are a paid media strategist. Given a brand profile, suggest the ideal first paid campaign configuration. Be specific and practical. Output ONLY valid JSON.`

    const userPrompt = `${brandCtx}

Suggest the best paid campaign configuration. Consider:
- Platform: META (B2C/broad), LINKEDIN (B2B/professional), TIKTOK (young/consumer), GOOGLE (high-intent/search)
- Objective: LEAD_GENERATION (services/SaaS), CONVERSIONS (ecommerce), TRAFFIC (awareness), BRAND_AWARENESS (new brands)
- Budget: based on price point and industry
- Language: 'ar' for Arabic-speaking market, 'en' for English, 'bilingual' for mixed

Return JSON:
{
  "platform": "META|GOOGLE|TIKTOK|LINKEDIN",
  "objective": "LEAD_GENERATION|CONVERSIONS|TRAFFIC|BRAND_AWARENESS|ENGAGEMENT",
  "dailyBudget": "number as string, e.g. '50'",
  "currency": "${isMENA ? 'USD' : 'USD'}",
  "name": "${brandProfile.brandName || 'Campaign'} — [objective label] ${month} ${year}",
  "language": "ar|en|bilingual",
  "rationale": "1-2 sentence explanation of why these choices make sense for this brand"
}`

    const raw = await callGPT(systemPrompt, userPrompt)
    let suggestion: Record<string, unknown>
    try {
      suggestion = JSON.parse(raw)
    } catch {
      // Fallback if GPT returns invalid JSON
      return NextResponse.json({
        platform: 'META',
        objective: 'LEAD_GENERATION',
        dailyBudget: '50',
        currency: 'USD',
        name: `${brandProfile.brandName} — Lead Gen ${month} ${year}`,
        language: isMENA ? 'ar' : 'en',
        rationale: 'Recommended based on your brand profile.',
      })
    }

    return NextResponse.json({
      platform: suggestion.platform || 'META',
      objective: suggestion.objective || 'LEAD_GENERATION',
      dailyBudget: String(suggestion.dailyBudget || '50'),
      currency: String(suggestion.currency || 'USD'),
      name: String(suggestion.name || `${brandProfile.brandName} Campaign`),
      language: String(suggestion.language || 'en'),
      rationale: String(suggestion.rationale || ''),
    })
  } catch (err) {
    console.error('[ai-suggest]', err)
    return NextResponse.json({ error: 'Suggestion failed' }, { status: 500 })
  }
}
