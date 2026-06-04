import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const userId = await getServerUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const user = { id: userId }
    const data = await request.json()

    const { campaignId, type, platform, prompt, params } = data

    // Verify campaign access
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        workspace: {
          ownerId: user.id,
        },
      },
    })

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Create generation record
    const generation = await prisma.generation.create({
      data: {
        campaignId,
        type,
        platform,
        prompt,
        params,
        status: 'QUEUED',
      },
    })

    // Queue job (would call BullMQ or similar in production)
    // For now, we'll enqueue to a webhook-based system

    return NextResponse.json({
      id: generation.id,
      status: generation.status,
      message: 'Generation queued',
    })
  } catch (error) {
    console.error('Generation error:', error)
    return NextResponse.json(
      { error: 'Failed to create generation' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getServerUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const user = { id: userId }
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaignId')

    const generations = await prisma.generation.findMany({
      where: {
        campaignId: campaignId || undefined,
        campaign: {
          workspace: {
            ownerId: user.id,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(generations)
  } catch (error) {
    console.error('Generation fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch generations' },
      { status: 500 }
    )
  }
}
