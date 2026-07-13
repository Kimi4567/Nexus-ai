import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { prisma } from '@/lib/prisma'
import { getLanguageInstruction } from '@/lib/ai/langHelper'
import { checkAndDeductCredits, refundCredits } from '@/lib/credits'
import { buildStrategyPrompt, guardGeneratedStrategy, extractAllowedNumbers } from '@/lib/ai/strategyGenerateGuard'
import { buildBrandExecutionContext } from '@/lib/brandExecutionContext'
import { getAiProviderUnavailablePayload, isAiProviderConfigured } from '@/lib/ai/provider'

async function callOpenAI(prompt: string): Promise<any> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    }),
  })
  // Defensive (Trust Sprint #1): a non-2xx or malformed OpenAI response must
  // reject — never silently parse to `{}` and look like a successful strategy.
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) {
    throw new Error(`OpenAI request failed (${response.status})`)
  }
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI returned no content')
  return JSON.parse(content)
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await adminClient.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { goal, timeframe, platform, budget, language } = await req.json()

    if (!isAiProviderConfigured()) {
      return NextResponse.json(getAiProviderUnavailablePayload(language), { status: 503 })
    }

    // Get brand profile for context
    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
    })

    let brandContext = ''
    if (workspace) {
      const brand = await prisma.brandProfile.findFirst({
        where: { workspaceId: workspace.id },
      })
      brandContext = buildBrandExecutionContext(brand as unknown as Record<string, unknown> | null)
    }

    const days = timeframe === '30' ? 30 : timeframe === '60' ? 60 : 90
    const weeks = Math.floor(days / 7)

    const langInstruction = getLanguageInstruction(language || 'ar')

    // PR-C — safety-guarded prompt: English/neutral JSON-schema hints (no hard-coded
    // Arabic leaking into EN output), qualitative KPIs, conservative paid wording.
    const prompt = buildStrategyPrompt({ days, weeks, goal, platform, budget, brandContext, langInstruction })

    // ── Deduct credits before AI call ────────────────────────────
    const credit = await checkAndDeductCredits(user.id, 'CAMPAIGN_GENERATION')
    if (!credit.ok) return NextResponse.json(credit, { status: 402 })

    let strategy
    try {
      strategy = await callOpenAI(prompt)
      if (!strategy || typeof strategy !== 'object' || Object.keys(strategy).length === 0) {
        throw new Error('OpenAI returned an incomplete strategy')
      }
    } catch (genErr) {
      // Refund — failed generation must not charge the user (skip unlimited plans)
      if (credit.creditsUsed > 0) await refundCredits(user.id, 'CAMPAIGN_GENERATION')
      throw genErr
    }

    // PR-C — defence-in-depth: neutralize any fabricated KPI/budget numbers the
    // model still emitted. Only the user-provided budget is allowed to appear.
    strategy = guardGeneratedStrategy(strategy, extractAllowedNumbers(budget))

    return NextResponse.json({ strategy })
  } catch (err: any) {
    console.error('[Strategy generate] Error:', err)
    return NextResponse.json({ error: err.message || 'Failed to generate strategy' }, { status: 500 })
  }
}
