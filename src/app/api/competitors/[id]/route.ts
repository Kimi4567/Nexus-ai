import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

const db = prisma as any

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json() as { status?: unknown }
  const status = body.status === 'ACTIVE' || body.status === 'PAUSED' ? body.status : null
  if (!status) return NextResponse.json({ error: 'Status must be ACTIVE or PAUSED.' }, { status: 400 })

  const competitor = await db.competitor.findFirst({
    where: { id, workspace: { ownerId: user.id } },
    select: { id: true },
  })
  if (!competitor) return NextResponse.json({ error: 'Competitor not found.' }, { status: 404 })

  const updated = await db.competitor.update({
    where: { id },
    data: {
      status,
      nextScanAt: status === 'ACTIVE' ? new Date() : undefined,
      sources: status === 'ACTIVE'
        ? { updateMany: { where: { enabled: true }, data: { nextScanAt: new Date() } } }
        : undefined,
    },
    include: { sources: true, _count: { select: { signals: true } } },
  })
  return NextResponse.json({ competitor: updated })
}
