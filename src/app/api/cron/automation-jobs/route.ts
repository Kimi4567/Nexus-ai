import { NextRequest, NextResponse } from 'next/server'
import { cronAuthError } from '@/lib/cronAuth'
import { processNextAutomationJob } from '@/lib/automationJobs/processor'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const authError = cronAuthError(req)
  if (authError) return authError

  const requestedLimit = Number(req.nextUrl.searchParams.get('limit') || '2')
  const limit = Math.min(2, Math.max(1, Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 2))
  const startedAt = Date.now()
  const settled = await Promise.allSettled(
    Array.from({ length: limit }, () => processNextAutomationJob()),
  )

  const jobs: Array<{
    id: string | null
    kind?: string
    status: string
    attemptCount?: number
    error?: string
  }> = []
  settled.forEach((result) => {
    if (result.status === 'rejected') {
      jobs.push({
        id: null,
        status: 'WORKER_ERROR',
        error: result.reason instanceof Error ? result.reason.message.slice(0, 300) : 'Unknown worker error',
      })
      return
    }
    if (!result.value) return
    jobs.push({
      id: result.value.id,
      kind: result.value.kind,
      status: result.value.status,
      attemptCount: result.value.attemptCount,
    })
  })
  const workerErrors = settled.filter(result => result.status === 'rejected').length

  return NextResponse.json({
    ok: workerErrors === 0,
    claimed: jobs.filter(job => job.id).length,
    workerErrors,
    jobs,
    durationMs: Date.now() - startedAt,
  }, { status: workerErrors === 0 ? 200 : 503 })
}
