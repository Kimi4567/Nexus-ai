import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { getLanguageInstruction } from '@/lib/ai/langHelper'
import {
  checkAndDeductCredits,
  refundCredits,
  refundCreditsForTransaction,
  type CreditDeductionOk,
} from '@/lib/credits'
import { aiRateLimitDb } from '@/lib/dbRateLimit'
import { getAiProviderUnavailablePayload, isAiProviderConfigured } from '@/lib/ai/provider'

/* ═══════════════════════════════════════════════════════════════
   /api/ai/generate
   Supports two calling conventions:

   1. NEW (agent pages — NEX, VEX, PULSE, Sentinel):
      { systemPrompt: string, userPrompt: string, maxTokens?: number }

   2. LEGACY (old generate flows):
      { action: 'video_script'|'ad_copy'|'analyze', productName?, ... }
   ═══════════════════════════════════════════════════════════════ */

// ── Legacy action support ──────────────────────────────────────
type LegacyAction = 'video_script' | 'ad_copy' | 'analyze'

const LEGACY_SYSTEM: Record<LegacyAction, string> = {
  video_script: 'Act as NEX, a marketing video producer. Write a short marketing video script (15-30 seconds). Specify scene, script text, audio/music, and pacing. Use only supplied product facts and label missing proof instead of inventing it.',
  ad_copy:      'You are VEX, a professional digital advertising copywriter. Write 3 short ad copy variations (headline + body + CTA), each with a different style and angle.',
  analyze:      'You are PULSE, an evidence-first marketing analyst. Use only the data supplied by the user. Never invent metrics, benchmarks, trends, causality, revenue, conversions, or ROI. If data is absent or insufficient, say exactly what is missing and propose a measurement plan. Label all recommendations as hypotheses to test.',
}

function buildLegacyUserMessage(body: Record<string, unknown>): string {
  switch (body.action as LegacyAction) {
    case 'video_script':
      return `Write a marketing video script for "${body.productName || 'the product'}". Description: ${body.description || 'Not provided — do not invent product benefits.'}. Style: ${body.style || 'conversational'}.${body.duration ? ` Duration: ${body.duration} seconds.` : ''}`
    case 'ad_copy':
      return `Write 3 ad copy variations for "${body.productName || 'the product'}" on ${body.platform || 'Facebook'}. Goal: ${body.objective || 'sales'}.`
    case 'analyze':
      return `Analyze this data and provide recommendations: ${body.data || 'no data provided'}`
    default:
      return ''
  }
}

async function refundDeductedCredits(userId: string, credit: CreditDeductionOk, reason: string) {
  if (credit.creditsUsed <= 0) return
  if (credit.transactionId) {
    await refundCreditsForTransaction({ userId, transactionId: credit.transactionId, reason })
    return
  }
  await refundCredits(userId, 'AD_COPY', reason)
}

// ── Main handler ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // ── Auth (required) ────────────────────────────────────────────
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Rate limit (DB-backed — survives cold starts) ─────────────
  const rl = await aiRateLimitDb(userId)
  if (!rl.ok) return NextResponse.json({ error: rl.message }, { status: 429 })

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Determine call convention
  const isNew    = typeof body.systemPrompt === 'string' && typeof body.userPrompt === 'string'
  const isLegacy = typeof body.action === 'string'

  if (!isNew && !isLegacy) {
    return NextResponse.json({ error: 'Provide systemPrompt+userPrompt or action.' }, { status: 400 })
  }

  // Language instruction — appended to system prompt so AI responds in the user's locale
  // Defaults to 'ar' to preserve existing Arabic user behavior
  const language = (body.language as string) || 'ar'
  const langSuffix = '\n\n' + getLanguageInstruction(language)

  let systemMessage: string
  let userMessage: string
  let maxTokens: number

  if (isNew) {
    systemMessage = (body.systemPrompt as string) + langSuffix
    userMessage   = body.userPrompt as string
    maxTokens     = Math.min((body.maxTokens as number) || 1200, 2000)
  } else {
    const action = body.action as LegacyAction
    if (!LEGACY_SYSTEM[action]) {
      return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 })
    }
    systemMessage = LEGACY_SYSTEM[action] + langSuffix
    userMessage   = buildLegacyUserMessage(body)
    maxTokens     = 1500
  }

  if (!isAiProviderConfigured()) {
    return NextResponse.json(getAiProviderUnavailablePayload(language), { status: 503 })
  }

  const apiKey = process.env.OPENAI_API_KEY!.trim()

  // ── Credit deduction (before OpenAI call) ─────────────────────
  const creditResult = await checkAndDeductCredits(userId, 'AD_COPY')
  if (!creditResult.ok) return NextResponse.json(creditResult, { status: 402 })
  const credit: CreditDeductionOk = creditResult

  // Real OpenAI call
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user',   content: userMessage },
        ],
        temperature: 0.75,
        max_tokens: maxTokens,
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      console.error('[ai/generate] OpenAI error:', response.status, err)
      if (credit) await refundDeductedCredits(userId, credit, `OpenAI error ${response.status}`)
      return NextResponse.json(
        { error: `OpenAI error ${response.status}. Check API key and quota.` },
        { status: 502 }
      )
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content ?? ''

    // Return both field names — both calling conventions work
    return NextResponse.json({ content, result: content })

  } catch (err) {
    console.error('[ai/generate] Unexpected error:', err)
    if (credit) await refundDeductedCredits(userId, credit, 'Unexpected AI generation failure')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
