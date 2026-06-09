/**
 * GET /api/visuals — list visuals for campaign or workspace
 * PATCH /api/visuals — bulk status updates
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export async function GET(req: NextRequest) {
  try {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const campaignId = searchParams.get('campaignId')
  const limit = parseInt(searchParams.get('limit') || '20')

  const workspace = await prisma.workspace.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: 'asc' },
  })
  if (!workspace) return NextResponse.json({ visuals: [] })

  try {
    const where: any = {
      workspaceId: workspace.id,
      isArchived: false,
      // Only return visuals with a usable image — skip FAILED/GENERATING records
      status: 'COMPLETED',
    }
    if (campaignId) where.campaignId = campaignId

    const visuals = await db.generatedVisual.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ visuals })
  } catch {
    // Table may not exist yet
    return NextResponse.json({ visuals: [] })
  }
  } catch (err: any) {
    console.error('[visuals/GET]', err?.message)
    return NextResponse.json({ error: 'Failed to fetch visuals' }, { status: 500 })
  }
}
