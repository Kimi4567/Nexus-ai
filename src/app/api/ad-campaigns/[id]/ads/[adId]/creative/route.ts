import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { validatePaidCreativeMedia } from '@/lib/paidCreativeAttachment'

// Prisma client types can lag the schema in local worktrees before generation.
// Keep this route scoped through the existing runtime client, as sibling paid routes do.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

type JsonRecord = Record<string, unknown>

function record(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null
}

async function imageByteSize(url: string): Promise<number> {
  const head = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10_000) })
  const declared = Number(head.headers.get('content-length') || 0)
  if (head.ok && Number.isFinite(declared) && declared > 0) return declared

  const response = await fetch(url, {
    headers: { Accept: 'image/*' },
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) return 0
  return (await response.arrayBuffer()).byteLength
}

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string; adId: string }> }
) {
  const params = await props.params
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    if (
      body.explicitCreativeAttachConfirmed !== true ||
      body.reviewedAssetRightsConfirmed !== true
    ) {
      return NextResponse.json({
        error: 'Explicit draft-only attachment and reviewed-asset rights confirmations are required.',
        mode: 'confirmation_required',
      }, { status: 400 })
    }

    if (typeof body.mediaId !== 'string' || !body.mediaId.trim()) {
      return NextResponse.json({ error: 'Select a Media Library image first.' }, { status: 400 })
    }

    const ad = await db.ad.findFirst({
      where: {
        id: params.adId,
        adSet: {
          adCampaign: {
            id: params.id,
            workspace: { ownerId: user.id },
          },
        },
      },
      select: {
        id: true,
        platformAdId: true,
        platformCreativeId: true,
        adSet: {
          select: {
            adCampaign: {
              select: { workspaceId: true, organicCampaignId: true },
            },
          },
        },
      },
    })
    if (!ad) return NextResponse.json({ error: 'Ad draft not found' }, { status: 404 })

    if (ad.platformAdId || ad.platformCreativeId) {
      return NextResponse.json({
        error: 'This ad already has a platform draft. Replace its creative through an explicit platform revision workflow, not a local overwrite.',
        mode: 'platform_revision_required',
      }, { status: 409 })
    }

    const requestedMediaId = body.mediaId.trim()
    const generatedVisualId = requestedMediaId.startsWith('generated:')
      ? requestedMediaId.slice('generated:'.length).trim()
      : ''
    let generatedQualityReview: JsonRecord | null = null
    const media = generatedVisualId
      ? await (async () => {
          const visual = await db.generatedVisual.findFirst({
            where: {
              id: generatedVisualId,
              workspaceId: ad.adSet.adCampaign.workspaceId,
              status: 'COMPLETED',
              qualityStatus: 'PASSED',
              imageUrl: { not: null },
              OR: [
                { campaignId: null },
                { campaignId: ad.adSet.adCampaign.organicCampaignId || '__none__' },
              ],
            },
            select: {
              id: true,
              imageUrl: true,
              campaignName: true,
              visualType: true,
              qualityReview: true,
            },
          })
          if (!visual?.imageUrl) return null
          generatedQualityReview = record(visual.qualityReview)
          const format = record(generatedQualityReview?.formatValidation)
          const paidQualityReady = generatedQualityReview?.passed === true
            && format?.passed === true
            && Number(generatedQualityReview.semanticAlignmentScore) >= 85
            && Number(generatedQualityReview.professionalQualityScore) >= 88
            && generatedQualityReview.technicalIntegrity === true
            && generatedQualityReview.noNewRasterText === true
            && generatedQualityReview.noInventedClaims === true
          if (!paidQualityReady) return null
          const mimeType = typeof format.contentType === 'string'
            ? format.contentType.split(';')[0]
            : 'image/png'
          return {
            id: requestedMediaId,
            type: 'IMAGE',
            mimeType,
            url: visual.imageUrl,
            size: await imageByteSize(visual.imageUrl),
            width: Number(format.width),
            height: Number(format.height),
            fileName: `${visual.campaignName || 'NEXUS'} — ${String(visual.visualType).toLowerCase()}`,
          }
        })()
      : await db.media.findFirst({
          where: {
            id: requestedMediaId,
            workspace: { ownerId: user.id },
          },
          select: {
            id: true,
            type: true,
            mimeType: true,
            url: true,
            size: true,
            width: true,
            height: true,
            fileName: true,
          },
        })
    if (!media) return NextResponse.json({ error: 'Media asset not found in this workspace.' }, { status: 404 })

    const validation = validatePaidCreativeMedia(media)
    if (!validation.ready || !validation.normalizedUrl) {
      return NextResponse.json({
        error: 'The selected asset is not ready for the current Meta image execution path.',
        errors: validation.errors,
        mode: 'creative_not_ready',
      }, { status: 400 })
    }

    const updated = await db.ad.update({
      where: { id: ad.id },
      data: {
        imageUrl: validation.normalizedUrl,
        videoUrl: null,
        thumbnailUrl: null,
        format: 'SINGLE_IMAGE',
        creativeSpecs: {
          ...validation.specs,
          sourceFileName: media.fileName,
          sourceType: generatedVisualId ? 'NEXUS_GENERATED_VISUAL' : 'UPLOADED_MEDIA',
          ...(generatedVisualId ? {
            sourceGeneratedVisualId: generatedVisualId,
            generatedQualityGate: 'PREMIUM_STATIC_AD_PASSED',
          } : {}),
        },
        specsValidated: true,
        specsErrors: [],
        reviewStatus: null,
        reviewFeedback: null,
      },
      select: {
        id: true,
        imageUrl: true,
        format: true,
        creativeSpecs: true,
        specsValidated: true,
        specsErrors: true,
        reviewStatus: true,
      },
    })

    return NextResponse.json({
      ad: updated,
      attached: true,
      draftOnly: true,
      platformMutation: false,
      creditsUsed: 0,
    })
  } catch (error) {
    console.error('[ad creative attach PATCH]', error)
    return NextResponse.json({ error: 'Could not attach the reviewed creative.' }, { status: 500 })
  }
}
