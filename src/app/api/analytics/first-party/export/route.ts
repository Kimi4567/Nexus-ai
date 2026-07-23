import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { buildFirstPartyMeasurementCsv } from '@/lib/firstPartyMeasurementCsv'
import { readFirstPartyMeasurement } from '@/lib/firstPartyMeasurementService'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function safeFilenamePart(value: string, fallback: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || fallback
}

export async function GET(request: NextRequest) {
  const userId = await getServerUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await prisma.workspace.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const rawCampaignId = request.nextUrl.searchParams.get('campaignId')?.trim() || null
  const campaignId = rawCampaignId?.slice(0, 100) || null
  const campaign = campaignId ? await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId: workspace.id },
    select: { id: true, name: true },
  }) : null
  if (campaignId && !campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const generatedAt = new Date().toISOString()
  const summary = await readFirstPartyMeasurement(workspace.id, campaign?.id ?? null)
  const csv = buildFirstPartyMeasurementCsv(summary, {
    campaignId: campaign?.id ?? null,
    campaignName: campaign?.name ?? null,
    generatedAt,
  })
  const date = generatedAt.slice(0, 10)
  const scopeName = campaign
    ? safeFilenamePart(campaign.name, `campaign-${campaign.id.slice(0, 20)}`)
    : 'workspace'

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="nexus-first-party-${scopeName}-${date}.csv"`,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
