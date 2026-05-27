/**
 * POST /api/campaigns/[id]/share  — generate or toggle share link
 * GET  /api/campaigns/[id]/share  — get share status
 * DELETE /api/campaigns/[id]/share — revoke share link
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

function generateToken(): string {
  // 12 random bytes → 16 base64url chars (URL-safe, unguessable)
  const arr = new Uint8Array(12)
  crypto.getRandomValues(arr)
  return Buffer.from(arr).toString('base64url')
}

async function getCampaign(id: string, userId: string) {
  return prisma.campaign.findFirst({
    where: {
      id,
      project: { workspace: { ownerId: userId } },
    },
    select: { id: true, shareToken: true, isPublic: true, shareViews: true },
  })
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const campaign = await getCampaign(params.id, userId)
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    isPublic: campaign.isPublic,
    shareToken: campaign.shareToken,
    shareViews: campaign.shareViews,
  })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const campaign = await getCampaign(params.id, userId)
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const token = campaign.shareToken || generateToken()

  const updated = await prisma.campaign.update({
    where: { id: params.id },
    data: { shareToken: token, isPublic: true },
    select: { shareToken: true, isPublic: true, shareViews: true },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const campaign = await getCampaign(params.id, userId)
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.campaign.update({
    where: { id: params.id },
    data: { isPublic: false },
  })

  return NextResponse.json({ ok: true })
}
