import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'

type Action = 'video_script' | 'ad_copy' | 'analyze'

interface RequestBody {
  action: Action
  // video_script params
  productName?: string
  description?: string
  style?: string
  duration?: number
  // ad_copy params
  platform?: string
  objective?: string
  // analyze params
  data?: string
}

const SYSTEM_PROMPTS: Record<Action, string> = {
  video_script: 'أنت NEX، منتج فيديوهات تسويقية بخبرة ١٥ سنة. اكتب سكريبت فيديو قصير (١٥-٣٠ ثانية) بالعربية الفصحى أو العامية حسب الطلب. حدد: المشهد، النص، الصوت/الموسيقى، والإيقاع. اكتب بأسلوب جذاب ومقنع.',
  ad_copy: 'أنت VEX، كاتب إعلانات رقمية محترف. اكتب ٣ نسخ إعلانية قصيرة ( headline + body + CTA ) بالعربية. كل نسخة أسلوب مختلف. اكتب بأسلوب تسويقي مقنع.',
  analyze: 'أنت PULSE، محلل بيانات تسويقي. قدم تحليل مبسط وتوصيات قابلة للتنفيذ بالعربية. ركز على الأرقام والتوجهات.',
}

function buildUserMessage(body: RequestBody): string {
  switch (body.action) {
    case 'video_script':
      return `اكتب سكريبت فيديو تسويقي لـ "${body.productName || 'المنتج'}".
الوصف: ${body.description || 'منتج رائع'}.
الأسلوب: ${body.style || 'عامي'}.` + (body.duration ? ` المدة: ${body.duration} ثانية.` : '')
    case 'ad_copy':
      return `اكتب ٣ نسخ إعلانية لـ "${body.productName || 'المنتج'}" على منصة ${body.platform || 'Facebook'}.
الهدف: ${body.objective || 'مبيعات'}.`
    case 'analyze':
      return `حلل هذه البيانات وأعطِ توصيات: ${body.data || 'لا توجد بيانات'}`
    default:
      return ''
  }
}

// Rate limiter — per user or IP
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

export async function POST(req: NextRequest) {
  // Try to get user ID from auth, fallback to IP for rate limiting
  let userId = await getServerUserId(req).catch(() => null)
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.ip || 'unknown'
  const rateKey = userId || clientIp

  if (!checkRateLimit(rateKey)) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again in a minute.' }, { status: 429 })
  }

  const body: RequestBody = await req.json()
  const { action } = body

  if (!action || !SYSTEM_PROMPTS[action]) {
    return NextResponse.json({ error: 'Invalid action. Use: video_script | ad_copy | analyze' }, { status: 400 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  const userMessage = buildUserMessage(body)

  if (!apiKey) {
    // Demo mode — return a rich mock response
    const demoResponses: Record<Action, string> = {
      video_script: `[سكريبت فيديو — وضع العرض]

🎬 المشهد ١: افتتاحية (٥ ثواني)
صوت: موسيقى إلكترونية حماسية
نص: "هل سئمت من الإعلانات التقليدية؟"

🎬 المشهد ٢: المنتج (١٥ ثانية)
صوت: موسيقى خلفية هادئة + صوت وصفي
نص: "NEXUS AI — ٤ وكلاء ذكاء اصطناعي يُديرون تسويقك بالكامل"

🎬 المشهد ٣: دعوة للعمل (٥ ثواني)
صوت: موسيقى تصاعدية
نص: "ابدأ مجاناً — www.nexus-grow.com"

🎵 الموسيقى المقترحة: electronic upbeat
⏱️ المدة الإجمالية: ٢٥ ثانية`,

      ad_copy: `[نسخ إعلانية — وضع العرض]

📌 النسخة ١ (حماسية):
العنوان: "٤ وكلاء AI يُديرون تسويقك وأنت نائم!"
النص: NEXUS AI هو فريقك التسويقي الكامل — فيديوهات، إعلانات، تحليلات، ورصد. كل هذا بضغطة زر.
CTA: جرّب مجاناً ←

📌 النسخة ٢ (عقلانية):
العنوان: "قلّل التكاليف ٨٠٪ وزوّد النتائج ٣٠٠٪"
النص: استبدل ٤ موظفين بـ ٤ وكلاء AI متخصصين. NEXUS AI يعمل ٢٤/٧ بدون إجازات.
CTA: احسب توفيرك ←

📌 النسخة ٣ (عاطفية):
العنوان: "تخيّل علامتك التجارية في كل مكان"
النص: NEX يُنتج. VEX يُعلن. PULSE يُحلل. Sentinel يُراقب. فريقك الجديد بانتظارك.
CTA: ابدأ رحلتك ←`,

      analyze: `[تحليل — وضع العرض]

📊 نظرة عامة:
أداء الحملة جيد مع مساحة للتحسين.

📈 التوجهات:
- نسبة النقر (CTR) ٤.٢٪ أعلى من المتوسط الصناعي (٢٨%).
- التحويلات ١,٢٤٠ بقيمة $١٢,٤٥٠ (متوسط $١٠/تحويل).

💡 التوصيات:
١. زِد الميزانية على إعلانات Facebook (أفضل أداء).
٢. قلّل Instagram Stories (أقل CTR).
٣. اختبر audience جديد: شباب ٢٥-٣٤ سنة.
٤. استخدم A/B testing على العناوين.`,
    }
    return NextResponse.json({ result: demoResponses[action] })
  }

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
          { role: 'system', content: SYSTEM_PROMPTS[action] },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      console.error('[ai/generate] OpenAI error:', err)
      return NextResponse.json({ error: 'AI service error. Please try again.' }, { status: 502 })
    }

    const data = await response.json()
    const result = data.choices?.[0]?.message?.content ?? 'لم يتم إنشاء محتوى'

    return NextResponse.json({ result })
  } catch (err: any) {
    console.error('[ai/generate] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
