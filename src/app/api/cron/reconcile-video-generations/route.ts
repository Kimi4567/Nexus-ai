import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cronAuthError } from '@/lib/cronAuth'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

type ActiveVideoGeneration = {
  id: string
  campaignId: string
  params: unknown
  campaign: { workspace: { ownerId: string } }
}

function postIdFromParams(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const postId = (value as Record<string, unknown>).postId
  return typeof postId === 'string' && postId.trim() ? postId.trim() : null
}

/**
 * Completes asynchronous video jobs independently from browser polling.
 * The delegated request is protected by the same CRON_SECRET and is still
 * constrained by campaign/workspace ownership inside the video route.
 */
export async function GET(req: NextRequest) {
  const authError = cronAuthError(req)
  if (authError) return authError

  const secret = process.env.CRON_SECRET!
  const active = await prisma.generation.findMany({
    where: {
      type: 'VIDEO',
      provider: 'runway',
      status: { in: ['PENDING', 'QUEUED', 'PROCESSING'] },
    },
    orderBy: { updatedAt: 'asc' },
    take: 4,
    select: {
      id: true,
      campaignId: true,
      params: true,
      campaign: { select: { workspace: { select: { ownerId: true } } } },
    },
  }) as ActiveVideoGeneration[]

  const origin = new URL(req.url).origin
  const results = await Promise.all(active.map(async generation => {
    const postId = postIdFromParams(generation.params)
    if (!postId) {
      return { generationId: generation.id, outcome: 'invalid_context' as const, httpStatus: 0 }
    }

    try {
      const response = await fetch(
        `${origin}/api/campaigns/${encodeURIComponent(generation.campaignId)}/content-plan/${encodeURIComponent(postId)}/generate-video`,
        {
          method: 'GET',
          headers: {
            authorization: `Bearer ${secret}`,
            'x-nexus-internal-user-id': generation.campaign.workspace.ownerId,
            'x-nexus-worker': 'video-reconciliation',
          },
          cache: 'no-store',
          signal: AbortSignal.timeout(240_000),
        },
      )
      const payload = await response.json().catch(() => ({})) as Record<string, unknown>
      const providerStatus = typeof payload.status === 'string' ? payload.status : null
      return {
        generationId: generation.id,
        outcome: response.status === 202
          ? 'still_processing' as const
          : response.ok
            ? 'reconciled' as const
            : 'worker_error' as const,
        httpStatus: response.status,
        providerStatus,
        refundPending: payload.refundPending === true,
      }
    } catch (error) {
      console.error('[reconcile-video-generations] worker request failed', {
        generationId: generation.id,
        error: error instanceof Error ? error.message : 'unknown_error',
      })
      return { generationId: generation.id, outcome: 'worker_error' as const, httpStatus: 0 }
    }
  }))

  const workerErrors = results.filter(result => result.outcome === 'worker_error' || result.outcome === 'invalid_context').length
  return NextResponse.json({
    scanned: active.length,
    reconciled: results.filter(result => result.outcome === 'reconciled').length,
    stillProcessing: results.filter(result => result.outcome === 'still_processing').length,
    workerErrors,
    results,
  }, { status: workerErrors > 0 ? 503 : 200 })
}
