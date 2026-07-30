import { after, NextRequest, NextResponse } from 'next/server'
import type { AutomationJob } from '@prisma/client'
import { getServerUserId } from '@/lib/apiAuth'
import { getAutomationJobForOwner } from '@/lib/automationJobs/repository'
import { processAutomationJobById } from '@/lib/automationJobs/processor'
import { toPublicAutomationJob } from '@/lib/automationJobs/types'
import { isAutomationJobMigrationRequiredError } from '@/lib/automationJobReadiness'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

type Params = { params: Promise<{ id: string }> }
type OwnedJobResult =
  | { ok: false; error: NextResponse }
  | { ok: true; job: AutomationJob }

async function ownedJob(req: NextRequest, props: Params): Promise<OwnedJobResult> {
  const userId = await getServerUserId(req)
  if (!userId) return { ok: false, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { id } = await props.params
  let job: AutomationJob | null
  try {
    job = await getAutomationJobForOwner(id, userId)
  } catch (error) {
    if (isAutomationJobMigrationRequiredError(error)) {
      return {
        ok: false,
        error: NextResponse.json({
          error: 'Durable automation is not available until its database migration is applied.',
          code: 'AUTOMATION_MIGRATION_REQUIRED',
        }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } }),
      }
    }
    throw error
  }
  if (!job) return { ok: false, error: NextResponse.json({ error: 'Automation job not found' }, { status: 404 }) }
  return { ok: true, job }
}

export async function GET(req: NextRequest, props: Params): Promise<NextResponse> {
  const result = await ownedJob(req, props)
  if (!result.ok) return result.error
  return NextResponse.json(
    { job: toPublicAutomationJob(result.job) },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}

export async function POST(req: NextRequest, props: Params): Promise<NextResponse> {
  const result = await ownedJob(req, props)
  if (!result.ok) return result.error

  const publicJob = toPublicAutomationJob(result.job)
  if (publicJob.terminal) {
    return NextResponse.json(
      { job: publicJob },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  }

  if (publicJob.canResume) {
    after(async () => {
      await processAutomationJobById(result.job.id).catch((error) => {
        console.error('[automation-job-resume]', result.job.id, error)
      })
    })
  }

  return NextResponse.json(
    {
      accepted: true,
      job: publicJob,
      message: publicJob.canResume
        ? 'NEXUS accepted the job for background processing.'
        : 'NEXUS is already processing this job or waiting for its retry window.',
    },
    {
      status: 202,
      headers: {
        'Cache-Control': 'private, no-store',
        'Retry-After': '2',
      },
    },
  )
}
