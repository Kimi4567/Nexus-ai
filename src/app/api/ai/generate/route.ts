import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'

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
  video_script: 'أنت NEX، منتج فيديوهات تسويقية بخبرة ١٥ سنة. اكتب سكريبت فيديو قصير (١٥-٣٠ ثانية) بالعربية. حدد: المشهد، النص، الصوت/الموسيقى، والإيقاع. اكتب بأسلوب جذاب ومقنع.',
  ad_copy:      'أنت VEX، كاتب إعلانات رقمية محترف. اكتب ٣ نسخ إعلانية قصيرة (headline + body + CTA) بالعربية. كل نسخة بأسلوب مختلف.',
  analyze:      'أنت PULSE، محلل بيانات تسويقي. قدم تحليل مبسط وتوصيات قابلة للتنفيذ بالعربية. ركز على الأرقام والتوجهات.',
}

function buildLegacyUserMessage(body: Record<string, unknown>): string {
  switch (body.action as LegacyAction) {
    case 'video_script':
      return `اكتب سكريبت فيديو تسويقي لـ "${body.productName || 'المنتج'}". الوصف: ${body.description || 'منتج رائع'}. الأسلوب: ${body.style || 'عامي'}.${body.duration ? ` المدة: ${body.duration} ثانية.` : ''}`
    case 'ad_copy':
      return `اكتب ٣ نسخ إعلانية لـ "${body.productName || 'المنتج'}" على منصة ${body.platform || 'Facebook'}. الهدف: ${body.objective || 'مبيعات'}.`
    case 'analyze':
      return `حلل هذه البيانات وأعطِ توصيات: ${body.data || 'لا توجد بيانات'}`
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
  // Rate limit
  let userId: string | null = null
  try { userId = await getServerUserId(req) } catch {}
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rateKey = userId || clientIp

  if (!checkRateLimit(rateKey)) {
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

  let systemMessage: string
  let userMessage: string
  let maxTokens: number

  if (isNew) {
    systemMessage = body.systemPrompt as string
    userMessage   = body.userPrompt as string
    maxTokens     = Math.min((body.maxTokens as number) || 1200, 2000)
  } else {
    const action = body.action as LegacyAction
    if (!LEGACY_SYSTEM[action]) {
      return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 })
    }
    systemMessage = LEGACY_SYSTEM[action]
    userMessage   = buildLegacyUserMessage(body)
    maxTokens     = 1500
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
