import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'

export async function GET(req: Request) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [campaignsCount, generationsCount, exportsCount, usage] = await Promise.all([
      prisma.campaign.count({ where: { workspace: { ownerId: userId } } }).catch(() => 0),
      prisma.generation.count({ where: { campaign: { workspace: { ownerId: userId } } } }).catch(() => 0),
      prisma.export.count({ where: { workspace: { ownerId: userId } } }).catch(() => 0),
      prisma.usage.findMany({ where: { userId }, orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 6 }).catch(() => []),
    ])

    return NextResponse.json({ campaignsCount, generationsCount, exportsCount, usage })
  } catch (err: any) {
    // DB tables may not exist yet — return zero state gracefully
    console.warn('[analytics/overview] DB query failed, returning zeros:', err?.message)
    return NextResponse.json({ campaignsCount: 0, generationsCount: 0, exportsCount: 0, usage: [] })
  }
}
