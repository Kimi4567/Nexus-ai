import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'

async function getUserId(req: Request) {
  return getServerUserId(req)
}

export async function GET(req: Request) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized', errorCode: 'UNAUTHORIZED' }, { status: 401 })

  const url = new URL(req.url)
  const query = url.searchParams.get('query') || ''
  const type = url.searchParams.get('type') || undefined
  const campaignId = url.searchParams.get('campaignId')?.trim() || undefined
  const source = url.searchParams.get('source')?.trim().toUpperCase() || undefined
  const requestedPage = Number(url.searchParams.get('page') || '1')
  const requestedLimit = Number(url.searchParams.get('limit') || '24')
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.trunc(requestedPage)) : 1
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(Math.trunc(requestedLimit), 50)) : 24
  const offset = (page - 1) * limit

  try {
    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    if (!workspace) {
      return NextResponse.json({ media: [], pagination: { page, limit, total: 0, pages: 0 } })
    }

    const where: any = { workspaceId: workspace.id }

    if (campaignId) {
      where.AND = [{ OR: [{ campaignId: null }, { campaignId }] }]
    }

    if (query) {
      where.fileName = { contains: query, mode: 'insensitive' }
    }

    if (type === 'VIDEO' || type === 'IMAGE') {
      where.type = type
    }

    const includeGeneratedVisuals = type !== 'VIDEO' && source !== 'UPLOADED_MEDIA'
    const generatedWhere: any = {
      workspaceId: workspace.id,
      status: 'COMPLETED',
      imageUrl: { not: null },
      isArchived: false,
    }
    if (campaignId) generatedWhere.campaignId = campaignId
    if (query) {
      generatedWhere.OR = [
        { campaignName: { contains: query, mode: 'insensitive' } },
        { brandName: { contains: query, mode: 'insensitive' } },
        { prompt: { contains: query, mode: 'insensitive' } },
      ]
    }

    // Fetch enough rows from each source to produce a correctly sorted combined
    // page. This keeps GeneratedVisual and uploaded Media discoverable through
    // one library without pretending they share the same deletion lifecycle.
    const sourceTake = offset + limit
    const [uploadedMedia, uploadedTotal, generatedVisuals, generatedTotal] = await Promise.all([
      prisma.media.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: sourceTake,
      }),
      prisma.media.count({ where }),
      includeGeneratedVisuals
        ? prisma.generatedVisual.findMany({
            where: generatedWhere,
            orderBy: { createdAt: 'desc' },
            take: sourceTake,
            select: {
              id: true,
              imageUrl: true,
              thumbnailUrl: true,
              campaignName: true,
              brandName: true,
              visualType: true,
              qualityStatus: true,
              qualityReview: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
      includeGeneratedVisuals ? prisma.generatedVisual.count({ where: generatedWhere }) : Promise.resolve(0),
    ])

    const generatedMedia = generatedVisuals.flatMap(visual => {
      if (!visual.imageUrl) return []
      const review = visual.qualityReview && typeof visual.qualityReview === 'object' && !Array.isArray(visual.qualityReview)
        ? visual.qualityReview as Record<string, unknown>
        : {}
      const paidCreativeEligible = visual.qualityStatus === 'PASSED'
        && review.passed === true
        && Number(review.semanticAlignmentScore) >= 85
        && Number(review.professionalQualityScore) >= 88
        && review.technicalIntegrity === true
        && review.noNewRasterText === true
        && review.noInventedClaims === true
      return [{
      id: `generated:${visual.id}`,
      generatedVisualId: visual.id,
      assetKind: 'GENERATED_VISUAL' as const,
      readOnly: true,
      paidCreativeEligible,
      fileName: `${visual.campaignName || visual.brandName || 'NEXUS'} — ${String(visual.visualType).toLowerCase()} visual`,
      mimeType: 'image/generated',
      type: 'IMAGE',
      url: visual.imageUrl,
      thumbnailUrl: visual.thumbnailUrl,
      createdAt: visual.createdAt,
      }]
    })
    const uploaded = uploadedMedia.map(item => ({
      ...item,
      assetKind: 'UPLOADED_MEDIA' as const,
      readOnly: false,
    }))
    const media = [...uploaded, ...generatedMedia]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(offset, offset + limit)
    const total = uploadedTotal + generatedTotal

    return NextResponse.json({ media, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
  } catch (err) {
    console.error('List media error', err)
    return NextResponse.json({ error: 'List failed', errorCode: 'LIST_FAILED' }, { status: 500 })
  }
}
