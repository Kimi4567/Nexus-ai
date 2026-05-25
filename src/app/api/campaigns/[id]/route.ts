import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'

async function getUserId(req: Request) {
  return getServerUserId(req)
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = params.id
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { concepts: true, generations: true, media: true },
    })
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ campaign })
  } catch (err) {
    console.error('Get campaign error', err)
    return NextResponse.json({ error: 'Get failed' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = params.id
  const body = await req.json()
  const allowed = ['name', 'description', 'goal', 'audience', 'tone', 'platforms', 'status', 'projectId']
  const data: any = {}
  for (const key of allowed) {
    if (body[key] !== undefined) data[key] = body[key]
  }

  try {
    const updated = await prisma.campaign.update({ where: { id }, data })
    return NextResponse.json({ campaign: updated })
  } catch (err) {
    console.error('Update campaign error', err)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = params.id
  try {
    // soft-delete: archive
    const updated = await prisma.campaign.update({ where: { id }, data: { status: 'ARCHIVED' } as any })
    return NextResponse.json({ campaign: updated })
  } catch (err) {
    console.error('Delete campaign error', err)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
