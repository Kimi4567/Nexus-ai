/**
 * POST /api/webhooks/generation
 * Receives generation status updates from external providers (e.g. Replicate).
 * Protected by WEBHOOK_SECRET env var — all requests must include
 * Authorization: Bearer <WEBHOOK_SECRET>
 *
 * Note: Video status is primarily tracked via polling
 * (/api/campaigns/[id]/video-status). This webhook is an optional push
 * alternative for providers that support it.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  // ── Verify webhook secret ─────────────────────────────────────────────────
  const secret = process.env.WEBHOOK_SECRET
  if (!secret) {
    // No secret configured — reject all requests in production
    if (process.env.NODE_ENV !== 'development') {
      console.error('[webhooks/generation] WEBHOOK_SECRET not configured — rejecting request')
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
    }
  } else {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const data = await request.json()
    const { generationId, status, output, error } = data

    if (!generationId || !status) {
      return NextResponse.json({ error: 'generationId and status are required' }, { status: 400 })
    }

    // Validate status values to prevent arbitrary DB writes
    const VALID_STATUSES = ['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED']
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
    }

    const generation = await prisma.generation.update({
      where: { id: generationId },
      data: {
        status,
        output,
        error,
        progress: status === 'COMPLETED' ? 100 : status === 'PROCESSING' ? 50 : 0,
      },
    })

    return NextResponse.json({ success: true, generation })
  } catch (err) {
    console.error('[webhooks/generation] Error:', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
