/**
 * POST /api/demo/generate
 * Public, deterministic product preview. It performs no model call and returns
 * no reach, conversion, benchmark, or trend claim.
 */
import { NextRequest, NextResponse } from 'next/server'
import { dbRateLimit } from '@/lib/dbRateLimit'

const GOALS = new Set(['SALES', 'AWARENESS', 'LEADS', 'TRAFFIC', 'ENGAGEMENT'])

function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'
}

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().replace(/[\r\n]+/g, ' ').slice(0, max) : ''
}

export async function POST(req: NextRequest) {
  const rateLimit = await dbRateLimit(`public-demo:${clientIp(req)}`, {
    limit: 3,
    windowMs: 24 * 60 * 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json({ error: 'RATE_LIMITED', message: 'Daily preview limit reached.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  const companyName = clean((body as any).companyName, 100)
  const businessType = clean((body as any).businessType, 100)
  const goal = clean((body as any).goal, 30).toUpperCase()
  if (!companyName || !businessType || !GOALS.has(goal)) {
    return NextResponse.json({ error: 'Valid companyName, businessType, and goal are required' }, { status: 400 })
  }

  return NextResponse.json({
    mode: 'deterministic-preview',
    performanceClaims: false,
    evidenceStatus: 'No platform, customer, competitor, or market evidence is connected in this public preview.',
    strategy: `Testing hypothesis for ${companyName}: choose one clear ${goal.toLowerCase()} message for the ${businessType} audience, publish approved variants, and keep the direction only if platform evidence supports it.`,
    hooks: [
      `What makes ${companyName} worth considering?`,
      `A practical ${businessType} problem ${companyName} is designed to address.`,
      `Before choosing a ${businessType} solution, check these three criteria.`,
    ],
    caption: `${companyName}: one clear idea, one audience problem, and one next step. This is draft copy to review and test—not a performance promise.`,
    cta: `Review the offer and choose the next step that matches your ${goal.toLowerCase()} objective.`,
    platform: 'REQUIRES_BRAND_AND_AUDIENCE_VALIDATION',
    companyName,
    businessType,
    goal,
    remaining: rateLimit.remaining,
  })
}
