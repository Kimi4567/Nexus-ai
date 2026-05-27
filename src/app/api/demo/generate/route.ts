/**
 * POST /api/demo/generate
 * Public endpoint — no auth required.
 * Rate limited: 3 demos per IP per day (in-memory, resets on deploy).
 * Uses OpenAI gpt-4o-mini with a lean prompt to keep costs low (~$0.01/demo).
 * Falls back to mock output if OPENAI_API_KEY is not set.
 */
import { NextRequest, NextResponse } from 'next/server'

// ── In-memory rate limiter (per IP, per calendar day) ─────────────────
const DEMO_LIMIT = 3
const ipMap = new Map<string, { count: number; date: string }>()

function getDateKey() {
  return new Date().toISOString().slice(0, 10) // "2026-05-27"
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const today = getDateKey()
  const entry = ipMap.get(ip)
  if (!entry || entry.date !== today) {
    ipMap.set(ip, { count: 1, date: today })
    return { allowed: true, remaining: DEMO_LIMIT - 1 }
  }
  if (entry.count >= DEMO_LIMIT) {
    return { allowed: false, remaining: 0 }
  }
  entry.count++
  return { allowed: true, remaining: DEMO_LIMIT - entry.count }
}

// ── Mock fallback ──────────────────────────────────────────────────────
function mockDemoOutput(companyName: string, businessType: string, goal: string) {
  const goals: Record<string, string> = {
    SALES: 'drive sales and conversions',
    AWARENESS: 'build brand awareness',
    LEADS: 'generate qualified leads',
    TRAFFIC: 'increase website traffic',
    ENGAGEMENT: 'grow community engagement',
  }
  const goalDesc = goals[goal] || 'grow your business'
  return {
    strategy: `${companyName} should lead with authentic storytelling that speaks directly to its core audience's pain points. By positioning the brand as the trusted solution in the ${businessType.toLowerCase()} space, the campaign can ${goalDesc} through a mix of educational content and compelling social proof. A consistent posting rhythm across 2-3 platforms will build momentum within 30 days.`,
    hooks: [
      `"Most ${businessType.toLowerCase()} businesses are leaving money on the table — here's what ${companyName} does differently."`,
      `"We asked 100 customers what they wished they'd known before — their answers changed everything about how ${companyName} operates."`,
      `"Stop scrolling. If you've ever struggled with [core pain point], this is for you."`,
    ],
    caption: `✨ At ${companyName}, we believe you deserve better. Most people settle for ordinary — we're here to show you what extraordinary looks like. Ready to make the switch? 👇 Drop a comment or click the link in bio to get started. #${businessType.replace(/\s+/g, '')} #Growth #${companyName.replace(/\s+/g, '')}`,
    cta: `Start your free trial with ${companyName} → No credit card needed`,
    platform: 'INSTAGRAM',
    estimatedReach: '15K–45K',
  }
}

// ── OpenAI call ────────────────────────────────────────────────────────
async function callDemoAI(companyName: string, businessType: string, goal: string) {
  const GOAL_LABELS: Record<string, string> = {
    SALES: 'drive sales and conversions',
    AWARENESS: 'build brand awareness and recognition',
    LEADS: 'generate qualified leads',
    TRAFFIC: 'increase website traffic',
    ENGAGEMENT: 'grow community engagement',
  }

  const system = `You are a world-class marketing strategist. You create punchy, specific, scroll-stopping marketing content.
Never write generic copy. Always make it specific to the company and audience. Respond with valid JSON only.`

  const user = `Create a mini marketing demo for this business:
- Company: ${companyName}
- Industry: ${businessType}
- Goal: ${GOAL_LABELS[goal] || goal}

Return a JSON object with EXACTLY these keys:
{
  "strategy": "2-3 sentence campaign strategy — specific, actionable, no fluff",
  "hooks": [
    "Hook 1 — pattern interrupt style, specific to this company",
    "Hook 2 — social proof / credibility style",
    "Hook 3 — curiosity gap / FOMO style"
  ],
  "caption": "One ready-to-post Instagram/TikTok caption with relevant hashtags (150-200 chars)",
  "cta": "One specific call-to-action sentence",
  "platform": "Best platform for this business (INSTAGRAM, TIKTOK, FACEBOOK, LINKEDIN, or YOUTUBE_SHORTS)",
  "estimatedReach": "Realistic estimated reach range (e.g. '10K-40K')"
}

Make every word specific to ${companyName} — not generic marketing speak.`

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
      temperature: 0.85,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`)
  const data = await res.json()
  return JSON.parse(data.choices[0].message.content)
}

// ── Handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const { allowed, remaining } = checkRateLimit(ip)

  if (!allowed) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', message: 'You\'ve used all 3 free demos today. Sign up to unlock unlimited campaigns.' },
      { status: 429 }
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { companyName, businessType, goal } = body
  if (!companyName?.trim() || !businessType || !goal) {
    return NextResponse.json({ error: 'companyName, businessType, and goal are required' }, { status: 400 })
  }

  try {
    const result = process.env.OPENAI_API_KEY
      ? await callDemoAI(companyName.trim(), businessType, goal)
      : mockDemoOutput(companyName.trim(), businessType, goal)

    return NextResponse.json({
      ...result,
      remaining,
      companyName: companyName.trim(),
      businessType,
      goal,
    })
  } catch (err: any) {
    console.error('[demo/generate] error:', err.message)
    // Fall back to mock on API error
    return NextResponse.json({
      ...mockDemoOutput(companyName.trim(), businessType, goal),
      remaining,
    })
  }
}
