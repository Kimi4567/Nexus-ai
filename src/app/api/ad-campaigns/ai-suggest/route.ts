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
import { buildBrandExecutionContext } from '@/lib/brandExecutionContext'
import { getAiProviderUnavailablePayload, isAiProviderConfigured } from '@/lib/ai/provider'
import {
  normalizePaidPlanningPlatform,
  normalizePaidPlanningRationale,
} from '@/lib/paidPlanningSuggestion'

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
  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error('OpenAI returned no campaign suggestion')
  return content
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

    // Without Brand Brain, return a clearly labelled planning starting point.
    // Budget is never invented because it can become a money-moving input.
    if (!brandProfile) {
      const now = new Date()
      const month = now.toLocaleString('en', { month: 'short' })
      const year = now.getFullYear()
      return NextResponse.json({
        platform: 'META',
        objective: 'LEAD_GENERATION',
        dailyBudget: null,
        currency: 'USD',
        name: `New Campaign — ${month} ${year}`,
        language: 'en',
        rationale: 'Default planning starting point — complete Brand Brain and confirm objective, currency, and budget before use.',
        missingBrandBrain: true,
        requiresBudgetConfirmation: true,
        requiresCurrencyConfirmation: true,
        providerGenerated: false,
        recommendationSource: 'deterministic_onboarding_default',
      })
    }

    if (!isAiProviderConfigured()) {
      return NextResponse.json(getAiProviderUnavailablePayload(isMENA ? 'ar' : 'en'), { status: 503 })
    }

    const brandCtx = buildBrandExecutionContext(brandProfile)

    const now = new Date()
    const month = now.toLocaleString('en', { month: 'short' })
    const year = now.getFullYear()

    const systemPrompt = `You are a paid media strategist. Given a brand profile, suggest one planning configuration for review. Never claim readiness, never launch anything, and never invent a budget, currency, result, or forecast. The rationale must discuss only the platform returned in the platform field and must not recommend or name alternative platforms. Output ONLY valid JSON.`

    const userPrompt = `${brandCtx}

Suggest the best paid campaign configuration. Consider:
- Platform: META (B2C/broad), LINKEDIN (B2B/professional), TIKTOK (young/consumer), GOOGLE (high-intent/search)
- Objective: LEAD_GENERATION (services/SaaS), CONVERSIONS (ecommerce), TRAFFIC (awareness), BRAND_AWARENESS (new brands)
- Budget: return null; the user must explicitly confirm a daily budget
- Language: 'ar' for Arabic-speaking market, 'en' for English, 'bilingual' for mixed

Return JSON:
{
  "platform": "META|GOOGLE|TIKTOK|LINKEDIN",
  "objective": "LEAD_GENERATION|CONVERSIONS|TRAFFIC|BRAND_AWARENESS|ENGAGEMENT",
  "dailyBudget": null,
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
      suggestion = {}
    }

    const providerSuggestionComplete =
      typeof suggestion.platform === 'string' &&
      typeof suggestion.objective === 'string' &&
      typeof suggestion.name === 'string' &&
      typeof suggestion.rationale === 'string'

    if (!providerSuggestionComplete) {
      return NextResponse.json({
        platform: 'META',
        objective: 'LEAD_GENERATION',
        dailyBudget: null,
        currency: 'USD',
        name: `${brandProfile.brandName} — Lead Gen ${month} ${year}`,
        language: isMENA ? 'ar' : 'en',
        rationale: 'Planning recommendation based on confirmed Brand Brain inputs. Budget and currency still require confirmation.',
        requiresBudgetConfirmation: true,
        requiresCurrencyConfirmation: true,
        providerGenerated: false,
        recommendationSource: 'deterministic_brand_defaults',
      })
    }

    const platform = normalizePaidPlanningPlatform(suggestion.platform)
    const language = String(suggestion.language || 'en')
    return NextResponse.json({
      platform,
      objective: suggestion.objective,
      dailyBudget: null,
      currency: String(suggestion.currency || 'USD'),
      name: suggestion.name,
      language,
      rationale: normalizePaidPlanningRationale({
        platform,
        rationale: suggestion.rationale,
        locale: language === 'ar' ? 'ar' : 'en',
      }),
      requiresBudgetConfirmation: true,
      requiresCurrencyConfirmation: true,
      providerGenerated: true,
      recommendationSource: 'openai',
    })
  } catch (err) {
    console.error('[ai-suggest]', err)
    return NextResponse.json({ error: 'Suggestion failed' }, { status: 500 })
  }
}
