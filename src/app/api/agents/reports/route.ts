/**
 * GET /api/agents/reports
 * Returns agent reports for the user's workspace.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
    })
    if (!workspace) return NextResponse.json({ reports: [] })

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')  // DAILY | WEEKLY | MONTHLY
    const limit = Number(searchParams.get('limit') || '10')

    const reports = await (prisma as any).agentReport.findMany({
      where: {
        workspaceId: workspace.id,
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ reports })
  } catch (err: any) {
    console.error('[api/agents/reports]', err)
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
