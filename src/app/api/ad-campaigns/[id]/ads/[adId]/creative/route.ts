import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { validatePaidCreativeMedia } from '@/lib/paidCreativeAttachment'

// Prisma client types can lag the schema in local worktrees before generation.
// Keep this route scoped through the existing runtime client, as sibling paid routes do.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

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
      },
    })
    if (!ad) return NextResponse.json({ error: 'Ad draft not found' }, { status: 404 })

    if (ad.platformAdId || ad.platformCreativeId) {
      return NextResponse.json({
        error: 'This ad already has a platform draft. Replace its creative through an explicit platform revision workflow, not a local overwrite.',
        mode: 'platform_revision_required',
      }, { status: 409 })
    }

    const media = await db.media.findFirst({
      where: {
        id: body.mediaId.trim(),
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
