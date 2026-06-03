import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { getLanguageInstruction } from '@/lib/ai/langHelper'
import { checkAndDeductCredits } from '@/lib/credits'

/* ═══════════════════════════════════════════════════════════════
   /api/ai/generate
   Supports two calling conventions:

   1. NEW (agent pages — NEX, VEX, PULSE, Sentinel):
      { systemPrompt: string, userPrompt: string, maxTokens?: number }

   2. LEGACY (old generate flows):
      { action: 'video_script'|'ad_copy'|'analyze', productName?, ... }
   ═══════════════════════════════════════════════════════════════ */

// ── Rate limiting ──────────────────────────────────────────────
const rateMap = new Map<string, { count: number; windowStart: number }>()
const RATE_WINDOW_MS = 60_000
const MAX_PER_WINDOW = 20

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(key) ?? { count: 0, windowStart: now }
  if (now - entry.windowStart > RATE_WINDOW_MS) { entry.count = 0; entry.windowStart = now }
  entry.count++
  rateMap.set(key, entry)
  return entry.count <= MAX_PER_WINDOW
}

// ── Legacy action support ──────────────────────────────────────
type LegacyAction = 'video_script' | 'ad_copy' | 'analyze'

const LEGACY_SYSTEM: Record<LegacyAction, string> = {
  video_script: 'You are NEX, a marketing video producer with 15 years of experience. Write a short marketing video script (15-30 seconds). Specify: scene, script text, audio/music, and pacing. Write in a compelling and persuasive style.',
  ad_copy:      'You are VEX, a professional digital advertising copywriter. Write 3 short ad copy variations (headline + body + CTA), each with a different style and angle.',
  analyze:      'You are PULSE, a marketing data analyst. Provide a clear analysis and actionable recommendations. Focus on numbers and trends.',
}

function buildLegacyUserMessage(body: Record<string, unknown>): string {
  switch (body.action as LegacyAction) {
    case 'video_script':
      return `Write a marketing video script for "${body.productName || 'the product'}". Description: ${body.description || 'a great product'}. Style: ${body.style || 'conversational'}.${body.duration ? ` Duration: ${body.duration} seconds.` : ''}`
    case 'ad_copy':
      return `Write 3 ad copy variations for "${body.productName || 'the product'}" on ${body.platform || 'Facebook'}. Goal: ${body.objective || 'sales'}.`
    case 'analyze':
      return `Analyze this data and provide recommendations: ${body.data || 'no data provided'}`
    default:
      return ''
  }
}

const DEMO_LEGACY: Record<LegacyAction, string> = {
  video_script: `🎬 سكريبت فيديو — وضع العرض التجريبي\n\n[مشهد ١ - ٥ ثواني]\nنص: "هل سئمت من إدارة التسويق يدوياً؟"\n\n[مشهد ٢ - ١٥ ثانية]\nنص: "NEXUS AI — ٤ وكلاء يُديرون تسويقك ٢٤/٧"\n\n[مشهد ٣ - ٥ ثواني]\nنص: "ابدأ مجاناً الآن"`,
  ad_copy: `📢 نسخ إعلانية — وضع العرض التجريبي\n\n📌 النسخة ١:\nالعنوان: "فريقك التسويقي الكامل في منصة واحدة"\nالنص: NEX يُنتج، VEX يُعلن، PULSE يُحلل، Sentinel يُراقب.\nCTA: جرّب مجاناً ←`,
  analyze: `📊 تحليل — وضع العرض التجريبي\n\nنسبة النقر: ٤.٢٪ ✅\nتوصيات:\n١. زِد الميزانية على Facebook\n٢. اختبر audience ٢٥-٣٤ سنة`,
}

// ── Main handler ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // ── Auth (required) ────────────────────────────────────────────
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Rate limit ─────────────────────────────────────────────────
  if (!checkRateLimit(userId)) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again in a minute.' }, { status: 429 })
  }

  const body = await req.json() as Record<string, unknown>
  const apiKey = process.env.OPENAI_API_KEY

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

  // ── Credit deduction (before OpenAI call) ─────────────────────
  if (apiKey) {
    const credit = await checkAndDeductCredits(userId, 'AD_COPY')
    if (!credit.ok) return NextResponse.json(credit, { status: 402 })
  }

  // No API key → demo/mock mode
  if (!apiKey) {
    if (isNew) {
      const mock = `[وضع تجريبي — أضف OPENAI_API_KEY لتفعيل الذكاء الاصطناعي]\n\nالطلب وصلنا:\n"${(userMessage as string).slice(0, 120)}..."\n\nعند إضافة المفتاح سيولّد النظام محتوى احترافياً كاملاً هنا.`
      return NextResponse.json({ content: mock, result: mock })
    }
    return NextResponse.json({ result: DEMO_LEGACY[body.action as LegacyAction] })
  }

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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
