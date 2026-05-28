import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'

type Action = 'video_script' | 'ad_copy' | 'analyze'

interface RequestBody {
  action: Action
  // video_script params
  productName?: string
  description?: string
  style?: string
  // ad_copy params
  platform?: string
  objective?: string
  // analyze params
  data?: string
}

const SYSTEM_PROMPTS: Record<Action, string> = {
  video_script: 'أنت كاتب سكريبت فيديو محترف. اكتب سكريبت جذاب بالعربية.',
  ad_copy: 'أنت كاتب إعلانات محترف. اكتب نسخة إعلانية بالعربية.',
  analyze: 'أنت محلل تسويق. قدم تحليل وتوصيات بالعربية.',
}

function buildUserMessage(body: RequestBody): string {
  switch (body.action) {
    case 'video_script':
      return `اكتب سكريبت فيديو تسويقي لـ "${body.productName}". الوصف: ${body.description}. الأسلوب: ${body.style}.`
    case 'ad_copy':
      return `اكتب 3 نسخ إعلانية لـ "${body.productName}" على ${body.platform}. الهدف: ${body.objective}.`
    case 'analyze':
      return `حلل هذه البيانات: ${body.data}`
    default:
      return ''
  }
}

// Simple in-memory rate limiter: max 20 calls/min per user
const rateMap = new Map<string, { count: number; windowStart: number }>()
const RATE_WINDOW_MS = 60_000
const MAX_PER_WINDOW = 20

export async function POST(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate limit
  const now = Date.now()
  const entry = rateMap.get(userId) ?? { count: 0, windowStart: now }
  if (now - entry.windowStart > RATE_WINDOW_MS) { entry.count = 0; entry.windowStart = now }
  entry.count++
  rateMap.set(userId, entry)
  if (entry.count > MAX_PER_WINDOW) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again in a minute.' }, { status: 429 })
  }

  const body: RequestBody = await req.json()
  const { action } = body

  if (!action || !SYSTEM_PROMPTS[action]) {
    return NextResponse.json({ error: 'Invalid action. Use: video_script | ad_copy | analyze' }, { status: 400 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    // Demo mode — no real key configured
    return NextResponse.json({
      result: `[وضع العرض] ${SYSTEM_PROMPTS[action].slice(0, 50)}...`,
    })
  }

  const userMessage = buildUserMessage(body)
  if (!userMessage) {
    return NextResponse.json({ error: 'Missing required fields for this action' }, { status: 400 })
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
