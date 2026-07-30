import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { getLatestCampaignAutomationJob } from '@/lib/automationJobs/repository'
import { CAMPAIGN_ENGINE_JOB_KIND, toPublicAutomationJob } from '@/lib/automationJobs/types'
import { isAutomationJobMigrationRequiredError } from '@/lib/automationJobReadiness'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const campaignId = req.nextUrl.searchParams.get('campaignId')?.trim() || ''
  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId required' }, { status: 400 })
  }

  const kind = req.nextUrl.searchParams.get('kind')?.trim() || CAMPAIGN_ENGINE_JOB_KIND
  const activeOnly = req.nextUrl.searchParams.get('active') === '1'
  let job
  try {
    job = await getLatestCampaignAutomationJob({
      userId,
      campaignId,
      kind,
      activeOnly,
    })
  } catch (error) {
    if (isAutomationJobMigrationRequiredError(error)) {
      return NextResponse.json({
        error: 'Durable automation is not available until its database migration is applied.',
        code: 'AUTOMATION_MIGRATION_REQUIRED',
      }, {
        status: 503,
        headers: { 'Cache-Control': 'private, no-store' },
      })
    }
    throw error
  }

  return NextResponse.json(
    { job: job ? toPublicAutomationJob(job) : null },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
