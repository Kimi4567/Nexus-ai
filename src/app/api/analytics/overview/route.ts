import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'

async function getUserId(req: Request) {
  return getServerUserId(req)
}

export async function GET(req: Request) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const campaignsCount = await prisma.campaign.count({ where: { workspace: { ownerId: userId } } })
    const generationsCount = await prisma.generation.count({ where: { campaign: { workspace: { ownerId: userId } } } })
    const exportsCount = await prisma.export.count({ where: { workspace: { ownerId: userId } } })
    const usage = await prisma.usage.findMany({ where: { userId }, orderBy: { year: 'desc', month: 'desc' }, take: 6 })

    return NextResponse.json({ campaignsCount, generationsCount, exportsCount, usage })
  } catch (err) {
    console.error('Analytics overview error', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
