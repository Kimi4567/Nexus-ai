import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const data = await request.json()

    const { campaignId, format, type } = data

    // Verify campaign access
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        workspace: {
          ownerId: user.id,
        },
      },
      include: {
        concepts: true,
        generations: true,
      },
    })

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Create export record
    const exportRecord = await prisma.export.create({
      data: {
        workspaceId: campaign.workspaceId,
        campaignId,
        format,
        type,
        status: 'PROCESSING',
        itemsCount: (campaign.concepts.length || 0) + (campaign.generations.length || 0),
      },
    })

    // Queue export job (TODO: implement actual export generation)
    // For now, return mock URL
    const mockUrl = `https://storage.example.com/exports/${exportRecord.id}.${format.toLowerCase()}`

    await prisma.export.update({
      where: { id: exportRecord.id },
      data: {
        status: 'READY',
        url: mockUrl,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    })

    return NextResponse.json({
      id: exportRecord.id,
      url: mockUrl,
      expiresAt: exportRecord.expiresAt,
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Failed to create export' },
      { status: 500 }
    )
  }
}
