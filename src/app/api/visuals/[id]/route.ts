/**
 * GET /api/visuals/[id] — get single visual (for polling)
 * PATCH /api/visuals/[id] — update visual (setPrimary, archive, etc.)
 * DELETE /api/visuals/[id] — soft delete (archive)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const visual = await db.generatedVisual.findFirst({
      where: {
        id: params.id,
        workspace: { ownerId: userId },
      },
    })
    if (!visual) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ visual })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { isPrimary, isArchived, status } = body

  try {
    const updateData: any = {}
    if (isPrimary !== undefined) updateData.isPrimary = isPrimary
    if (isArchived !== undefined) updateData.isArchived = isArchived
    if (status !== undefined) updateData.status = status

    // If setting as primary, unset all others for this campaign
    if (isPrimary === true) {
      const visual = await db.generatedVisual.findFirst({
        where: { id: params.id, workspace: { ownerId: userId } },
      })
      if (!visual) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      if (visual?.campaignId) {
        await db.generatedVisual.updateMany({
          where: { campaignId: visual.campaignId, id: { not: params.id } },
          data: { isPrimary: false },
        })
      }
    }

    const owned = await db.generatedVisual.findFirst({
      where: { id: params.id, workspace: { ownerId: userId } },
      select: { id: true },
    })
    if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await db.generatedVisual.update({
      where: { id: owned.id },
      data: updateData,
    })

    return NextResponse.json({ visual: updated })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const owned = await db.generatedVisual.findFirst({
      where: { id: params.id, workspace: { ownerId: userId } },
      select: { id: true },
    })
    if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await db.generatedVisual.update({
      where: { id: owned.id },
      data: { isArchived: true, status: 'ARCHIVED' },
    })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
